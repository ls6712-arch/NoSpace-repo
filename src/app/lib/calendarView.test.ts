import { describe, expect, it } from "vitest";
import {
  agendaDays,
  calendarDays,
  calendarRange,
  canStep,
  clampAnchor,
  dateParam,
  defaultFilters,
  describeFree,
  describePlan,
  FILTERS_KEY,
  loadFilters,
  makePlanFor,
  monthGridDays,
  monthSubline,
  noonOf,
  parseDateParam,
  parseView,
  saveFilters,
  stepAnchor,
  timeRange,
  viewSpan,
  viewSubline,
  viewTitle,
  visiblePlans,
  windowsAcross,
} from "./calendarView";
import { nyTimeToMs } from "./homeWeek";
import type { StubCard } from "./stubs";
import { weekDays, type WeekPlanDetail } from "./weekView";

const ny = (m: number, d: number, h: number, y = 2026) => nyTimeToMs(y, m, d, h);
const NOW = ny(10, 31, 12);

const plan = (over: Partial<WeekPlanDetail> = {}): WeekPlanDetail => ({
  id: "event-1",
  kind: "event",
  title: "Village Halloween Parade",
  startsAt: ny(10, 31, 19),
  endsAt: ny(10, 31, 22),
  color: "blue",
  going: { friends: [{ id: "a", name: "Sam" }, { id: "b", name: "Maya" }], total: 3 },
  ...over,
});

const stub = (over: Partial<StubCard> = {}): StubCard => ({ id: 1, kind: "session", serial: 1, title: "Pottery #2", meta: "", issuedAt: ny(10, 3, 15), ...over });

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
};

describe("the URL", () => {
  it("reads the view, falling back to Month", () => {
    expect(parseView("week")).toBe("week");
    expect(parseView("list")).toBe("list");
    expect(parseView("year")).toBe("month");
    expect(parseView(null)).toBe("month");
  });

  it("reads a real date as noon in New York and refuses a made up one", () => {
    expect(parseDateParam("2026-11-03")).toBe(ny(11, 3, 12));
    expect(parseDateParam("2026-02-31")).toBeNull();
    expect(parseDateParam("11/3/2026")).toBeNull();
    expect(parseDateParam(null)).toBeNull();
  });

  it("writes a date back the way it reads it, across the clock change", () => {
    expect(dateParam(ny(11, 1, 12))).toBe("2026-11-01");
    expect(dateParam(parseDateParam("2026-11-01")!)).toBe("2026-11-01");
    expect(dateParam(noonOf(ny(11, 1, 0) - 1))).toBe("2026-10-31");
  });
});

describe("the range", () => {
  const range = calendarRange(NOW, ny(8, 14, 9));

  it("runs from the 1st of the sign-up month to the end of the month 3 ahead", () => {
    expect(range.minMs).toBe(ny(8, 1, 0));
    expect(range.maxMs).toBe(ny(2, 1, 0, 2027));
  });

  it("starts this month when there is no sign-up date or it is in the future", () => {
    expect(calendarRange(NOW, null).minMs).toBe(ny(10, 1, 0));
    expect(calendarRange(NOW, NOW + 1e9).minMs).toBe(ny(10, 1, 0));
  });

  it("pulls a date outside it back in", () => {
    expect(dateParam(clampAnchor(ny(1, 5, 12), range))).toBe("2026-08-01");
    expect(dateParam(clampAnchor(ny(6, 5, 12, 2027), range))).toBe("2027-01-31");
    expect(clampAnchor(ny(10, 5, 12), range)).toBe(ny(10, 5, 12));
  });

  it("stops the arrows at both ends", () => {
    expect(canStep("month", ny(8, 10, 12), -1, range)).toBe(false);
    expect(canStep("month", ny(9, 10, 12), -1, range)).toBe(true);
    expect(canStep("month", ny(1, 10, 12, 2027), 1, range)).toBe(false);
    expect(canStep("month", ny(12, 10, 12), 1, range)).toBe(true);
    // A week that only partly fits still opens (the page then clamps it to the 1st).
    expect(canStep("week", ny(8, 3, 12), -1, range)).toBe(true);
    expect(canStep("week", ny(8, 1, 12), -1, range)).toBe(false);
    expect(canStep("week", ny(8, 8, 12), -1, range)).toBe(true);
    expect(canStep("day", ny(1, 31, 12, 2027), 1, range)).toBe(false);
  });
});

describe("paging", () => {
  it("moves a day, 7 days, 30 days or a month and lands on the 1st for a month", () => {
    const a = ny(10, 31, 12);
    expect(dateParam(stepAnchor("day", a, 1))).toBe("2026-11-01");
    expect(dateParam(stepAnchor("week", a, 1))).toBe("2026-11-07");
    expect(dateParam(stepAnchor("week", a, -1))).toBe("2026-10-24");
    expect(dateParam(stepAnchor("list", a, 1))).toBe("2026-11-30");
    expect(dateParam(stepAnchor("month", a, 1))).toBe("2026-11-01");
    expect(dateParam(stepAnchor("month", ny(1, 15, 12), -1))).toBe("2025-12-01");
  });

  it("keeps whole days across the clock change on Nov 1", () => {
    const span = viewSpan("week", ny(10, 30, 12));
    expect(span.startMs).toBe(ny(10, 30, 0));
    expect(span.endMs).toBe(ny(11, 6, 0));
    expect(viewSpan("day", ny(11, 1, 12)).endMs - viewSpan("day", ny(11, 1, 12)).startMs).toBe(25 * 3_600_000);
  });
});

describe("titles", () => {
  it("names each view", () => {
    expect(viewTitle("month", ny(10, 31, 12), NOW)).toBe("October 2026");
    expect(viewTitle("week", ny(10, 31, 12), NOW)).toBe("Oct 31 to Nov 6");
    expect(viewTitle("day", ny(11, 3, 12), NOW)).toBe("Tue Nov 3");
    expect(viewTitle("list", ny(10, 31, 12), NOW)).toBe("Oct 31 to Nov 29");
  });

  it("names the month right even on its first and last day", () => {
    expect(viewTitle("month", ny(11, 1, 12), NOW)).toBe("November 2026");
    expect(viewTitle("month", ny(10, 31, 12), NOW)).toBe("October 2026");
  });

  it("puts the year on a date that is not this year", () => {
    expect(viewTitle("week", ny(12, 29, 12), NOW)).toBe("Dec 29 to Jan 4, 2027");
  });

  it("leaves out a part of the month subline that is 0 and uses plural()", () => {
    expect(monthSubline(8, 1)).toBe("8 Stubs · 1 plan to go · New York");
    expect(monthSubline(1, 2)).toBe("1 Stub · 2 plans to go · New York");
    expect(monthSubline(0, 1)).toBe("1 plan to go · New York");
    expect(monthSubline(3, 0)).toBe("3 Stubs · New York");
    expect(monthSubline(0, 0)).toBe("New York");
  });

  it("sublines the other views", () => {
    expect(viewSubline("week", { stubs: 0, plans: 3, startsToday: true })).toBe("Next 7 days · 3 plans · New York");
    expect(viewSubline("week", { stubs: 0, plans: 0, startsToday: false })).toBe("7 days · New York");
    expect(viewSubline("day", { stubs: 0, plans: 1, startsToday: true })).toBe("1 plan · New York");
    expect(viewSubline("list", { stubs: 0, plans: 4, startsToday: true })).toBe("Next 30 days · New York");
  });
});

describe("the month grid", () => {
  it("is 42 days, Sunday first, and holds the whole month", () => {
    const days = monthGridDays(ny(10, 31, 12));
    expect(days).toHaveLength(42);
    expect(days[0].dayKey).toBe("sun");
    expect([days[0].m, days[0].d]).toEqual([9, 27]);
    expect(days.filter((d) => d.m === 10)).toHaveLength(31);
    expect([days[41].m, days[41].d]).toEqual([11, 7]);
  });

  it("starts on the 1st when the month does", () => {
    const days = monthGridDays(ny(11, 15, 12));
    expect([days[0].m, days[0].d]).toEqual([11, 1]);
  });
});

describe("what each day holds", () => {
  const days = weekDays(NOW, 7);

  it("lays the usual free windows over any days, not only this week", () => {
    const next = weekDays(ny(11, 7, 12), 7);
    const w = windowsAcross(["sat-eve", "sun-day"], next, NOW);
    expect(w.map((x) => [x.key, x.offset])).toEqual([["sat-eve", 0], ["sun-day", 1]]);
    expect(w[0].startMs).toBe(ny(11, 7, 18));
    expect(w[0].endMs).toBe(ny(11, 8, 0));
  });

  it("keeps a window under way, and leaves out one that is already over", () => {
    expect(windowsAcross(["sat-day", "sat-eve"], days.slice(0, 1), NOW).map((x) => x.key)).toEqual(["sat-day", "sat-eve"]);
    expect(windowsAcross(["sat-day", "sat-eve"], days.slice(0, 1), ny(10, 31, 19)).map((x) => x.key)).toEqual(["sat-eve"]);
  });

  it("puts plans on their day, Stubs on the day they were issued, and keeps plans already over", () => {
    const past = plan({ id: "event-9", title: "Last week", startsAt: ny(10, 3, 19), endsAt: ny(10, 3, 21) });
    const c = calendarDays(monthGridDays(NOW), [plan(), past], [stub()], ["sat-eve"], NOW);
    const oct31 = c.find((x) => x.day.m === 10 && x.day.d === 31)!;
    const oct3 = c.find((x) => x.day.m === 10 && x.day.d === 3)!;
    expect(oct31.plans.map((p) => p.id)).toEqual(["event-1"]);
    expect(oct31.free).toHaveLength(0);
    expect(oct3.plans.map((p) => p.id)).toEqual(["event-9"]);
    expect(oct3.stubs.map((s) => s.title)).toEqual(["Pottery #2"]);
    expect(c.find((x) => x.day.m === 11 && x.day.d === 7)!.free.map((f) => f.part)).toEqual(["eve"]);
  });

  it("merges a free daytime and evening into one all day slot", () => {
    const c = calendarDays(weekDays(ny(11, 7, 12), 1), [], [], ["sat-day", "sat-eve"], NOW);
    expect(c[0].free.map((f) => f.part)).toEqual(["all"]);
  });
});

describe("the Show filters", () => {
  it("defaults everything on, and Busy times off only in Month", () => {
    expect(defaultFilters("month").busy).toBe(false);
    expect(defaultFilters("week").busy).toBe(true);
    expect(defaultFilters("day").busy).toBe(true);
    expect(defaultFilters("list").busy).toBe(true);
    expect(defaultFilters("month").plans).toBe(true);
  });

  it("saves a choice per view and reads it back over the defaults", () => {
    const store = memory();
    saveFilters("month", { ...defaultFilters("month"), free: false }, store);
    expect(loadFilters("month", store).free).toBe(false);
    expect(loadFilters("week", store).free).toBe(true);
    saveFilters("week", { ...defaultFilters("week"), stubs: false }, store);
    expect(loadFilters("month", store).free).toBe(false);
    expect(loadFilters("week", store).stubs).toBe(false);
  });

  it("falls back to the defaults for a broken, blocked or odd store", () => {
    expect(loadFilters("week", memory({ [FILTERS_KEY]: "{nope" }))).toEqual(defaultFilters("week"));
    expect(loadFilters("week", memory({ [FILTERS_KEY]: JSON.stringify({ week: { plans: "no", free: false } }) })).plans).toBe(true);
    expect(loadFilters("week", memory({ [FILTERS_KEY]: JSON.stringify({ week: { free: false } }) })).free).toBe(false);
    expect(loadFilters("week", null)).toEqual(defaultFilters("week"));
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadFilters("week", blocked)).toEqual(defaultFilters("week"));
    expect(() => saveFilters("week", defaultFilters("week"), blocked)).not.toThrow();
  });

  it("repairs a store that holds something other than an object", () => {
    const store = memory({ [FILTERS_KEY]: "[1,2]" });
    saveFilters("day", { ...defaultFilters("day"), plans: false }, store);
    expect(loadFilters("day", store).plans).toBe(false);
  });

  it("splits plans from Pursuit sessions", () => {
    const c = { plans: [plan(), plan({ id: "session-2", kind: "session" })] };
    expect(visiblePlans(c, { ...defaultFilters("week"), sessions: false }).map((p) => p.id)).toEqual(["event-1"]);
    expect(visiblePlans(c, { ...defaultFilters("week"), plans: false }).map((p) => p.id)).toEqual(["session-2"]);
    expect(visiblePlans(c, { ...defaultFilters("week"), plans: false, sessions: false })).toEqual([]);
  });

  it("lists in the agenda only days with something showing", () => {
    const days = calendarDays(weekDays(ny(11, 7, 12), 3), [plan({ startsAt: ny(11, 8, 19), endsAt: ny(11, 8, 21) })], [], ["sat-eve"], NOW);
    expect(agendaDays(days, defaultFilters("list")).map((c) => c.day.d)).toEqual([7, 8]);
    expect(agendaDays(days, { ...defaultFilters("list"), free: false }).map((c) => c.day.d)).toEqual([8]);
    expect(agendaDays(days, { ...defaultFilters("list"), free: false, plans: false })).toEqual([]);
  });
});

describe("labels", () => {
  it("says a time range once when AM or PM is shared", () => {
    expect(timeRange(ny(10, 31, 19), ny(10, 31, 22))).toBe("7 to 10 PM");
    expect(timeRange(ny(10, 31, 11), ny(10, 31, 13))).toBe("11 AM to 1 PM");
    expect(timeRange(ny(10, 31, 19), ny(10, 31, 20) + 30 * 60_000)).toBe("7 to 8:30 PM");
  });

  it("describes a plan for a screen reader", () => {
    expect(describePlan(plan())).toBe("Plan, 7 PM, Village Halloween Parade, You, Sam and Maya");
    expect(describePlan(plan({ kind: "session", going: { friends: [], total: 1 } }))).toBe("Pursuit session, 7 PM, Village Halloween Parade");
  });

  it("describes free time in words, not only a dashed look", () => {
    const c = calendarDays(weekDays(ny(11, 7, 12), 1), [], [], ["sat-eve"], NOW);
    expect(describeFree(c[0].free[0])).toBe("Free evening, 6 PM to midnight");
  });

  it("words the phone's Make a plan button for the day", () => {
    const d = (m: number, day: number) => weekDays(ny(m, day, 12), 1)[0];
    expect(makePlanFor(d(10, 31), NOW)).toBe("Make a plan for today");
    expect(makePlanFor(d(10, 31), ny(10, 31, 19))).toBe("Make a plan for tonight");
    expect(makePlanFor(d(11, 1), NOW)).toBe("Make a plan for tomorrow");
    expect(makePlanFor(d(11, 7), NOW)).toBe("Make a plan for Sat 7");
  });
});
