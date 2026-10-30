import { formatTime, formatWeekday } from "./dates";
import { plural } from "./plural";
import { SLOTS, windowKey, type DayKey, type SlotKey } from "./tasteModel";

/**
 * The "Your week" card on Home, as pure functions. Everything is in New York
 * time, like the free windows themselves (Daytime 06:00 to 17:59, Evening from
 * 18:00): the same definition the ranking uses. A window is "left" until it
 * ends: Daytime at 18:00, Evening at midnight.
 */

export const HOME_TZ = "America/New_York";

export interface WeekPlan {
  title: string;
  /** Milliseconds. */
  startsAt: number;
}

interface Parts {
  y: number;
  m: number;
  d: number;
  hour: number;
  /** 0 = Sunday. */
  dow: number;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_KEY_BY_DOW: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: HOME_TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  hourCycle: "h23",
  weekday: "short",
});

/** The year, month, day, hour and weekday of a moment in New York. */
export function nyParts(ms: number): Parts {
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(new Date(ms))) p[part.type] = part.value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    hour: Number(p.hour) % 24,
    dow: WEEKDAY_INDEX[p.weekday] ?? 0,
  };
}

/** The moment a New York wall clock time happens, in milliseconds. */
export function nyTimeToMs(y: number, m: number, d: number, hour: number): number {
  const guess = Date.UTC(y, m - 1, d, hour, 0, 0);
  // Two passes settle the offset across a daylight saving change.
  let ms = guess;
  for (let i = 0; i < 2; i++) {
    const p = nyParts(ms);
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.hour, 0, 0);
    ms += guess - shown;
  }
  return ms;
}

const SLOT_HOURS: Record<SlotKey, [number, number]> = { day: [6, 18], eve: [18, 24] };

export interface WeekWindow {
  key: string;
  day: DayKey;
  slot: SlotKey;
  /** Days from today in New York: 0 is today. */
  offset: number;
  startMs: number;
  endMs: number;
}

/** The person's free windows over the next 7 days (today included) that have not ended yet, soonest first. */
export function windowsLeft(windows: readonly string[], now: number): WeekWindow[] {
  if (windows.length === 0) return [];
  const today = nyParts(now);
  const out: WeekWindow[] = [];
  for (let offset = 0; offset < 7; offset++) {
    // Noon avoids any edge of a daylight saving change when stepping days.
    const day = nyParts(Date.UTC(today.y, today.m - 1, today.d + offset, 12));
    const dayKey = DAY_KEY_BY_DOW[day.dow];
    for (const slot of SLOTS) {
      const key = windowKey(dayKey, slot.key);
      if (!windows.includes(key)) continue;
      const [from, to] = SLOT_HOURS[slot.key];
      const startMs = nyTimeToMs(day.y, day.m, day.d, from);
      const endMs = to === 24 ? nyTimeToMs(day.y, day.m, day.d + 1, 0) : nyTimeToMs(day.y, day.m, day.d, to);
      if (endMs > now) out.push({ key, day: dayKey, slot: slot.key, offset, startMs, endMs });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

/** "2 free windows left · 1 plan". The plan part only when there is one or more; the person decides, so "0 free windows left" is shown as is. */
export function weekLine(windowCount: number, planCount: number): string {
  const free = `${plural(windowCount, "free window")} left`;
  return planCount > 0 ? `${free} · ${plural(planCount, "plan")}` : free;
}

export interface WeekChip {
  /** "Thu 30". */
  heading: string;
  /** "Free evening", "Free all day", "Free daytime", or a plan: "Bouldering 7 PM". */
  line: string;
  plan: boolean;
}

/** "7:00 PM" shown as "7 PM"; "7:30 PM" stays. */
const shortTime = (ms: number) => formatTime(ms, HOME_TZ).replace(":00 ", " ");

const PLAN_TITLE_MAX = 16;
const shortTitle = (t: string) => {
  const s = t.replace(/\s+/g, " ").trim();
  return s.length <= PLAN_TITLE_MAX ? s : `${s.slice(0, PLAN_TITLE_MAX - 1).trimEnd()}…`;
};

/**
 * The next 3 days, today first, one chip each that has something to say: a plan
 * (its short title and time) or the free part of the day. A day with neither
 * has no chip.
 */
export function weekChips(windows: readonly string[], plans: readonly WeekPlan[], now: number): WeekChip[] {
  const today = nyParts(now);
  const left = windowsLeft(windows, now);
  const chips: WeekChip[] = [];
  for (let offset = 0; offset < 3; offset++) {
    const day = nyParts(Date.UTC(today.y, today.m - 1, today.d + offset, 12));
    const noon = nyTimeToMs(day.y, day.m, day.d, 12);
    const heading = `${formatWeekday(noon, "short", HOME_TZ)} ${day.d}`;
    const plan = plans
      .filter((p) => p.startsAt > now)
      .filter((p) => {
        const pp = nyParts(p.startsAt);
        return pp.y === day.y && pp.m === day.m && pp.d === day.d;
      })
      .sort((a, b) => a.startsAt - b.startsAt)[0];
    if (plan) {
      chips.push({ heading, line: `${shortTitle(plan.title)} ${shortTime(plan.startsAt)}`, plan: true });
      continue;
    }
    const slots = new Set(left.filter((w) => w.offset === offset).map((w) => w.slot));
    if (slots.size === 2) chips.push({ heading, line: "Free all day", plan: false });
    else if (slots.has("eve")) chips.push({ heading, line: "Free evening", plan: false });
    else if (slots.has("day")) chips.push({ heading, line: "Free daytime", plan: false });
  }
  return chips;
}

/** The weekday and part of day for the reason line: "Thursday evening". */
export function windowPhrase(startsAt: number): string | null {
  const p = nyParts(startsAt);
  const part = p.hour >= 18 ? "evening" : p.hour >= 6 ? "daytime" : null;
  return part ? `${formatWeekday(startsAt, "long", HOME_TZ)} ${part}` : null;
}

