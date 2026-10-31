import { formatWeekday } from "./dates";
import { HOME_TZ, nyParts, nyTimeToMs } from "./homeWeek";
import { shortTime, timeRange } from "./calendarView";
import { isJustYou, type WeekDay, type WeekPlanDetail } from "./weekView";

/**
 * What a tap on the calendar means, as pure functions: which changes a plan
 * offers (brief section 4), the time a tap or a drag on empty hours selects,
 * and the time a plan gets from the sheet. The screens only call these.
 */

// ---------- which changes a thing you tap offers ----------

/**
 * - own: a plan only you are in. Change the time, bring someone, cancel it.
 * - shared: a plan with others made by a Pursuit. Change my time (if it is yours), leave.
 * - pursuit: a session of a longer Pursuit. Move it (if it is yours), skip it.
 * - listing: a host's listing you said yes to. It cannot be moved, only left.
 */
export type PlanKind = "own" | "shared" | "pursuit" | "listing";

export function planKind(plan: Pick<WeekPlanDetail, "kind" | "session" | "mine" | "going">): PlanKind {
  if (plan.kind === "event") return "listing";
  if (plan.session && plan.session.total > 1) return "pursuit";
  return plan.mine && isJustYou(plan.going) ? "own" : "shared";
}

export type PlanAction = "change" | "bring" | "cancel" | "leave" | "move" | "skip";

export function planActions(plan: Pick<WeekPlanDetail, "kind" | "session" | "mine" | "going">): PlanAction[] {
  switch (planKind(plan)) {
    case "own":
      return ["change", "bring", "cancel"];
    case "shared":
      return plan.mine ? ["change", "leave"] : ["leave"];
    case "pursuit":
      return plan.mine ? ["move", "skip"] : ["skip"];
    case "listing":
      return ["leave"];
  }
}

/** Whether dragging moves it: only a plan only you are in. Listings and Pursuit sessions go through the sheet. */
export const isDraggable = (plan: Pick<WeekPlanDetail, "kind" | "session" | "mine" | "going">): boolean => planKind(plan) === "own";

// ---------- a tap or a drag on empty hours ----------

const MIN = 60_000;
export const SNAP_MIN = 15;
export const MIN_RANGE_MIN = 30;

export const snapMs = (ms: number, stepMin = SNAP_MIN): number => Math.round(ms / (stepMin * MIN)) * stepMin * MIN;

/** The moment a pixel row of a day's time grid stands for, snapped to 15 minutes. */
export function timeAtRow(day: Pick<WeekDay, "startMs">, y: number, hourPx: number, startHour: number): number {
  const mins = startHour * 60 + (y / hourPx) * 60;
  return snapMs(day.startMs + mins * MIN);
}

/**
 * A single tap on empty time: from the hour tapped to the end of the part of the
 * day it is in (6 PM, or midnight), and at least 30 minutes.
 */
export function tapRange(day: Pick<WeekDay, "y" | "m" | "d" | "startMs">, tapMs: number): { startMs: number; endMs: number } {
  const p = nyParts(tapMs);
  const startMs = nyTimeToMs(p.y, p.m, p.d, p.hour);
  const sixPm = nyTimeToMs(day.y, day.m, day.d, 18);
  const midnight = nyTimeToMs(day.y, day.m, day.d + 1, 0);
  const endMs = startMs < sixPm ? sixPm : midnight;
  return { startMs, endMs: Math.max(endMs, startMs + MIN_RANGE_MIN * MIN) };
}

/** A drag across empty hours, either way, snapped, and never under 30 minutes. */
export function dragRange(aMs: number, bMs: number): { startMs: number; endMs: number } {
  const startMs = snapMs(Math.min(aMs, bMs));
  const endMs = snapMs(Math.max(aMs, bMs));
  return { startMs, endMs: Math.max(endMs, startMs + MIN_RANGE_MIN * MIN) };
}

// ---------- what the sheets say ----------

/** "Tuesday, 10 PM". */
export const slotTitle = (ms: number): string => `${formatWeekday(ms, "long", HOME_TZ)}, ${shortTime(ms)}`;

/** "10 PM to midnight". */
export const rangeText = (startMs: number, endMs: number): string => timeRange(startMs, endMs).replace(/ to 12 AM$/, " to midnight");

/** "Tuesday" for "Just this Tuesday". */
export const weekdayName = (ms: number): string => formatWeekday(ms, "long", HOME_TZ);

// ---------- the plan sheet's time ----------

export type DayPart = "day" | "eve";

/** What the sheet starts on when nothing is picked: midday for daytime, 7 PM for evening. */
export const DEFAULT_HOUR: Record<DayPart, number> = { day: 12, eve: 19 };

export const partOf = (ms: number): DayPart => (nyParts(ms).hour >= 18 ? "eve" : "day");

/** "19:30" as hours and minutes, or null for anything else. */
export function parseClock(text: string): { h: number; min: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? { h, min } : null;
}

/** The moment a plan starts: the day, then the exact time if one was typed, else the part of the day's default hour. */
export function planStartsAt(day: Pick<WeekDay, "y" | "m" | "d">, part: DayPart, exact?: string): number {
  const c = exact ? parseClock(exact) : null;
  return c ? nyTimeToMs(day.y, day.m, day.d, c.h) + c.min * MIN : nyTimeToMs(day.y, day.m, day.d, DEFAULT_HOUR[part]);
}

/** "19:30" for an input's value. */
export function clockOf(ms: number): string {
  const p = nyParts(ms);
  const min = Math.round((ms - nyTimeToMs(p.y, p.m, p.d, p.hour)) / MIN);
  return `${String(p.hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
