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
export const PICKS_MAX = 6;
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
 * The picks that overlap [from, to), soonest first, at most 6. A pick with no
 * end counts as lasting 3 hours from its start. Unpublished ones never show here.
 */
export function visiblePicks(picks: readonly CityPick[], from: number, to: number, limit = PICKS_MAX): CityPick[] {
  return picks
    .filter((p) => p.published && p.startsAt < to && (p.endsAt ?? p.startsAt + DEFAULT_PICK_HOURS * 3_600_000) >= from)
    .sort((a, b) => a.startsAt - b.startsAt || a.id - b.id)
    .slice(0, limit);
}

/** The week's published picks of the city. Best effort: none on any failure. */
export async function fetchCityPicks(from: number, to: number): Promise<CityPick[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("city_picks")
      .select(COLUMNS)
      .eq("city", CITY)
      .eq("published", true)
      .lt("starts_at", new Date(to).toISOString())
      .order("starts_at", { ascending: true })
      .limit(50);
    if (error || !Array.isArray(data)) return [];
    return visiblePicks((data as Record<string, any>[]).map(toPick), from, to);
  } catch {
    return [];
  }
}

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
  found: number;
  searches: number;
  dropped: { title: string; reason: string }[];
}

/** Runs the scout once. It only ever adds drafts; the admin publishes. */
export async function runScout(focus: string): Promise<{ report: ScoutReport | null; error: string | null }> {
  if (!supabase) return { report: null, error: "The scout needs the live app." };
  const { data, error } = await supabase.functions.invoke("stubby-scout", { body: { focus: focus.trim() || null } });
  if (error) {
    // The function says what went wrong in its JSON body; the client only says "non-2xx".
    let message: string | null = null;
    try {
      const body = await (error as { context?: Response }).context?.json?.();
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      message = null;
    }
    return { report: null, error: message ?? "The scout isn't set up yet, or couldn't be reached." };
  }
  const r = data as Partial<ScoutReport> | null;
  if (!r || typeof r.added !== "number") return { report: null, error: "The scout's answer couldn't be read." };
  return { report: { added: r.added, found: r.found ?? 0, searches: r.searches ?? 0, dropped: Array.isArray(r.dropped) ? r.dropped : [] }, error: null };
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

// ── Where the morning restock looks (scout_sources, migration 20261101180000) ──

export interface ScoutSource {
  id: number;
  name: string;
  focus: string;
  /** Search only this site. Null: the whole web. */
  searchDomain: string | null;
  /** Pages on this site publish without review. Null: all drafts. */
  trustedHost: string | null;
  enabled: boolean;
}

export interface SourceInput {
  name: string;
  focus: string;
  searchDomain: string;
  trustedHost: string;
}

const HOST_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/;

/** "https://www.nypl.org/events" or "NYPL.org" to "nypl.org"; "" stays "". */
export function bareHost(text: string): string {
  const t = text.trim().toLowerCase();
  if (!t) return "";
  try {
    return new URL(/^https?:\/\//.test(t) ? t : `https://${t}`).hostname.replace(/^www\./, "");
  } catch {
    return t;
  }
}

export function sourceProblem(i: SourceInput): string | null {
  if (!i.name.trim()) return "Add a name.";
  if (i.name.trim().length > 60) return "The name is 60 characters at most.";
  if (!i.focus.trim()) return "Say what to look for.";
  if (i.focus.trim().length > 200) return "What to look for is 200 characters at most.";
  for (const h of [i.searchDomain, i.trustedHost]) if (h.trim() && !HOST_RE.test(bareHost(h))) return "A site is a web address like nypl.org.";
  return null;
}

/** Every source, admins only (the database returns nothing to anyone else). */
export async function fetchSources(): Promise<{ sources: ScoutSource[]; error: string | null }> {
  if (!supabase) return { sources: [], error: null };
  const { data, error } = await supabase.from("scout_sources").select("id, name, focus, search_domain, trusted_host, enabled").order("id");
  // Before the migration is live there is no table: show nothing rather than an error.
  if (error) return { sources: [], error: error.code === "42P01" ? null : friendlyError(error) };
  return {
    sources: (data as Record<string, any>[]).map((r) => ({ id: r.id, name: r.name, focus: r.focus, searchDomain: r.search_domain ?? null, trustedHost: r.trusted_host ?? null, enabled: !!r.enabled })),
    error: null,
  };
}

export async function setSourceEnabled(id: number, enabled: boolean): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("scout_sources").update({ enabled }).eq("id", id);
  return { error: error ? friendlyError(error) : null };
}

export async function addSource(i: SourceInput): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const problem = sourceProblem(i);
  if (problem) return { error: problem };
  const { error } = await supabase.from("scout_sources").insert({
    name: i.name.trim(),
    focus: i.focus.trim(),
    search_domain: bareHost(i.searchDomain) || null,
    trusted_host: bareHost(i.trustedHost) || null,
  });
  return { error: error ? friendlyError(error) : null };
}
