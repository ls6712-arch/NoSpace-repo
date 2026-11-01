import { supabase } from "../../lib/supabase";
import { subHobbyLabel } from "../data/hobbies";
import { formatMonth } from "./dates";
import { cornerName } from "./homeItems";
import type { EarnedStub } from "./stubFace";
import { ERROR_LINE } from "./stateCopy";

/** A Stub as the database holds it (migration 20261101134307: four kinds). */
export type StubKind = "event" | "finish" | "drop" | "regular";

export interface StubRow {
  id: number;
  kind: StubKind;
  serial: number | null;
  postId?: number;
  pursuitId?: string;
  /** A drop Stub's place in finishing order. */
  edition?: number;
  cornerKey?: string;
  /** A Regular Stub's month, YYYY-MM-DD (the 1st). */
  period?: string;
}

/** When one Moment earns more than one Stub, the rarest is the one to show. */
const RANK: Record<StubKind, number> = { drop: 4, event: 3, finish: 2, regular: 1 };

/**
 * The Stub a posted Moment earned, if any (a Finisher, a drop or a Regular). The
 * database issues it in the same transaction as the Moment, so one look is enough;
 * a second covers a slow replica. Null when it earned none.
 */
export async function fetchStubForPost(postId: number, tries = 2, waitMs = 400): Promise<StubRow | null> {
  const client = supabase;
  if (!client) return null;
  for (let i = 0; i < tries; i++) {
    try {
      const { data, error } = await client
        .from("stubs")
        .select("id, kind, serial, post_id, pursuit_id, edition, corner_key, period")
        .eq("post_id", postId);
      // 42703 and 42P01: the columns or table are not there yet; no point asking again.
      if (error) return null;
      const rows = (data ?? []) as { id: number; kind: StubKind; serial: number | null; post_id: number | null; pursuit_id: string | null; edition: number | null; corner_key: string | null; period: string | null }[];
      if (rows.length > 0) {
        const r = [...rows].sort((a, b) => (RANK[b.kind] ?? 0) - (RANK[a.kind] ?? 0))[0];
        return {
          id: r.id,
          kind: r.kind,
          serial: r.serial,
          postId: r.post_id ?? undefined,
          pursuitId: r.pursuit_id ?? undefined,
          edition: r.edition ?? undefined,
          cornerKey: r.corner_key ?? undefined,
          period: r.period ?? undefined,
        };
      }
    } catch {
      return null;
    }
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return null;
}

/**
 * The Stub a Moment just earned, with what its artwork prints: the Pursuit's
 * title and cover, the drop's title, colours and goal. The rarest when there are
 * two (a 10th day that also finishes a Pursuit). Null when it earned none.
 */
export async function fetchEarnedStub(postId: number): Promise<EarnedStub | null> {
  const client = supabase;
  if (!client) return null;
  try {
    const { data, error } = await client
      .from("stubs")
      .select("id, kind, serial, issued_at, corner_key, period, edition, pursuits(title, cover_image_path, target_moments), drops(title, palette, target_moments)")
      .eq("post_id", postId);
    if (error || !data || data.length === 0) return null;
    type Row = {
      id: number;
      kind: StubKind;
      serial: number | null;
      issued_at: string;
      corner_key: string | null;
      period: string | null;
      edition: number | null;
      pursuits: { title: string; cover_image_path: string | null; target_moments: number | null } | null;
      drops: { title: string; palette: string[]; target_moments: number } | null;
    };
    const r = [...(data as unknown as Row[])].sort((a, b) => (RANK[b.kind] ?? 0) - (RANK[a.kind] ?? 0))[0];
    return {
      id: r.id,
      kind: r.kind,
      serial: r.serial,
      issuedAt: r.issued_at,
      cornerKey: r.corner_key ?? undefined,
      period: r.period ?? undefined,
      edition: r.edition ?? undefined,
      pursuitTitle: r.pursuits?.title,
      coverPath: r.pursuits?.cover_image_path ?? undefined,
      goal: r.pursuits?.target_moments ?? undefined,
      drop: r.drops ? { title: r.drops.title, palette: r.drops.palette, targetMoments: r.drops.target_moments } : undefined,
    };
  } catch {
    return null;
  }
}

/** Put a Stub in your front row, or take it down. Resolves to an error message, or null. */
export async function pinStub(stubId: number, pinned: boolean): Promise<string | null> {
  if (!supabase) return ERROR_LINE;
  const { error } = await supabase.rpc("pin_stub", { p_stub_id: stubId, p_pinned: pinned });
  if (!error) return null;
  return error.message === "Your front row is full. Take one down first." ? error.message : ERROR_LINE;
}

/** "No. 042". */
export const editionLabel = (n: number): string => `No. ${String(n).padStart(3, "0")}`;

/** Who has loved a Moment, oldest first. Best effort: an empty list when it cannot be read. */
export async function fetchLovers(postId: number): Promise<string[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from("reactions").select("user_id, created_at").eq("post_id", postId).eq("type", "love").order("created_at", { ascending: true });
    if (error || !data) return [];
    return (data as { user_id: string }[]).map((r) => r.user_id);
  } catch {
    return [];
  }
}

/** One Stub on You, ready for a Ticket. */
export interface StubCard {
  id: number;
  kind: StubKind;
  serial: number | null;
  title: string;
  meta: string;
  corner?: { spaceSlug: string; slug: string };
  issuedAt: number;
}

export interface RawStub {
  id: number;
  kind: StubKind;
  serial: number | null;
  issuedAt: number;
  eventTitle?: string;
  spaceName?: string;
  pursuitId?: string;
  edition?: number;
  cornerKey?: string;
  /** YYYY-MM-DD, the 1st of a Regular Stub's month. */
  period?: string;
}
export interface PursuitInfo {
  title: string;
  spaceSlug?: string;
  cornerSlug?: string;
  cornerName?: string;
  total?: number;
}

const cornerOf = (key?: string): { spaceSlug: string; slug: string } | undefined => {
  const [spaceSlug, slug] = key?.split("/") ?? [];
  return spaceSlug && slug ? { spaceSlug, slug } : undefined;
};

/**
 * Newest first. A Finisher and a drop read as their Pursuit, an event as its event,
 * and a Regular as its Corner and month.
 */
export function buildStubCards(
  raws: readonly RawStub[],
  pursuits: ReadonlyMap<string, PursuitInfo>,
  formatDay: (ms: number) => string,
  formatPeriod: (ymd: string) => string = (ymd) => formatMonth(`${ymd}T12:00:00`),
): StubCard[] {
  return [...raws]
    .sort((a, b) => b.issuedAt - a.issuedAt)
    .map((r) => {
      const p = r.pursuitId ? pursuits.get(r.pursuitId) : undefined;
      const corner = cornerOf(r.cornerKey) ?? (p?.spaceSlug && p.cornerSlug ? { spaceSlug: p.spaceSlug, slug: p.cornerSlug } : undefined);
      const day = formatDay(r.issuedAt);
      const base = { id: r.id, kind: r.kind, serial: r.serial, corner, issuedAt: r.issuedAt };
      switch (r.kind) {
        case "event":
          return { ...base, title: (r.eventTitle ?? "Event").slice(0, 60), meta: [day, r.spaceName].filter(Boolean).join(" · ") };
        case "drop":
          return { ...base, title: (p?.title ?? "Pursuit").slice(0, 60), meta: [day, r.edition ? editionLabel(r.edition) : undefined].filter(Boolean).join(" · ") };
        case "regular":
          return { ...base, title: r.cornerKey ? cornerName(r.cornerKey) : "Corner", meta: r.period ? formatPeriod(r.period) : day };
        default:
          return { ...base, title: (p?.title ?? "Pursuit").slice(0, 60), meta: [day, "finished"].join(" · ") };
      }
    });
}

/** Your own Stubs, newest first. Best effort: before the migration is live, or on any failure, none. */
export async function fetchMyStubs(userId: string, formatDay: (ms: number) => string): Promise<StubCard[]> {
  const client = supabase;
  if (!client) return [];
  try {
    const { data, error } = await client
      .from("stubs")
      .select("id, kind, serial, event_id, space_id, pursuit_id, issued_at, edition, corner_key, period")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false })
      .limit(200);
    if (error || !data) return [];
    const rows = data as { id: number; kind: StubKind; serial: number | null; event_id: number | null; space_id: string | null; pursuit_id: string | null; issued_at: string; edition: number | null; corner_key: string | null; period: string | null }[];
    const eventIds = [...new Set(rows.map((r) => r.event_id).filter((x): x is number => x != null))];
    const spaceIds = [...new Set(rows.map((r) => r.space_id).filter((x): x is string => !!x))];
    const pursuitIds = [...new Set(rows.map((r) => r.pursuit_id).filter((x): x is string => !!x))];
    const [events, spaces, pursuits] = await Promise.all([
      eventIds.length ? client.from("space_events").select("id, title").in("id", eventIds) : Promise.resolve({ data: [] as { id: number; title: string }[] }),
      spaceIds.length ? client.from("spaces").select("id, name").in("id", spaceIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      pursuitIds.length ? client.from("pursuits").select("id, title, hobby_slug, sub_hobby, measure").in("id", pursuitIds) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);
    const eventTitle = new Map(((events.data ?? []) as { id: number; title: string }[]).map((e) => [e.id, e.title]));
    const spaceName = new Map(((spaces.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
    const info = new Map<string, PursuitInfo>();
    for (const p of (pursuits.data ?? []) as Record<string, any>[]) {
      const sub = p.sub_hobby as string | null;
      const space = p.hobby_slug as string | null;
      const target = Number(p.measure?.target);
      info.set(p.id as string, {
        title: p.title as string,
        spaceSlug: space ?? undefined,
        cornerSlug: sub ?? undefined,
        cornerName: sub ? subHobbyLabel(sub) : undefined,
        total: Number.isFinite(target) && target > 0 ? target : undefined,
      });
    }
    return buildStubCards(
      rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        serial: r.serial,
        issuedAt: new Date(r.issued_at).getTime(),
        eventTitle: r.event_id != null ? eventTitle.get(r.event_id) : undefined,
        spaceName: r.space_id ? spaceName.get(r.space_id) : undefined,
        pursuitId: r.pursuit_id ?? undefined,
        edition: r.edition ?? undefined,
        cornerKey: r.corner_key ?? undefined,
        period: r.period ?? undefined,
      })),
      info,
      formatDay,
    );
  } catch {
    return [];
  }
}
