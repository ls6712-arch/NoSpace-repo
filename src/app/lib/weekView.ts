import { formatDate, formatWeekday } from "./dates";
import { HOME_TZ, nyParts, nyTimeToMs, type WeekPlan, type WeekWindow } from "./homeWeek";
import { plural } from "./plural";
import { BUDGETS, DAYS, SLOTS, windowKey, type Budget, type DayKey, type Pass } from "./tasteModel";
import type { CatColor } from "./categoryStyle";
import { affordable, parsePrice, passFor, type LiveEventInput, type LivePursuitInput } from "./firstPlan";

/**
 * The Week view as pure functions: the seven days, what each day holds, the
 * good-plan-hours number, the budget line and the friends line. Everything is
 * in New York time, like the free windows (Daytime 06:00 to 17:59, Evening
 * from 18:00). The screen only draws what these return.
 */

const HOUR = 3_600_000;
/** A listing or session with no end blocks out this long. */
export const DEFAULT_PLAN_HOURS = 2;

// ---------- the plan, in detail ----------

export interface WeekGoing {
  /** The viewer's connections who are going, at most as many as are shown. */
  friends: { id: string; name: string; avatarUrl?: string }[];
  /** Everyone going that the viewer can see, the viewer included. */
  total: number;
}

/** What Home's card knows (`WeekPlan`) plus what the Week view draws. */
export interface WeekPlanDetail extends WeekPlan {
  /** Stable: "event-12" or "session-7". */
  id: string;
  kind: "event" | "session";
  endsAt?: number | null;
  place?: string;
  /** The host's own words ("$12", "Free"). Left out when unknown. */
  price?: string | null;
  /** The Corner as "space-slug/corner-slug", when it has one. */
  cornerKey?: string;
  color: CatColor;
  /** A Pursuit's session: "4 of 5". Left out for a one-session plan. */
  session?: { n: number; total: number };
  pursuitId?: string;
  /** Whether the viewer owns the Pursuit, so "Bring someone" can make its link. */
  mine?: boolean;
  going: WeekGoing;
}

// ---------- the seven days ----------

export interface WeekDay {
  /** Days from today in New York: 0 is today. */
  offset: number;
  y: number;
  m: number;
  d: number;
  dayKey: DayKey;
  startMs: number;
  endMs: number;
  /** Noon, for formatting a date without any edge of a time change. */
  noonMs: number;
}

const DAY_KEY_BY_DOW: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** `count` days from today in New York, today first. */
export function weekDays(now: number, count = 7): WeekDay[] {
  const today = nyParts(now);
  const out: WeekDay[] = [];
  for (let offset = 0; offset < count; offset++) {
    const noonMs = Date.UTC(today.y, today.m - 1, today.d + offset, 12);
    const p = nyParts(noonMs);
    out.push({
      offset,
      y: p.y,
      m: p.m,
      d: p.d,
      dayKey: DAY_KEY_BY_DOW[p.dow],
      startMs: nyTimeToMs(p.y, p.m, p.d, 0),
      endMs: nyTimeToMs(p.y, p.m, p.d + 1, 0),
      noonMs: nyTimeToMs(p.y, p.m, p.d, 12),
    });
  }
  return out;
}

/** The day of the week (0 to count) a moment falls on, or -1 when it is outside. */
export function dayIndexOf(ms: number, days: readonly WeekDay[]): number {
  return days.findIndex((d) => ms >= d.startMs && ms < d.endMs);
}

/** "Fri Oct 30 to Thu Nov 5". */
export function rangeLine(days: readonly WeekDay[], now: number): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return "";
  const label = (d: WeekDay) => `${formatWeekday(d.noonMs, "short", HOME_TZ)} ${formatDate(d.noonMs, { timeZone: HOME_TZ, now })}`;
  return `${label(first)} to ${label(last)}`;
}

/** Whole days from today to this day (0 is today), in New York. A week that starts on another day still counts from today. */
export function daysFromToday(day: WeekDay, now: number): number {
  const t = nyParts(now);
  return Math.round((day.noonMs - nyTimeToMs(t.y, t.m, t.d, 12)) / 86_400_000);
}

/** "Tonight" (from 6 PM), "Today", "Tomorrow", then the weekday's name. */
export function dayHeading(day: WeekDay, now: number): string {
  const diff = daysFromToday(day, now);
  if (diff === 0) return nyParts(now).hour >= 18 ? "Tonight" : "Today";
  if (diff === 1) return "Tomorrow";
  return formatWeekday(day.noonMs, "long", HOME_TZ);
}

/** "Oct 31", the muted date beside a heading. */
export const dayDate = (day: WeekDay, now: number) => formatDate(day.noonMs, { timeZone: HOME_TZ, now });

/** The strip tile's two lines: "Sat" and "31". */
export const tileParts = (day: WeekDay) => ({ weekday: formatWeekday(day.noonMs, "short", HOME_TZ), date: String(day.d) });

// ---------- free slots and what each day holds ----------

/** The person's free windows over the given days that have not ended yet. `offset` is the day's index in `days`, so `dayContents` can match them. */
export function windowsAcross(windows: readonly string[], days: readonly WeekDay[], now: number): WeekWindow[] {
  if (windows.length === 0) return [];
  const out: WeekWindow[] = [];
  for (const day of days) {
    for (const slot of SLOTS) {
      const key = windowKey(day.dayKey, slot.key);
      if (!windows.includes(key)) continue;
      const startMs = nyTimeToMs(day.y, day.m, day.d, slot.key === "day" ? 6 : 18);
      const endMs = slot.key === "day" ? nyTimeToMs(day.y, day.m, day.d, 18) : day.endMs;
      if (endMs > now) out.push({ key, day: day.dayKey, slot: slot.key, offset: day.offset, startMs, endMs });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}


export type FreePart = "day" | "eve" | "all";

export interface FreeSlot {
  part: FreePart;
  /** Window keys it covers, daytime first: "sat-day", "sat-eve". */
  keys: string[];
  startMs: number;
  endMs: number;
}

export const FREE_LABEL: Record<FreePart, string> = { day: "Free daytime", eve: "Free evening", all: "Free all day" };

export interface DayContent {
  day: WeekDay;
  plans: WeekPlanDetail[];
  free: FreeSlot[];
}

const planEnd = (p: WeekPlanDetail) => p.endsAt ?? p.startsAt + DEFAULT_PLAN_HOURS * HOUR;

/**
 * What each day holds: its plans (soonest first, the ones already over left
 * out) and its free windows that have no plan in them. When both the daytime
 * and the evening are free they become one "Free all day" slot.
 */
export function dayContents(days: readonly WeekDay[], plans: readonly WeekPlanDetail[], left: readonly WeekWindow[], now: number): DayContent[] {
  return days.map((day) => {
    const mine = plans.filter((p) => p.startsAt >= day.startMs && p.startsAt < day.endMs && planEnd(p) > now).sort((a, b) => a.startsAt - b.startsAt);
    const open = left
      .filter((w) => w.offset === day.offset)
      .filter((w) => !mine.some((p) => p.startsAt >= w.startMs && p.startsAt < w.endMs));
    const day_ = open.find((w) => w.slot === "day");
    const eve = open.find((w) => w.slot === "eve");
    const free: FreeSlot[] = [];
    if (day_ && eve) free.push({ part: "all", keys: [day_.key, eve.key], startMs: day_.startMs, endMs: eve.endMs });
    else if (day_) free.push({ part: "day", keys: [day_.key], startMs: day_.startMs, endMs: day_.endMs });
    else if (eve) free.push({ part: "eve", keys: [eve.key], startMs: eve.startMs, endMs: eve.endMs });
    return { day, plans: mine, free };
  });
}

/** The strip tile's mark: a plan wins over free time. */
export const dayMark = (c: DayContent): "plan" | "free" | "none" => (c.plans.length > 0 ? "plan" : c.free.length > 0 ? "free" : "none");

/** "Saturday 31, 1 plan, free daytime". */
export function tileLabel(c: DayContent, now: number): string {
  const name = daysFromToday(c.day, now) === 0 ? "Today" : formatWeekday(c.day.noonMs, "long", HOME_TZ);
  const parts = [`${name} ${c.day.d}`];
  if (c.plans.length > 0) parts.push(plural(c.plans.length, "plan"));
  if (c.free.length > 0) parts.push(FREE_LABEL[c.free[0].part].toLowerCase());
  if (parts.length === 1) parts.push("nothing on");
  return parts.join(", ");
}

/** "Mon 2 · Nothing on". */
export const nothingOnLine = (day: WeekDay) => `${formatWeekday(day.noonMs, "short", HOME_TZ)} ${day.d} · Nothing on`;

/** Weekdays that have an evening in the saved windows, in week order starting Monday: "Thu", "Fri". */
export function freeEvenings(windows: readonly string[]): string[] {
  return DAYS.filter((d) => windows.includes(`${d.key}-eve`)).map((d) => d.short);
}

/** The Discover link for a free slot: the first window it covers. */
export const findSomethingPath = (slot: FreeSlot) => `/discover?window=${encodeURIComponent(slot.keys[0])}`;

// ---------- good plan hours ----------

export interface Span {
  startMs: number;
  endMs: number;
}

/** Sorted and merged: overlapping or touching spans become one. Empty and backwards spans are dropped. */
export function mergeSpans(spans: readonly Span[]): Span[] {
  const sorted = spans.filter((s) => s.endMs > s.startMs).sort((a, b) => a.startMs - b.startMs);
  const out: Span[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.startMs <= last.endMs) last.endMs = Math.max(last.endMs, s.endMs);
    else out.push({ ...s });
  }
  return out;
}

/** A listing or session as time to block out: its own end, else 2 hours. */
export const planSpan = (startMs: number, endMs?: number | null): Span => ({ startMs, endMs: endMs && endMs > startMs ? endMs : startMs + DEFAULT_PLAN_HOURS * HOUR });

/**
 * The hours inside the person's free time that are covered by something they
 * could actually go to. Candidates are merged first (two overlapping listings
 * are one stretch of time, not two), clipped to the free spans, summed and
 * rounded down. 0 means there is nothing to say: the screen then hides the
 * line rather than show a made-up number.
 */
export function goodPlanHours(free: readonly Span[], candidates: readonly Span[]): number {
  const f = mergeSpans(free);
  const c = mergeSpans(candidates);
  let ms = 0;
  for (const a of f) {
    for (const b of c) {
      const start = Math.max(a.startMs, b.startMs);
      const end = Math.min(a.endMs, b.endMs);
      if (end > start) ms += end - start;
    }
  }
  return Math.floor(ms / HOUR);
}

/**
 * What the person could actually go to: listings and open Pursuit sessions in
 * their picked Corners (the fetch only looks there) that fit their budget.
 * A listing blocks out its own length, a session 2 hours.
 */
export function candidateSpans(input: { events: readonly LiveEventInput[]; pursuits: readonly LivePursuitInput[]; budget: number | null; passes: readonly Pass[] }): Span[] {
  const spans: Span[] = [];
  for (const e of input.events) {
    const hasPass = !!passFor(e.cornerKey.split("/")[1] ?? "", input.passes);
    if (!affordable(input.budget, parsePrice(e.price), hasPass)) continue;
    spans.push(planSpan(e.startsAt, e.endsAt));
  }
  for (const p of input.pursuits) spans.push(planSpan(p.startsAt));
  return spans;
}

/** The free windows still to come as time spans; a window already under way starts now. */
export const freeSpans = (left: readonly WeekWindow[], now: number): Span[] => left.map((w) => ({ startMs: Math.max(w.startMs, now), endMs: w.endMs }));

/** "12 good plan hours this week", "1 good plan hour this week". The number is shown big on its own; this is its label. */
export const goodPlanHoursLabel = (n: number) => `good plan ${n === 1 ? "hour" : "hours"} this week`;

// ---------- money ----------

/** A plain price in dollars: "$12", "12" or "$12.50"; "Free" is 0. Anything else ("$12 or pay what you can") is not plain, so null. */
export function plainPrice(text: string | null | undefined): number | null {
  const t = text?.trim();
  if (!t) return null;
  if (/^free$/i.test(t)) return 0;
  const m = /^\$?\s?(\d+(?:\.\d{1,2})?)$/.exec(t);
  return m ? Number(m[1]) : null;
}

/** "$25" or "$12.50". */
export const dollars = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** The nearest allowed budget to any number (a slider position, a stale value). */
export function snapBudget(n: number): Budget {
  return BUDGETS.reduce((best, b) => (Math.abs(b - n) < Math.abs(best - n) ? b : best), BUDGETS[0]);
}

export const budgetIndex = (b: Budget | null) => Math.max(0, BUDGETS.indexOf(b ?? 0));

/** Which pass of the person's covers a plan, by Corner. Only the pairs that are plainly true. */
const PASS_BY_CORNER: Record<string, Pass["kind"]> = { climbing: "climbing", cycling: "bike" };
export function coveringPass(cornerKey: string | undefined, passes: readonly Pass[]): Pass | null {
  const slug = cornerKey?.split("/")[1];
  const kind = slug ? PASS_BY_CORNER[slug] : undefined;
  return kind ? (passes.find((p) => p.kind === kind) ?? null) : null;
}

export interface Spend {
  /** Dollars of plans this month with a plain price. */
  sum: number;
  /** Listings this month that carry no price, and that no pass covers. */
  unpriced: number;
}

/**
 * What this month's plans cost, from their own prices. Only a plain number
 * counts toward the sum. A listing with no price, or words instead of a
 * number, is counted apart. A plan a pass covers is neither. A Pursuit's
 * session has no price to give, so it is not counted at all.
 */
export function monthSpend(plans: readonly WeekPlanDetail[], passes: readonly Pass[], now: number): Spend {
  const p = nyParts(now);
  const start = nyTimeToMs(p.y, p.m, 1, 0);
  const end = nyTimeToMs(p.y, p.m + 1, 1, 0);
  let sum = 0;
  let unpriced = 0;
  for (const plan of plans) {
    if (plan.kind !== "event" || plan.startsAt < start || plan.startsAt >= end) continue;
    if (coveringPass(plan.cornerKey, passes)) continue;
    const price = plainPrice(plan.price);
    if (price === null) unpriced += 1;
    else sum += price;
  }
  return { sum, unpriced };
}

/** The line under the slider. */
export function budgetLine(budget: Budget | null, spend: Spend): string {
  if (!budget) return "Only free plans and ones your pass covers";
  const left = Math.max(0, budget - spend.sum);
  const base = `${dollars(spend.sum)} planned so far · ${dollars(left)} left this month`;
  return spend.unpriced > 0 ? `${base}, plus ${plural(spend.unpriced, "plan")} without a price` : base;
}

/** The price part of a ticket's place line: a pass is named, a price is the host's own words, nothing when unknown (never "$0"). */
export function priceText(plan: Pick<WeekPlanDetail, "price" | "cornerKey">, passes: readonly Pass[]): string | null {
  const pass = coveringPass(plan.cornerKey, passes);
  if (pass) return `your ${pass.label.toLowerCase()} pass`;
  const t = plan.price?.trim();
  return t ? t : null;
}

// ---------- the ticket's lines ----------

/** "7 PM" and "7:30 PM": the big block on a ticket, as two lines. */
export function ticketTime(ms: number): { top: string; bottom: string } {
  const p = nyParts(ms);
  const minutes = Math.round((ms - nyTimeToMs(p.y, p.m, p.d, p.hour)) / 60_000);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return { top: minutes > 0 ? `${h12}:${String(minutes).padStart(2, "0")}` : String(h12), bottom: p.hour >= 12 ? "PM" : "AM" };
}

/** "Pursuit · session 4 of 5", or nothing for a plan that is not part of one. */
export const kindLine = (plan: Pick<WeekPlanDetail, "kind" | "session">): string | null =>
  plan.kind === "session" && plan.session && plan.session.total > 1 ? `Pursuit · session ${plan.session.n} of ${plan.session.total}` : null;

/** "Place, area · price": any part left out when unknown. */
export function placeLine(plan: Pick<WeekPlanDetail, "place" | "price" | "cornerKey">, passes: readonly Pass[]): string {
  return [plan.place?.trim() || null, priceText(plan, passes)].filter(Boolean).join(" · ");
}

const firstName = (name: string) => name.trim().split(/\s+/)[0]?.slice(0, 40) ?? "";

/**
 * Who is going: "You and Priya", or "Priya, Sam and Maya · 4 going" when
 * there are more people than are named. At most 3 are named, and only people
 * the viewer is connected to, never a stranger. Null when it is just the viewer.
 */
export function goingLine(going: WeekGoing): string | null {
  const names = going.friends.slice(0, 3).map((f) => firstName(f.name)).filter(Boolean);
  if (names.length === 0) return null;
  const withYou = going.total <= names.length + 1;
  const list = withYou ? ["You", ...names] : names;
  const joined = list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
  return going.total > list.length ? `${joined} · ${going.total} going` : joined;
}

/** Just the viewer: the ticket offers "Bring someone". */
export const isJustYou = (going: WeekGoing) => going.total <= 1 && going.friends.length === 0;
