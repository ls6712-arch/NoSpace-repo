import { supabase } from "../../lib/supabase";
import { categoryOfCorner } from "../data/cornerCategories";
import { cornerColor, type CatColor } from "./categoryStyle";
import { formatWeekday } from "./dates";
import { friendlyError } from "./friendlyError";
import { HOME_TZ, nyTimeToMs } from "./homeWeek";
import { ticketTime } from "./weekView";

/**
 * "This week in New York": a few hand-picked things the founder or an admin
 * adds each week (migration 20261112000000). Signed-in people read the
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

/**
 * The picks that overlap [from, to), soonest first, at most 6. A pick with no
 * end counts as the moment it starts. Unpublished ones never show here.
 */
export function visiblePicks(picks: readonly CityPick[], from: number, to: number, limit = PICKS_MAX): CityPick[] {
  return picks
    .filter((p) => p.published && p.startsAt < to && (p.endsAt ?? p.startsAt) >= from)
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

/** Every pick, drafts included, soonest first. Admins only: anyone else just gets the published ones. */
export async function fetchAllPicks(): Promise<{ picks: (CityPick & { cornerId: number | null })[]; error: string | null }> {
  if (!supabase) return { picks: [], error: null };
  const { data, error } = await supabase.from("city_picks").select(COLUMNS).eq("city", CITY).order("starts_at", { ascending: false }).limit(200);
  if (error) return { picks: [], error: friendlyError(error) };
  return { picks: (data as Record<string, any>[]).map((r) => ({ ...toPick(r), cornerId: (r.corner_id as number | null) ?? null })), error: null };
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
