import { supabase } from "../../lib/supabase";
import { categoryOfCorner } from "../data/cornerCategories";
import { cornerColor, type CatColor } from "./categoryStyle";
import { formatWeekday } from "./dates";
import { friendlyError } from "./friendlyError";
import { HOME_TZ, nyTimeToMs } from "./homeWeek";
import { ticketTime } from "./weekView";

/**
 * "This week in New York": a few hand-picked things the founder or an admin
 * adds each week (migration 20261031001347). Signed-in people read the
 * published ones; admins read and write all of them. Reads are best effort:
 * before the migration is live, or on any failure, there are no picks and the
 * Week view simply hides the row.
 */

export const CITY = "new-york";
/** Enough room for the daily sweep (migration 20261101170000) without an endless row. */
export const PICKS_MAX = 12;
export const PICK_COLORS: readonly CatColor[] = ["rose", "orange", "violet", "blue", "amber", "lime", "teal", "pink"];

export interface CityPick {
  id: number;
  title: string;
  place: string | null;
  startsAt: number;
  endsAt: number | null;
  /** The editor's own words: "free", "$25". */
  price: string | null;
  url: string | null;
  /** The Corner as "space-slug/corner-slug", for its icon. */
  cornerKey: string | null;
  color: CatColor;
  published: boolean;
  /** Found by Stubby for this person when they asked; they see it even before it goes live. */
  mine?: boolean;
}

export const isPickColor = (c: unknown): c is CatColor => PICK_COLORS.includes(c as CatColor);

const COLUMNS = "id, title, place, starts_at, ends_at, price, url, color, published, corner_id, corners(space_slug, slug)";

function toPick(r: Record<string, any>): CityPick {
  const corner = Array.isArray(r.corners) ? r.corners[0] : r.corners;
  const key = corner?.space_slug && corner?.slug ? `${corner.space_slug}/${corner.slug}` : null;
  return {
    id: r.id,
    title: r.title,
    place: r.place ?? null,
    startsAt: Date.parse(r.starts_at),
    endsAt: r.ends_at ? Date.parse(r.ends_at) : null,
    price: r.price ?? null,
    url: r.url ?? null,
    cornerKey: key,
    color: isPickColor(r.color) ? r.color : key ? cornerColor(corner.space_slug, corner.slug) : "orange",
    published: !!r.published,
  };
}

/** A pick with no end is taken to last this long, so an evening event does not vanish the moment it starts. */
export const DEFAULT_PICK_HOURS = 3;

/**
 * The picks that overlap [from, to), soonest first, at most PICKS_MAX. A pick with no
 * end counts as lasting 3 hours from its start. Unpublished ones show only to the
 * person whose ask found them.
 */
export function visiblePicks(picks: readonly CityPick[], from: number, to: number, limit = PICKS_MAX): CityPick[] {
  return picks
    .filter((p) => (p.published || p.mine) && p.startsAt < to && (p.endsAt ?? p.startsAt + DEFAULT_PICK_HOURS * 3_600_000) >= from)
    .sort((a, b) => a.startsAt - b.startsAt || a.id - b.id)
    .slice(0, limit);
}

/**
 * The week's published picks of the city, plus what Stubby found for this person
 * when they asked (requested_by, migration 20261101170000). Best effort: none on any
 * failure; before that migration is live, the published ones only.
 */
export async function fetchCityPicks(from: number, to: number, userId?: string | null): Promise<CityPick[]> {
  if (!supabase) return [];
  const base = (cols: string) =>
    supabase!
      .from("city_picks")
      .select(cols)
      .eq("city", CITY)
      .lt("starts_at", new Date(to).toISOString())
      .gte("starts_at", new Date(from - DEFAULT_PICK_HOURS * 3_600_000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(100);
  try {
    let rows: Record<string, any>[] | null = null;
    if (userId) {
      const r = await base(`${COLUMNS}, requested_by`).or(`published.eq.true,requested_by.eq.${userId}`);
      if (!r.error && Array.isArray(r.data)) rows = r.data as unknown as Record<string, any>[];
    }
    if (!rows) {
      const r = await base(COLUMNS).eq("published", true);
      if (r.error || !Array.isArray(r.data)) return [];
      rows = r.data as unknown as Record<string, any>[];
    }
    return visiblePicks(
      rows.map((r) => ({ ...toPick(r), mine: !!userId && r.requested_by === userId })),
      from,
      to,
    );
  } catch {
    return [];
  }
}

// ── Asking Stubby (a member's own search, stubby-scout mode "member") ─────

export interface AskResult {
  added: number;
  live: number;
  /** null when the function didn't say. */
  asksLeft: number | null;
}

/** The function's own error message from a non-2xx reply, or null. */
async function functionError(error: unknown): Promise<string | null> {
  try {
    const body = await (error as { context?: Response }).context?.json?.();
    return body && typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

/** Stubby looks for `focus` now. What he finds is saved for this person (and, when clean, for everyone). */
export async function askStubby(focus: string): Promise<{ result: AskResult | null; error: string | null }> {
  const text = focus.trim();
  if (!text) return { result: null, error: ASK_EMPTY };
  if (!supabase) return { result: null, error: ASK_OFF };
  const { data, error } = await supabase.functions.invoke("stubby-scout", { body: { mode: "member", focus: text.slice(0, 120) } });
  if (error) return { result: null, error: (await functionError(error)) ?? ASK_OFF };
  const r = data as { added?: unknown; live?: unknown; asksLeft?: unknown } | null;
  if (!r || typeof r.added !== "number") return { result: null, error: ASK_OFF };
  return { result: { added: r.added, live: typeof r.live === "number" ? r.live : 0, asksLeft: typeof r.asksLeft === "number" ? r.asksLeft : null }, error: null };
}

export const ASK_EMPTY = "Say what you're in the mood for.";
export const ASK_OFF = "Stubby isn't looking right now. Try again later.";

/** "Sat 31 · 7 PM · free": the pill on a card. No price, no price part. */
export function pickPill(p: Pick<CityPick, "startsAt" | "price">): string {
  const day = `${formatWeekday(p.startsAt, "short", HOME_TZ)} ${new Date(p.startsAt).toLocaleString("en-US", { timeZone: HOME_TZ, day: "numeric" })}`;
  const t = ticketTime(p.startsAt);
  return [day, `${t.top} ${t.bottom}`, p.price?.trim() || null].filter(Boolean).join(" · ");
}

/** The category of the pick's Corner, for its icon. */
export const pickCategorySlug = (p: Pick<CityPick, "cornerKey">): string | undefined => {
  const [space, slug] = p.cornerKey?.split("/") ?? [];
  return space && slug ? categoryOfCorner(space, slug)?.slug : undefined;
};

// ── the admin page ────────────────────────────────────────────────────────

export interface PickInput {
  title: string;
  place: string;
  /** A New York wall clock time from a datetime-local field: "2026-10-31T19:00". */
  starts: string;
  ends: string;
  price: string;
  url: string;
  cornerId: number | null;
  color: CatColor;
}

/** "2026-10-31T19:00" in New York to milliseconds, or NaN. */
export function parseNyLocal(text: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) return NaN;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  return nyTimeToMs(y, mo, d, h) + mi * 60_000;
}

const localFmt = new Intl.DateTimeFormat("en-CA", { timeZone: HOME_TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** Milliseconds to the "2026-10-31T19:00" a datetime-local field shows, in New York. */
export function toNyLocal(ms: number): string {
  const p: Record<string, string> = {};
  for (const part of localFmt.formatToParts(new Date(ms))) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** What is wrong with a form, in the editor's words, or null. The database checks the same limits. */
export function pickProblem(i: PickInput): string | null {
  if (!i.title.trim()) return "Add a title.";
  if (i.title.trim().length > 80) return "The title is 80 characters at most.";
  if (i.place.trim().length > 80) return "The place is 80 characters at most.";
  if (i.price.trim().length > 40) return "The price is 40 characters at most.";
  if (!Number.isFinite(parseNyLocal(i.starts))) return "Add a start time.";
  if (i.ends.trim() && !(parseNyLocal(i.ends) >= parseNyLocal(i.starts))) return "The end can’t be before the start.";
  if (i.url.trim() && !/^https:\/\/\S+$/i.test(i.url.trim())) return "The link has to start with https://.";
  return null;
}

const rowFor = (i: PickInput) => ({
  title: i.title.trim(),
  place: i.place.trim() || null,
  starts_at: new Date(parseNyLocal(i.starts)).toISOString(),
  ends_at: i.ends.trim() ? new Date(parseNyLocal(i.ends)).toISOString() : null,
  price: i.price.trim() || null,
  url: i.url.trim() || null,
  corner_id: i.cornerId,
  color: i.color,
});

export function inputFor(p: CityPick, cornerId: number | null): PickInput {
  return { title: p.title, place: p.place ?? "", starts: toNyLocal(p.startsAt), ends: p.endsAt ? toNyLocal(p.endsAt) : "", price: p.price ?? "", url: p.url ?? "", cornerId, color: p.color };
}

/** Where an admin-list pick came from (migration 20261101155717). Null on an editor's pick, or before that migration is live. */
export interface ScoutInfo {
  sourceUrl: string | null;
  checkedAt: number | null;
  note: string | null;
}
export type AdminPick = CityPick & { cornerId: number | null; scout: ScoutInfo | null };

const SCOUT_COLUMNS = `${COLUMNS}, found_by, source_url, checked_at, scout_note`;

export function scoutInfo(r: Record<string, any>): ScoutInfo | null {
  if (r.found_by !== "scout") return null;
  return {
    sourceUrl: typeof r.source_url === "string" ? r.source_url : null,
    checkedAt: r.checked_at ? Date.parse(r.checked_at) : null,
    note: typeof r.scout_note === "string" && r.scout_note.trim() ? r.scout_note : null,
  };
}

/**
 * Every pick, drafts included, soonest first. Admins only: anyone else just gets the published ones.
 * Asks for the scout columns too; before their migration is live (undefined column) it asks again without them.
 */
export async function fetchAllPicks(): Promise<{ picks: AdminPick[]; error: string | null }> {
  if (!supabase) return { picks: [], error: null };
  const query = (cols: string) => supabase!.from("city_picks").select(cols).eq("city", CITY).order("starts_at", { ascending: false }).limit(200);
  let { data, error } = await query(SCOUT_COLUMNS);
  if (error && error.code === "42703") ({ data, error } = await query(COLUMNS));
  if (error) return { picks: [], error: friendlyError(error) };
  return {
    picks: (data as unknown as Record<string, any>[]).map((r) => ({ ...toPick(r), cornerId: (r.corner_id as number | null) ?? null, scout: scoutInfo(r) })),
    error: null,
  };
}

// ── Stubby's scout (supabase/functions/stubby-scout) ─────────────────────

export interface ScoutReport {
  added: number;
  /** How many of those went live by themselves; the rest wait as drafts. */
  live: number;
  found: number;
  searches: number;
  dropped: { title: string; reason: string }[];
}

/** Runs the scout once. Clean finds go live; anything to double check waits here as a draft. */
export async function runScout(focus: string): Promise<{ report: ScoutReport | null; error: string | null }> {
  if (!supabase) return { report: null, error: "The scout needs the live app." };
  const { data, error } = await supabase.functions.invoke("stubby-scout", { body: { focus: focus.trim() || null } });
  if (error) {
    // The function says what went wrong in its JSON body; the client only says "non-2xx".
    return { report: null, error: (await functionError(error)) ?? "The scout isn't set up yet, or couldn't be reached." };
  }
  const r = data as Partial<ScoutReport> | null;
  if (!r || typeof r.added !== "number") return { report: null, error: "The scout's answer couldn't be read." };
  return { report: { added: r.added, live: r.live ?? 0, found: r.found ?? 0, searches: r.searches ?? 0, dropped: Array.isArray(r.dropped) ? r.dropped : [] }, error: null };
}

export async function savePick(input: PickInput, id?: number): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const problem = pickProblem(input);
  if (problem) return { error: problem };
  const { error } = id === undefined ? await supabase.from("city_picks").insert({ ...rowFor(input), city: CITY }) : await supabase.from("city_picks").update(rowFor(input)).eq("id", id);
  return { error: error ? friendlyError(error) : null };
}

export async function setPublished(id: number, published: boolean): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("city_picks").update({ published }).eq("id", id);
  return { error: error ? friendlyError(error) : null };
}

export async function deletePick(id: number): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("city_picks").delete().eq("id", id);
  return { error: error ? friendlyError(error) : null };
}

// ── The watch list (scout_watches, migration 20261101170000). Admins only. ──

export interface Watch {
  id: number;
  query: string;
  active: boolean;
  lastRunAt: number | null;
}

export async function fetchWatches(): Promise<{ watches: Watch[]; error: string | null }> {
  if (!supabase) return { watches: [], error: null };
  const { data, error } = await supabase.from("scout_watches").select("id, query, active, last_run_at").eq("city", CITY).order("created_at", { ascending: true }).limit(200);
  // Before the migration is live there is no list: show none, quietly.
  if (error) return { watches: [], error: error.code === "42P01" || error.code === "PGRST205" ? null : friendlyError(error) };
  return {
    watches: (data as Record<string, any>[]).map((r) => ({ id: r.id, query: r.query, active: !!r.active, lastRunAt: r.last_run_at ? Date.parse(r.last_run_at) : null })),
    error: null,
  };
}

export function watchProblem(query: string): string | null {
  const q = query.trim();
  if (q.length < 3) return "Say what to look for, 3 characters or more.";
  if (q.length > 200) return "200 characters at most.";
  return null;
}

export async function addWatch(query: string): Promise<{ error: string | null }> {
  const problem = watchProblem(query);
  if (problem) return { error: problem };
  if (!supabase) return { error: null };
  const { error } = await supabase.from("scout_watches").insert({ query: query.trim(), city: CITY });
  if (error?.code === "23505") return { error: "That's already on the list." };
  return { error: error ? friendlyError(error) : null };
}

export async function setWatchActive(id: number, active: boolean): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("scout_watches").update({ active }).eq("id", id);
  return { error: error ? friendlyError(error) : null };
}

export async function removeWatch(id: number): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("scout_watches").delete().eq("id", id);
  return { error: error ? friendlyError(error) : null };
}
