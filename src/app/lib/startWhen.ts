import { formatTime, formatWeekday } from "./dates";
import { partOf, planStartsAt, type DayPart } from "./calendarActions";
import { HOME_TZ, nyParts } from "./homeWeek";
import { weekDays } from "./weekView";

/**
 * The When choice on the Start page: Now, Tonight, Tomorrow or a day. Pure, so
 * the page and its tests agree on what each choice means. Times are New York
 * wall clock, like the rest of the calendar.
 */

export type WhenChoice = "now" | "tonight" | "tomorrow" | "day";

/** Daytime before 5 PM, Evening after: what Tomorrow and Pick a day start on. */
export const defaultPart = (now: number): DayPart => (nyParts(now).hour >= 17 ? "eve" : "day");

export interface WhenInput {
  choice: WhenChoice | null;
  part: DayPart;
  /** Any moment on the chosen day, for Pick a day. */
  dayMs?: number;
  /** "19:30", optional. */
  exact?: string;
  now: number;
}

/** When the plan starts, or null for Now and for nothing chosen yet. */
export function whenToStartsAt(i: WhenInput): number | null {
  if (!i.choice || i.choice === "now") return null;
  if (i.choice === "tonight") return planStartsAt(weekDays(i.now, 1)[0], "eve", i.exact);
  if (i.choice === "tomorrow") return planStartsAt(weekDays(i.now, 2)[1], i.part, i.exact);
  return planStartsAt(weekDays(i.dayMs ?? i.now, 1)[0], i.part, i.exact);
}

/** "Thu evening", or "Thu, 7:30 PM" when an exact time was given. */
export function whenShort(startsAt: number, exact?: boolean): string {
  const day = formatWeekday(startsAt, "short", HOME_TZ);
  return exact ? `${day}, ${formatTime(startsAt, HOME_TZ)}` : `${day} ${partOf(startsAt) === "eve" ? "evening" : "daytime"}`;
}

/** "Thursday evening", for a message to a friend. */
export function whenLong(startsAt: number, exact?: boolean): string {
  const day = formatWeekday(startsAt, "long", HOME_TZ);
  return exact ? `${day} at ${formatTime(startsAt, HOME_TZ)}` : `${day} ${partOf(startsAt) === "eve" ? "evening" : "daytime"}`;
}

/** True when the plan's time is today in New York (the day the plan opens as "Done? Log it"). */
export function isOnOrAfterDay(startsAt: number, now: number): boolean {
  const a = nyParts(startsAt);
  const b = nyParts(now);
  return Date.UTC(b.y, b.m - 1, b.d) >= Date.UTC(a.y, a.m - 1, a.d);
}


/** "Thu · Evening", or "Thu · 7:30 PM" when the time is not one of the two defaults. */
export function plannedLabel(startsAt: number): string {
  const p = nyParts(startsAt);
  const day = formatWeekday(startsAt, "short", HOME_TZ);
  const usual = (p.hour === 19 || p.hour === 12) && formatTime(startsAt, HOME_TZ).includes(":00 ");
  return `${day} · ${usual ? (partOf(startsAt) === "eve" ? "Evening" : "Daytime") : formatTime(startsAt, HOME_TZ)}`;
}
