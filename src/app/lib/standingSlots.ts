import { supabase } from "../../lib/supabase";
import { formatTime, formatWeekday } from "./dates";
import { friendlyError } from "./friendlyError";
import type { IdeaSpend } from "../data/cornerIdeas";

/**
 * Standing slots: things that repeat every week ("Every Thursday, 7:00 PM"), the table
 * behind Tonight (supabase/migrations/20261119000000_standing_slots.sql). Read by anyone
 * signed in once verified within stale_days; written by admins and the host of the slot's Space.
 */
export type SlotMode = "do" | "watch";

export interface StandingSlot {
  id: number;
  cornerSlug: string;
  title: string;
  placeName: string;
  area: string;
  city: string;
  /** 0 to 6, Sunday = 0, as JavaScript's getDay(). */
  weekday: number;
  /** "19:00", the venue's wall clock. */
  startTime: string;
  endTime: string | null;
  tz: string;
  spend: IdeaSpend;
  mode: SlotMode;
  sourceUrl: string | null;
  spaceId: string | null;
  active: boolean;
  lastVerifiedAt: string;
}

export interface SlotInput {
  cornerSlug: string;
  title: string;
  placeName: string;
  area: string;
  weekday: number;
  startTime: string;
  endTime: string;
  spend: IdeaSpend;
  mode: SlotMode;
  sourceUrl: string;
  active: boolean;
}

/** Same number the database falls back to; the live value is app_config standing_slots_v1.stale_days. */
export const DEFAULT_STALE_DAYS = 60;
/** A key from the fixed city list (docs/city-keys-plan.md): every NYC borough is new-york-ny. */
export const SLOT_CITY = "new-york-ny";
export const SLOT_TZ = "America/New_York";

export const SLOT_COPY = {
  title: "Weekly schedule",
  line: "Things that happen every week. Tonight shows the ones verified in the last 60 days.",
  add: "Add a weekly time",
  edit: "Edit weekly time",
  verifiedToday: "Verified today",
  noAccessTitle: "Nothing here for you",
  noAccessBody: "This screen is for whoever manages the weekly schedule.",
  emptyTitle: "No weekly times yet.",
  emptyBody: "Add one, then verify it again when you check it.",
  deleteBody: "This removes the weekly time for good.",
  stale: "Needs checking",
  off: "Off",
  // Space page, host only.
  spaceTitle: "Weekly times",
  spaceLine: "Something you do every week, like Every Thursday, 7:00 PM.",
  spaceEmpty: "No weekly times yet.",
} as const;

/** "Thursday", for weekday 4. Built from a fixed date so no timezone can move it. */
export function weekdayName(weekday: number): string {
  // 2000-01-02 was a Sunday.
  return formatWeekday(new Date(2000, 0, 2 + (((weekday % 7) + 7) % 7)), "long");
}

/** "19:00" or "19:00:00" to "7:00 PM". Empty for anything that isn't a time. */
export function clockLabel(time: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time ?? "");
  if (!m) return "";
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return "";
  return formatTime(new Date(2000, 0, 1, h, min));
}

/** "Every Thursday, 7:00 PM". */
export function slotWhen(s: Pick<StandingSlot, "weekday" | "startTime">): string {
  return `Every ${weekdayName(s.weekday)}, ${clockLabel(s.startTime)}`;
}

/** True while the slot is on and was verified within `staleDays` of `now` (ms). */
export function isFresh(s: Pick<StandingSlot, "active" | "lastVerifiedAt">, now: number, staleDays = DEFAULT_STALE_DAYS): boolean {
  if (!s.active) return false;
  const at = Date.parse(s.lastVerifiedAt);
  return Number.isFinite(at) && now - at <= staleDays * 86_400_000;
}

export const BLANK_SLOT: SlotInput = {
  cornerSlug: "",
  title: "",
  placeName: "",
  area: "",
  weekday: 4,
  startTime: "19:00",
  endTime: "",
  spend: "free",
  mode: "do",
  sourceUrl: "",
  active: true,
};

/** What is wrong with a slot, in plain words, or null. The database checks the same things. */
export function slotProblem(i: SlotInput): string | null {
  if (!i.cornerSlug.trim()) return "Pick a Corner.";
  if (!i.title.trim()) return "Add a title.";
  if (i.title.trim().length > 80) return "Keep the title to 80 characters.";
  if (!i.placeName.trim()) return "Add the place.";
  if (i.placeName.trim().length > 80) return "Keep the place to 80 characters.";
  if (!i.area.trim()) return "Add the neighborhood.";
  if (i.area.trim().length > 60) return "Keep the neighborhood to 60 characters.";
  if (!Number.isInteger(i.weekday) || i.weekday < 0 || i.weekday > 6) return "Pick a day.";
  if (!clockLabel(i.startTime)) return "Add a start time.";
  if (i.endTime && !clockLabel(i.endTime)) return "That end time doesn't look right.";
  if (i.sourceUrl.trim() && !/^https:\/\/\S+$/i.test(i.sourceUrl.trim())) return "The link needs to start with https://.";
  if (i.sourceUrl.trim().length > 500) return "That link is too long.";
  return null;
}

export function toInput(s: StandingSlot): SlotInput {
  return {
    cornerSlug: s.cornerSlug,
    title: s.title,
    placeName: s.placeName,
    area: s.area,
    weekday: s.weekday,
    startTime: s.startTime.slice(0, 5),
    endTime: s.endTime ? s.endTime.slice(0, 5) : "",
    spend: s.spend,
    mode: s.mode,
    sourceUrl: s.sourceUrl ?? "",
    active: s.active,
  };
}

function rowFor(i: SlotInput) {
  return {
    corner_slug: i.cornerSlug.trim(),
    title: i.title.trim(),
    place_name: i.placeName.trim(),
    area: i.area.trim(),
    weekday: i.weekday,
    start_time: i.startTime,
    end_time: i.endTime || null,
    spend: i.spend,
    mode: i.mode,
    source_url: i.sourceUrl.trim() || null,
    active: i.active,
  };
}

export function toSlot(r: Record<string, any>): StandingSlot {
  return {
    id: r.id as number,
    cornerSlug: r.corner_slug as string,
    title: r.title as string,
    placeName: r.place_name as string,
    area: r.area as string,
    city: r.city as string,
    weekday: r.weekday as number,
    startTime: String(r.start_time ?? "").slice(0, 5),
    endTime: r.end_time ? String(r.end_time).slice(0, 5) : null,
    tz: r.tz as string,
    spend: r.spend as IdeaSpend,
    mode: r.mode as SlotMode,
    sourceUrl: (r.source_url as string | null) ?? null,
    spaceId: (r.space_id as string | null) ?? null,
    active: !!r.active,
    lastVerifiedAt: r.last_verified_at as string,
  };
}

const COLUMNS = "id, corner_slug, title, place_name, area, city, weekday, start_time, end_time, tz, spend, mode, source_url, space_id, active, last_verified_at";

/** Every slot the caller may see (an admin sees all; a host sees their Space's). */
export async function fetchSlots(spaceId?: string): Promise<{ slots: StandingSlot[]; error: string | null }> {
  if (!supabase) return { slots: [], error: null };
  let q = supabase.from("standing_slots").select(COLUMNS).eq("city", SLOT_CITY).order("weekday").order("start_time").limit(1000);
  if (spaceId) q = q.eq("space_id", spaceId);
  const { data, error } = await q;
  if (error) return { slots: [], error: friendlyError(error) };
  return { slots: (data as Record<string, any>[]).map(toSlot), error: null };
}

/** The live stale_days, or the default when the config can't be read. */
export async function fetchStaleDays(): Promise<number> {
  if (!supabase) return DEFAULT_STALE_DAYS;
  try {
    const { data } = await supabase.from("app_config").select("value").eq("key", "standing_slots_v1").maybeSingle();
    const n = (data?.value as { stale_days?: unknown } | null)?.stale_days;
    return typeof n === "number" && n > 0 ? n : DEFAULT_STALE_DAYS;
  } catch {
    return DEFAULT_STALE_DAYS;
  }
}

/** Save a new slot (spaceId set for a host's Space, omitted for an admin's) or edit one. */
export async function saveSlot(input: SlotInput, opts: { id?: number; spaceId?: string } = {}): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const problem = slotProblem(input);
  if (problem) return { error: problem };
  const { error } =
    opts.id === undefined
      ? await supabase.from("standing_slots").insert({ ...rowFor(input), city: SLOT_CITY, tz: SLOT_TZ, space_id: opts.spaceId ?? null })
      : await supabase.from("standing_slots").update(rowFor(input)).eq("id", opts.id);
  return { error: error ? friendlyError(error) : null };
}

/** "Verified today": the database sets the time, nobody types a date. */
export async function verifySlot(id: number): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("standing_slots").update({ last_verified_at: new Date().toISOString() }).eq("id", id);
  return { error: error ? friendlyError(error) : null };
}

export async function deleteSlot(id: number): Promise<{ error: string | null }> {
  if (!supabase) return { error: null };
  const { error } = await supabase.from("standing_slots").delete().eq("id", id);
  return { error: error ? friendlyError(error) : null };
}

/** The admin list's filters: a Corner slug and a neighborhood, both optional, case-insensitive. */
export function filterSlots(slots: StandingSlot[], f: { corner?: string; area?: string }): StandingSlot[] {
  const corner = f.corner?.trim().toLowerCase();
  const area = f.area?.trim().toLowerCase();
  return slots.filter((s) => (!corner || s.cornerSlug === corner) && (!area || s.area.toLowerCase().includes(area)));
}
