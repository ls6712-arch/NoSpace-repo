import { supabase } from "../../lib/supabase";
import { SITE_ORIGIN } from "../config";
import { formatDate, formatDateTime } from "./dates";
import { plural } from "./plural";
import { ERROR_LINE } from "./stateCopy";
import { HOME_TZ } from "./homeWeek";
import type { StubFace } from "./stubFace";

/**
 * A Soosh drop as the app shows it: a limited Pursuit with a window. Finish it
 * inside the window and you keep a numbered Stub (brief: the four Stubs, §3.2).
 * The counts come from drop_summary() (migration 20261203000000) and are null
 * until that function exists, so every screen works without them.
 */
export interface Drop {
  id: number;
  slug: string;
  title: string;
  blurb: string | null;
  cornerKey: string;
  targetMoments: number;
  opensAt: number;
  closesAt: number;
  maxEditions: number | null;
  palette: string[];
  /** People who joined. Null when it cannot be read. */
  peopleIn: number | null;
  /** Stubs given out so far. Null when it cannot be read. */
  finished: number | null;
}

/** Where you stand in a drop. */
export interface MyDrop {
  pursuitId: string;
  /** Your place in finishing order, once you have finished. */
  edition: number | null;
  stubId: number | null;
}

interface DropRow {
  id: number;
  slug: string;
  title: string;
  blurb: string | null;
  corner_key: string;
  target_moments: number;
  opens_at: string;
  closes_at: string;
  max_editions: number | null;
  palette: unknown;
  people_in?: number | null;
  finished?: number | null;
}

const COLUMNS = "id, slug, title, blurb, corner_key, target_moments, opens_at, closes_at, max_editions, palette";

export function dropFromRow(r: DropRow): Drop {
  return {
    id: Number(r.id),
    slug: r.slug,
    title: r.title,
    blurb: r.blurb?.trim() || null,
    cornerKey: r.corner_key,
    targetMoments: r.target_moments,
    opensAt: new Date(r.opens_at).getTime(),
    closesAt: new Date(r.closes_at).getTime(),
    maxEditions: r.max_editions ?? null,
    palette: Array.isArray(r.palette) ? r.palette.filter((c): c is string => typeof c === "string") : [],
    peopleIn: typeof r.people_in === "number" ? r.people_in : null,
    finished: typeof r.finished === "number" ? r.finished : null,
  };
}

/** Rows from drop_summary(), or from the table itself (no counts) while the function is not there yet. */
async function readDrops(slug: string | null, now: number): Promise<Drop[]> {
  const client = supabase;
  if (!client) return [];
  try {
    const { data, error } = await client.rpc("drop_summary", slug ? { p_slug: slug } : {});
    if (!error && Array.isArray(data)) return (data as DropRow[]).map(dropFromRow);
    const iso = new Date(now).toISOString();
    let q = client.from("drops").select(COLUMNS).lte("opens_at", iso);
    q = slug ? q.eq("slug", slug) : q.gt("closes_at", iso);
    const table = await q.order("closes_at", { ascending: true });
    if (table.error || !table.data) return [];
    return (table.data as DropRow[]).map(dropFromRow);
  } catch {
    return [];
  }
}

/** The drop that is open right now: the one closing soonest when there are two. Null when none is. */
export async function fetchOpenDrop(now = Date.now()): Promise<Drop | null> {
  return (await readDrops(null, now))[0] ?? null;
}

/** One drop by its slug, open or closed. Null before it opens and when there is no such drop. */
export async function fetchDrop(slug: string, now = Date.now()): Promise<Drop | null> {
  if (!slug) return null;
  return (await readDrops(slug, now))[0] ?? null;
}

/** Your own Pursuit in a drop, and your Stub if you have finished. Null when you have not joined. */
export async function fetchMyDrop(dropId: number, userId: string): Promise<MyDrop | null> {
  const client = supabase;
  if (!client || !userId) return null;
  try {
    const { data, error } = await client.from("pursuits").select("id").eq("drop_id", dropId).eq("user_id", userId).limit(1);
    const pursuitId = (data as { id: string }[] | null)?.[0]?.id;
    if (error || !pursuitId) return null;
    const stubs = await client.from("stubs").select("id, edition").eq("drop_id", dropId).eq("user_id", userId).eq("kind", "drop").limit(1);
    const stub = (stubs.data as { id: number; edition: number | null }[] | null)?.[0];
    return { pursuitId, edition: stub?.edition ?? null, stubId: stub?.id ?? null };
  } catch {
    return null;
  }
}

/** The messages join_drop() raises that are written for people; anything else becomes the plain error line. */
const JOIN_ERRORS = new Set(["That one has closed.", "That one is full.", "Your account can’t join right now.", "You’re not logged in."]);

/** Join an open drop. Joining twice returns the same Pursuit. */
export async function joinDrop(dropId: number): Promise<{ pursuitId: string | null; error: string | null }> {
  if (!supabase) return { pursuitId: null, error: ERROR_LINE };
  try {
    const { data, error } = await supabase.rpc("join_drop", { p_drop_id: dropId });
    if (error) return { pursuitId: null, error: JOIN_ERRORS.has(error.message) ? error.message : ERROR_LINE };
    return typeof data === "string" && data ? { pursuitId: data, error: null } : { pursuitId: null, error: ERROR_LINE };
  } catch {
    return { pursuitId: null, error: ERROR_LINE };
  }
}

export type DropPhase = "open" | "closed";

export const dropPhase = (drop: Pick<Drop, "closesAt">, now: number): DropPhase => (now < drop.closesAt ? "open" : "closed");

export const dropPath = (slug: string): string => `/drop/${slug}`;

/** Where logging a Moment into your drop Pursuit starts. */
export const dropLogPath = (pursuitId: string): string => `/create?pursuit=${encodeURIComponent(pursuitId)}`;

/**
 * The link a drop is shared with. With an invite code, the friend who opens it
 * signs up as that person's invite and lands back on the drop.
 */
export function dropLink(slug: string, inviteCode?: string | null): string {
  const base = `${SITE_ORIGIN}/#${dropPath(slug)}`;
  return inviteCode ? `${base}?invite=${encodeURIComponent(inviteCode)}` : base;
}

/** Where a signed-out visitor on a drop goes to sign up, so onboarding ends back on the drop. */
export function dropSignUpPath(slug: string, inviteCode?: string | null): string {
  const q = new URLSearchParams();
  if (inviteCode) q.set("invite", inviteCode);
  q.set("redirect", dropPath(slug));
  return `/onboarding?${q.toString()}`;
}

/** "Closes Sun, Dec 6, 11:59 PM" while open, "Closed Sun, Dec 6" after. New York time, like every plan. */
export function closesLine(drop: Pick<Drop, "closesAt">, now: number): string {
  if (dropPhase(drop, now) === "closed") return `Closed ${formatDate(drop.closesAt, { weekday: "short", timeZone: HOME_TZ, now })}`;
  return `Closes ${formatDateTime(drop.closesAt, { timeZone: HOME_TZ, now })}`;
}

/** "One Moment before it closes" / "5 Moments before it closes". */
export const goalLine = (drop: Pick<Drop, "targetMoments">): string =>
  `${drop.targetMoments === 1 ? "One Moment" : plural(drop.targetMoments, "Moment")} before it closes`;

/**
 * The real counts, and only when there is something to count: "12 people in" and
 * "4 Stubs kept". A count that cannot be read, or is zero, is left out. Never rounded.
 */
export function countLines(drop: Pick<Drop, "peopleIn" | "finished">): string[] {
  const lines: string[] = [];
  if (drop.peopleIn) lines.push(`${plural(drop.peopleIn, "person", "people")} in`);
  if (drop.finished) lines.push(`${plural(drop.finished, "Stub")} kept`);
  return lines;
}

/**
 * The drop's Stub as artwork. With an edition it is yours; without one it is the
 * blank the drop is giving out. The total prints only after the drop has closed.
 */
export function dropFace(drop: Drop, now: number, edition?: number | null): StubFace {
  const closed = dropPhase(drop, now) === "closed";
  return {
    kind: "drop",
    title: drop.title,
    color: "var(--cat-orange)",
    day: formatDate(closed ? drop.closesAt : now, { timeZone: HOME_TZ, now }),
    goal: drop.targetMoments,
    edition: edition ?? undefined,
    editionsTotal: closed && drop.finished ? drop.finished : undefined,
    palette: drop.palette.length >= 2 ? drop.palette : undefined,
  };
}

/** What the share sheet says with a drop's link. */
export const dropShareText = (drop: Pick<Drop, "title" | "closesAt">, now: number): string =>
  `${drop.title}. ${closesLine(drop, now)}. Do it with me.`;
