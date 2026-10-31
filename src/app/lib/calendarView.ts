import { formatDate, formatMonthYear, formatTime, formatWeekday } from "./dates";
import { HOME_TZ, nyParts, nyTimeToMs } from "./homeWeek";
import { blockOccurrences, effectiveFreeTime, MIN_FREE_MS, occurrences, type CalendarEntry, type Occurrence } from "./calendarEntries";
import { plural } from "./plural";
import { cornerColor, type CatColor } from "./categoryStyle";
import type { StubCard } from "./stubs";
import type { PickSlot, StubbyPick } from "./stubbyPicks";
import { dayContents, daysFromToday, windowsAcross, FREE_LABEL, goingLine, planSpan, weekDays, type DayContent, type FreePart, type FreeSlot, type Span, type WeekDay, type WeekPlanDetail } from "./weekView";

/**
 * The calendar (/calendar) as pure functions: which view and date the URL
 * names, the range a person may page through, each view's title and subline,
 * the month grid, the agenda, and the Show filters. Everything is in New York
 * time. The screens only draw what these return.
 */

export type CalendarView = "day" | "week" | "month" | "list";
export const VIEWS: readonly CalendarView[] = ["day", "week", "month", "list"];
export const VIEW_LABEL: Record<CalendarView, string> = { day: "Day", week: "Week", month: "Month", list: "List" };
export const DEFAULT_VIEW: CalendarView = "month";

/** The agenda covers this many days. */
export const LIST_DAYS = 30;
/** How far ahead a person can page. */
export const MONTHS_AHEAD = 3;
const DAY_MS = 86_400_000;

// ---------- the URL ----------

export function parseView(raw: string | null | undefined): CalendarView {
  return (VIEWS as readonly string[]).includes(raw ?? "") ? (raw as CalendarView) : DEFAULT_VIEW;
}

/** "2026-10-31" as noon that day in New York, or null when it is not a real date. */
export function parseDateParam(raw: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = nyTimeToMs(y, mo, d, 12);
  const p = nyParts(ms);
  return p.y === y && p.m === mo && p.d === d ? ms : null;
}

/** Noon in New York on the day `ms` falls on. */
export function noonOf(ms: number): number {
  const p = nyParts(ms);
  return nyTimeToMs(p.y, p.m, p.d, 12);
}

/** "2026-10-31". */
export function dateParam(ms: number): string {
  const p = nyParts(ms);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export const addDays = (ms: number, n: number): number => {
  const p = nyParts(ms);
  return nyTimeToMs(p.y, p.m, p.d + n, 12);
};

/** The first of the month `n` months from `ms`'s month, at noon. */
export const addMonths = (ms: number, n: number): number => {
  const p = nyParts(ms);
  return nyTimeToMs(p.y, p.m + n, 1, 12);
};

// ---------- the range ----------

export interface CalendarRange {
  /** The first moment a person can open: the 1st of the month they signed up. */
  minMs: number;
  /** The end (exclusive) of what a person can open: the end of the month 3 months ahead. */
  maxMs: number;
}

export function calendarRange(now: number, signedUpAt?: number | null): CalendarRange {
  const start = signedUpAt && Number.isFinite(signedUpAt) && signedUpAt < now ? signedUpAt : now;
  const sp = nyParts(start);
  const np = nyParts(now);
  return { minMs: nyTimeToMs(sp.y, sp.m, 1, 0), maxMs: nyTimeToMs(np.y, np.m + MONTHS_AHEAD + 1, 1, 0) };
}

/** Pulls any anchor day into the range (noon of the first or the last day). */
export function clampAnchor(anchor: number, range: CalendarRange): number {
  if (anchor < range.minMs) return noonOf(range.minMs + DAY_MS / 2);
  if (anchor >= range.maxMs) return noonOf(range.maxMs - DAY_MS / 2);
  return anchor;
}

/** The days a view covers, as [startMs, endMs). Month is its own month, not the whole 6 row grid. */
export function viewSpan(view: CalendarView, anchor: number): { startMs: number; endMs: number } {
  const p = nyParts(anchor);
  switch (view) {
    case "day":
      return { startMs: nyTimeToMs(p.y, p.m, p.d, 0), endMs: nyTimeToMs(p.y, p.m, p.d + 1, 0) };
    case "week":
      return { startMs: nyTimeToMs(p.y, p.m, p.d, 0), endMs: nyTimeToMs(p.y, p.m, p.d + 7, 0) };
    case "list":
      return { startMs: nyTimeToMs(p.y, p.m, p.d, 0), endMs: nyTimeToMs(p.y, p.m, p.d + LIST_DAYS, 0) };
    case "month":
      return { startMs: nyTimeToMs(p.y, p.m, 1, 0), endMs: nyTimeToMs(p.y, p.m + 1, 1, 0) };
  }
}

/** The anchor one step before (-1) or after (1) this one. Month steps land on the 1st. */
export function stepAnchor(view: CalendarView, anchor: number, dir: -1 | 1): number {
  switch (view) {
    case "day":
      return addDays(anchor, dir);
    case "week":
      return addDays(anchor, 7 * dir);
    case "list":
      return addDays(anchor, LIST_DAYS * dir);
    case "month":
      return addMonths(anchor, dir);
  }
}

/** Whether the step in that direction still lands inside the range. */
export function canStep(view: CalendarView, anchor: number, dir: -1 | 1, range: CalendarRange): boolean {
  const next = viewSpan(view, stepAnchor(view, anchor, dir));
  return dir < 0 ? next.endMs > range.minMs : next.startMs < range.maxMs;
}

// ---------- titles ----------

const monthTitle = (anchor: number) => {
  const p = nyParts(anchor);
  // The 15th is the same date in every time zone, so the month never slips.
  return formatMonthYear(Date.UTC(p.y, p.m - 1, 15, 12));
};

const short = (ms: number, now: number) => formatDate(ms, { timeZone: HOME_TZ, now });

/** The big title: "October 2026", "Oct 31 to Nov 6", "Tue Nov 3", "Oct 31 to Nov 29". */
export function viewTitle(view: CalendarView, anchor: number, now: number): string {
  if (view === "month") return monthTitle(anchor);
  if (view === "day") return `${formatWeekday(anchor, "short", HOME_TZ)} ${short(anchor, now)}`;
  const { startMs, endMs } = viewSpan(view, anchor);
  return `${short(startMs + DAY_MS / 2, now)} to ${short(endMs - DAY_MS / 2, now)}`;
}

/** The arrow buttons' names: they say which period they move by. */
export const STEP_LABEL: Record<CalendarView, { prev: string; next: string }> = {
  day: { prev: "Previous day", next: "Next day" },
  week: { prev: "Previous week", next: "Next week" },
  month: { prev: "Previous month", next: "Next month" },
  list: { prev: "Previous 30 days", next: "Next 30 days" },
};

/** "8 Stubs · 1 plan to go · New York": a part that is 0 is left out. */
export function monthSubline(stubs: number, plansToGo: number): string {
  return [stubs > 0 ? plural(stubs, "Stub") : null, plansToGo > 0 ? `${plural(plansToGo, "plan")} to go` : null, "New York"].filter(Boolean).join(" · ");
}

/** The line under the title: month counts Stubs and plans to go, week and day count plans, list says how far it reaches. */
export function viewSubline(view: CalendarView, counts: { stubs: number; plans: number; startsToday: boolean }): string {
  if (view === "month") return monthSubline(counts.stubs, counts.plans);
  const lead = view === "week" ? (counts.startsToday ? "Next 7 days" : "7 days") : view === "list" ? "Next 30 days" : null;
  return [lead, view !== "list" && counts.plans > 0 ? plural(counts.plans, "plan") : null, "New York"].filter(Boolean).join(" · ");
}

// ---------- the month grid ----------

/** The 42 days of a Sunday-first, 6 row month grid; the first and last rows spill into the neighbouring months. */
export function monthGridDays(anchor: number): WeekDay[] {
  const p = nyParts(anchor);
  const first = nyTimeToMs(p.y, p.m, 1, 12);
  return weekDays(addDays(first, -nyParts(first).dow), 42);
}

export const inMonth = (day: WeekDay, anchor: number) => {
  const p = nyParts(anchor);
  return day.y === p.y && day.m === p.m;
};

export const sameDay = (day: WeekDay, ms: number) => {
  const p = nyParts(ms);
  return day.y === p.y && day.m === p.m && day.d === p.d;
};

// ---------- what each day holds ----------

export { windowsAcross };

/** A free slot with where it comes from, so tapping it can offer the right changes. */
export interface CalendarFreeSlot extends FreeSlot {
  /** The usual week's windows it overlaps: "sat-eve". */
  usualKeys: string[];
  /** The free entries it overlaps. */
  entryIds: number[];
  /** Stable for the stretch ("2026-11-03:tue-eve"): what Not this is counted against. */
  slotKey: string;
  /** Stubby's pick for it, when one fits (filled in by `withPicks`). */
  pick?: StubbyPick;
}

export interface CalendarDay extends DayContent {
  free: CalendarFreeSlot[];
  /** Stubs issued on this day, newest first. */
  stubs: StubCard[];
  /** The person's blocks that touch this day (a weekly one shows each week). */
  blocks: Occurrence[];
}

const overlaps = (a: Span, b: Span) => a.startMs < b.endMs && a.endMs > b.startMs;

/** The free time of one day, as the slots the screens draw: daytime, evening or all day, and never under an hour. */
function slotsOfDay(day: WeekDay, spans: readonly Span[], windows: readonly string[], entries: readonly CalendarEntry[]): CalendarFreeSlot[] {
  const dayRange = { startMs: day.startMs, endMs: day.endMs };
  const sixPm = nyTimeToMs(day.y, day.m, day.d, 18);
  const sixAm = nyTimeToMs(day.y, day.m, day.d, 6);
  const used = windowsAcross(windows, [day], 0);
  const free = entries.filter((e) => e.kind === "free");
  return spans
    .filter((s) => overlaps(s, dayRange))
    .map((s) => ({ startMs: Math.max(s.startMs, day.startMs), endMs: Math.min(s.endMs, day.endMs) }))
    .filter((s) => s.endMs - s.startMs >= MIN_FREE_MS)
    .map((s) => {
      const part: FreePart = s.endMs <= sixPm ? "day" : s.startMs >= sixPm ? "eve" : "all";
      const keys = [
        ...(s.startMs < sixPm && s.endMs > sixAm ? [`${day.dayKey}-day`] : []),
        ...(s.endMs > sixPm ? [`${day.dayKey}-eve`] : []),
      ];
      return {
        part,
        keys: keys.length > 0 ? keys : [`${day.dayKey}-day`],
        startMs: s.startMs,
        endMs: s.endMs,
        usualKeys: used.filter((w) => overlaps(w, s)).map((w) => w.key),
        entryIds: free.filter((e) => occurrences(e, s.startMs, s.endMs).length > 0).map((e) => e.id),
        slotKey: `${dateParam(day.noonMs)}:${keys[0] ?? `${day.dayKey}-day`}`,
      };
    });
}

/**
 * Each day's plans, free slots, blocks and Stubs. Plans already over stay (the
 * calendar shows the past); free time is only the part still ahead, from the
 * usual week and free entries, minus busy entries, blocks and plans.
 */
export function calendarDays(
  days: readonly WeekDay[],
  plans: readonly WeekPlanDetail[],
  stubs: readonly StubCard[],
  windows: readonly string[],
  now: number,
  entries: readonly CalendarEntry[] = [],
): CalendarDay[] {
  const contents = dayContents(days, plans, [], 0);
  const first = days[0];
  const last = days[days.length - 1];
  const spans = first && last ? effectiveFreeTime({ windows, entries, plans, fromMs: Math.max(first.startMs, now), toMs: last.endMs }) : [];
  const blocks = first && last ? blockOccurrences(entries, first.startMs, last.endMs) : [];
  return contents.map((c) => ({
    ...c,
    free: slotsOfDay(c.day, spans, windows, entries),
    stubs: stubs.filter((s) => s.issuedAt >= c.day.startMs && s.issuedAt < c.day.endMs),
    blocks: blocks.filter((b) => overlaps(b, { startMs: c.day.startMs, endMs: c.day.endMs })),
  }));
}

/** Every free stretch in view, as what Stubby's picks are matched against. */
export const pickSlots = (days: readonly CalendarDay[]): PickSlot[] => days.flatMap((c) => c.free.map((f) => ({ key: f.slotKey, startMs: f.startMs, endMs: f.endMs })));

/** The days with each stretch's pick filled in. A stretch with none keeps `pick` empty, and the screen says Find something. */
export const withPicks = (days: readonly CalendarDay[], picks: ReadonlyMap<string, StubbyPick>): CalendarDay[] =>
  days.map((c) => ({ ...c, free: c.free.map((f) => ({ ...f, pick: picks.get(f.slotKey) })) }));

/** The ids of everything already on the calendar, in the form picks use, so nothing is picked twice. */
export const takenIds = (plans: readonly WeekPlanDetail[]): Set<string> =>
  new Set(plans.flatMap((p) => [p.id.startsWith("event-") ? `event:${p.id.slice(6)}` : "", p.pursuitId ? `pursuit:${p.pursuitId}` : ""].filter(Boolean)));

/** How many plans are still to go from now on. */
export const plansToGo = (plans: readonly WeekPlanDetail[], now: number) => plans.filter((p) => planSpan(p.startsAt, p.endsAt).endMs > now).length;

/** The colour of a Stub: its Corner's, or the default one. */
export const stubColor = (s: Pick<StubCard, "corner">): CatColor => (s.corner ? cornerColor(s.corner.spaceSlug, s.corner.slug) : "orange");

// ---------- the Show filters ----------

export type FilterKey = "plans" | "sessions" | "picks" | "free" | "friends" | "stubs" | "blocks" | "busy";

/** The rows of the Show panel, in order, with their labels and the quiet line under some. */
export const FILTER_ROWS: readonly { key: FilterKey; label: string; hint?: string }[] = [
  { key: "plans", label: "Plans" },
  { key: "sessions", label: "Pursuit sessions" },
  { key: "picks", label: "Stubby’s picks", hint: "Ideas for your free time" },
  { key: "free", label: "Free time" },
  { key: "friends", label: "Friends’ plans", hint: "Only people you know" },
  { key: "stubs", label: "Stubs you collected" },
  { key: "blocks", label: "Your blocks" },
  { key: "busy", label: "Busy times", hint: "From your Google Calendar" },
];

/** The rows that have something behind them today. The rest arrive with their own PRs and stay out of the panel until then. */
export const AVAILABLE_FILTERS: readonly FilterKey[] = ["plans", "sessions", "picks", "free", "stubs", "blocks"];

export type Filters = Record<FilterKey, boolean>;

const ALL_ON: Filters = { plans: true, sessions: true, picks: true, free: true, friends: true, stubs: true, blocks: true, busy: true };

/** Busy times are off in Month and on in Week, Day and List. */
export const defaultFilters = (view: CalendarView): Filters => ({ ...ALL_ON, busy: view !== "month" });

export const FILTERS_KEY = "soosh.calendar.show.v1";

/** What the person chose for this view, over the defaults. Never throws: a blocked or broken store is just the defaults. */
export function loadFilters(view: CalendarView, store: Pick<Storage, "getItem"> | null = safeStore()): Filters {
  const base = defaultFilters(view);
  try {
    const all = JSON.parse(store?.getItem(FILTERS_KEY) ?? "{}") as Record<string, unknown>;
    const mine = all?.[view];
    if (mine && typeof mine === "object") {
      for (const k of Object.keys(base) as FilterKey[]) {
        const v = (mine as Record<string, unknown>)[k];
        if (typeof v === "boolean") base[k] = v;
      }
    }
  } catch {
    // Not JSON, or the store is blocked: the defaults.
  }
  return base;
}

export function saveFilters(view: CalendarView, filters: Filters, store: Pick<Storage, "getItem" | "setItem"> | null = safeStore()): void {
  try {
    if (!store) return;
    let all: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(store.getItem(FILTERS_KEY) ?? "{}");
      if (parsed && typeof parsed === "object") all = parsed;
    } catch {
      all = {};
    }
    store.setItem(FILTERS_KEY, JSON.stringify({ ...all, [view]: filters }));
  } catch {
    // Private mode or a full store: the choice lasts until the page closes.
  }
}

function safeStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** A session of a longer Pursuit. A plan someone made for one day is a small Pursuit with one session, but it is a plan. */
export const isPursuitSession = (p: Pick<WeekPlanDetail, "kind" | "session">): boolean => p.kind === "session" && !!p.session && p.session.total > 1;

/** A day's plans after the Plans and Pursuit sessions filters. */
export const visiblePlans = (c: Pick<DayContent, "plans">, filters: Filters): WeekPlanDetail[] =>
  c.plans.filter((p) => (isPursuitSession(p) ? filters.sessions : filters.plans));

/** The list view: the days that have something to show, in date order. */
export const agendaDays = (days: readonly CalendarDay[], filters: Filters): CalendarDay[] =>
  days.filter((c) => visiblePlans(c, filters).length > 0 || (filters.free && c.free.length > 0) || (filters.stubs && c.stubs.length > 0) || (filters.blocks && c.blocks.length > 0));

// ---------- labels ----------

/** "7 PM", "7:30 PM". */
export const shortTime = (ms: number) => formatTime(ms, HOME_TZ).replace(":00 ", " ");

/** "7 to 10 PM" when both ends share AM or PM, else "11 AM to 1 PM". */
export function timeRange(startMs: number, endMs: number): string {
  const a = shortTime(startMs);
  const b = shortTime(endMs);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} to ${b}` : `${a} to ${b}`;
}

/** The phone's Make a plan button for a day: "Make a plan for tonight", "Make a plan for Sat 31". */
export function makePlanFor(day: WeekDay, now: number): string {
  const diff = daysFromToday(day, now);
  if (diff === 0) return nyParts(now).hour >= 18 ? "Make a plan for tonight" : "Make a plan for today";
  if (diff === 1) return "Make a plan for tomorrow";
  return `Make a plan for ${formatWeekday(day.noonMs, "short", HOME_TZ)} ${day.d}`;
}

/** The heading over a day's list: "Today", "Tomorrow", then the weekday; the date sits beside it. */
export function dayListHeading(day: WeekDay, now: number): string {
  const diff = daysFromToday(day, now);
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : formatWeekday(day.noonMs, "long", HOME_TZ);
}
export const dayListDate = (day: WeekDay, now: number) => short(day.noonMs, now);

// ---------- what a screen reader hears ----------

/** "Plan, 7 PM, Village Halloween Parade, You, Sam and Maya". Pursuit sessions say so. */
export function describePlan(p: WeekPlanDetail): string {
  const who = goingLine(p.going);
  return [isPursuitSession(p) ? "Pursuit session" : "Plan", shortTime(p.startsAt), p.title, who].filter(Boolean).join(", ");
}

/** "Free evening, 6 PM to midnight": the text label that goes with the dashed look. */
export const describeFree = (f: FreeSlot) => `${FREE_LABEL[f.part]}, ${timeRange(f.startMs, f.endMs).replace("to 12 AM", "to midnight")}`;

/** "Block, 9 AM to 5 PM, dentist". */
export const describeBlock = (b: Occurrence) => ["Block", timeRange(b.startMs, b.endMs), b.entry.note].filter(Boolean).join(", ");

/** "Stubby’s pick, 7 to 9 PM, Climbing, Gowanus". */
export const describePick = (p: StubbyPick) => ["Stubby’s pick", timeRange(p.startsAt, p.endsAt), p.title, p.where].filter(Boolean).join(", ");

export const describeStub = (s: StubCard) => `Stub, ${s.title}`;

/** Where a plan opens, when it opens anywhere yet: a Pursuit's session goes to its Pursuit. */
export const planHref = (p: Pick<WeekPlanDetail, "pursuitId">): string | null => (p.pursuitId ? `/pursuit/${p.pursuitId}` : null);
