import { DURATION_LIMITS, cornerMoods, guideMoods, type CornerSetting } from "../data/curatedCorners";
import type { HomeCorner } from "../data/homeCorners";
import { MOODS, type MoodId } from "../data/moods";

/**
 * The three filters on the Corners home (how long, what mood, where), how they
 * sit in a URL (/corners?time=60&mood=make&place=home) and which Corners they
 * keep. Place is exact: a Corner that works anywhere is in neither "At home"
 * nor "Outdoors".
 */
export type Setting = Exclude<CornerSetting, "anywhere">;

export interface Picker {
  duration: number | null;
  mood: MoodId | null;
  setting: Setting | null;
}

export const NO_PICK: Picker = { duration: null, mood: null, setting: null };

export const SETTING_OPTIONS: { id: Setting; label: string }[] = [
  { id: "home", label: "At home" },
  { id: "outdoors", label: "Outdoors" },
];

export const hasPick = (p: Picker) => p.duration !== null || p.mood !== null || p.setting !== null;

/** The filters in a URL's search, or null when it carries none. Anything it cannot read is ignored. */
export function pickerFromParams(sp: URLSearchParams): Picker | null {
  const time = Number(sp.get("time"));
  const mood = sp.get("mood");
  const place = sp.get("place");
  const p: Picker = {
    duration: (DURATION_LIMITS as readonly number[]).includes(time) ? time : null,
    mood: MOODS.some((m) => m.id === mood) ? (mood as MoodId) : null,
    setting: SETTING_OPTIONS.some((o) => o.id === place) ? (place as Setting) : null,
  };
  return hasPick(p) ? p : null;
}

export function paramsFromPicker(p: Picker): URLSearchParams {
  const sp = new URLSearchParams();
  if (p.duration !== null) sp.set("time", String(p.duration));
  if (p.mood !== null) sp.set("mood", p.mood);
  if (p.setting !== null) sp.set("place", p.setting);
  return sp;
}

/**
 * A Corner without a guide has no length, place or mood on record, so a choice on that filter leaves it out.
 * Place is exact: "At home" is home and "Outdoors" is outdoors; a Corner that works anywhere is in neither.
 */
export function matches(c: HomeCorner, p: Picker): boolean {
  const x = c.curated;
  if (p.duration !== null && !(x && x.durationMinutes <= p.duration)) return false;
  if (p.setting !== null && !(x && x.setting === p.setting)) return false;
  if (p.mood !== null) {
    const moods = x ? cornerMoods(x) : guideMoods(c.spaceSlug, c.slug);
    if (!moods.includes(p.mood)) return false;
  }
  return true;
}

