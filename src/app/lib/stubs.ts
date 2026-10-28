import { supabase } from "../../lib/supabase";
import { subHobbyLabel } from "../data/hobbies";

/** A Stub as the database holds it (migration 20261101000000). */
export interface StubRow {
  id: number;
  kind: "event" | "session" | "gold";
  serial: number | null;
  postId?: number;
  pursuitId?: string;
}

/**
 * The session Stub a posted Moment earned, if any. The database issues it when
 * the Moment is saved with a Pursuit, a moment after the insert returns, so this
 * looks a few times before giving up. Null when none was issued (no Pursuit, or
 * the migration is not live yet).
 */
export async function fetchStubForPost(postId: number, tries = 4, waitMs = 450): Promise<StubRow | null> {
  const client = supabase;
  if (!client) return null;
  for (let i = 0; i < tries; i++) {
    try {
      const { data, error } = await client
        .from("stubs")
        .select("id, kind, serial, post_id, pursuit_id")
        .eq("post_id", postId)
        .eq("kind", "session")
        .maybeSingle();
      // 42703 and 42P01: the columns or table are not there yet; no point asking again.
      if (error) return null;
      if (data) {
        const r = data as { id: number; kind: StubRow["kind"]; serial: number | null; post_id: number | null; pursuit_id: string | null };
        return { id: r.id, kind: r.kind, serial: r.serial, postId: r.post_id ?? undefined, pursuitId: r.pursuit_id ?? undefined };
      }
    } catch {
      return null;
    }
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return null;
}

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
  kind: "event" | "session" | "gold";
  serial: number | null;
  title: string;
  meta: string;
  /** "2/5" for a session Stub of a Pursuit with a goal. */
  count?: { done: number; total: number };
  corner?: { spaceSlug: string; slug: string };
  issuedAt: number;
}

export interface RawStub {
  id: number;
  kind: StubCard["kind"];
  serial: number | null;
  issuedAt: number;
  eventTitle?: string;
  spaceName?: string;
  pursuitId?: string;
}
export interface PursuitInfo {
  title: string;
  spaceSlug?: string;
  cornerSlug?: string;
  cornerName?: string;
  total?: number;
}

/**
 * Newest first. A session Stub reads "{Corner} #3": its place in the order the
 * Stubs of that Pursuit were issued to this person. Gold reads "{Pursuit}".
 */
export function buildStubCards(raws: readonly RawStub[], pursuits: ReadonlyMap<string, PursuitInfo>, formatDay: (ms: number) => string): StubCard[] {
  const sessionOrder = new Map<number, number>();
  const perPursuit = new Map<string, number>();
  for (const r of [...raws].filter((x) => x.kind === "session").sort((a, b) => a.issuedAt - b.issuedAt)) {
    const n = (perPursuit.get(r.pursuitId ?? "") ?? 0) + 1;
    perPursuit.set(r.pursuitId ?? "", n);
    sessionOrder.set(r.id, n);
  }
  return [...raws]
    .sort((a, b) => b.issuedAt - a.issuedAt)
    .map((r) => {
      const p = r.pursuitId ? pursuits.get(r.pursuitId) : undefined;
      const corner = p?.spaceSlug && p.cornerSlug ? { spaceSlug: p.spaceSlug, slug: p.cornerSlug } : undefined;
      const day = formatDay(r.issuedAt);
      if (r.kind === "event") {
        return { id: r.id, kind: r.kind, serial: r.serial, title: (r.eventTitle ?? "Event").slice(0, 60), meta: [day, r.spaceName].filter(Boolean).join(" · "), issuedAt: r.issuedAt };
      }
      if (r.kind === "gold") {
        return { id: r.id, kind: r.kind, serial: r.serial, title: (p?.title ?? "Pursuit").slice(0, 60), meta: [day, "complete"].join(" · "), corner, issuedAt: r.issuedAt };
      }
      const n = sessionOrder.get(r.id) ?? 1;
      const name = p?.cornerName ?? p?.title ?? "Session";
      return {
        id: r.id,
        kind: r.kind,
        serial: r.serial,
        title: `${name.slice(0, 40)} #${n}`,
        meta: [day, p?.title && p.cornerName ? p.title.slice(0, 30) : undefined].filter(Boolean).join(" · "),
        count: p?.total && p.total > 0 ? { done: Math.min(n, p.total), total: p.total } : undefined,
        corner,
        issuedAt: r.issuedAt,
      };
    });
}

/** Your own Stubs, newest first. Best effort: before the migration is live, or on any failure, none. */
export async function fetchMyStubs(userId: string, formatDay: (ms: number) => string): Promise<StubCard[]> {
  const client = supabase;
  if (!client) return [];
  try {
    const { data, error } = await client
      .from("stubs")
      .select("id, kind, serial, event_id, space_id, pursuit_id, issued_at")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false })
      .limit(200);
    if (error || !data) return [];
    const rows = data as { id: number; kind: StubRow["kind"]; serial: number | null; event_id: number | null; space_id: string | null; pursuit_id: string | null; issued_at: string }[];
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
      })),
      info,
      formatDay,
    );
  } catch {
    return [];
  }
}
