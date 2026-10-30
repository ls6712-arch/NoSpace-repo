import { describe, expect, it } from "vitest";
import { nyTimeToMs, windowsLeft } from "./homeWeek";
import type { Pass } from "./tasteModel";
import {
  budgetLine,
  candidateSpans,
  dayContents,
  dayHeading,
  dayIndexOf,
  findSomethingPath,
  freeEvenings,
  goingLine,
  goodPlanHours,
  isJustYou,
  kindLine,
  mergeSpans,
  monthSpend,
  nothingOnLine,
  placeLine,
  plainPrice,
  planSpan,
  rangeLine,
  snapBudget,
  tileLabel,
  ticketTime,
  weekDays,
  type WeekPlanDetail,
} from "./weekView";

const HOUR = 3_600_000;
/** A New York wall clock time. */
const ny = (m: number, d: number, h: number, min = 0) => nyTimeToMs(2026, m, d, h) + min * 60_000;
const span = (startH: number, endH: number) => ({ startMs: startH * HOUR, endMs: endH * HOUR });

const plan = (over: Partial<WeekPlanDetail> = {}): WeekPlanDetail => ({
  id: "event-1",
  kind: "event",
  title: "Bouldering night",
  startsAt: ny(10, 31, 19),
  color: "teal",
  going: { friends: [], total: 1 },
  ...over,
});

describe("goodPlanHours", () => {
  it("counts the hours of a listing inside a free window", () => {
    expect(goodPlanHours([span(18, 24)], [span(19, 21)])).toBe(2);
  });

  it("clips a listing to the free window", () => {
    expect(goodPlanHours([span(18, 21)], [span(17, 23)])).toBe(3);
    expect(goodPlanHours([span(18, 21)], [span(10, 12)])).toBe(0);
  });

  it("counts overlapping listings once", () => {
    expect(goodPlanHours([span(18, 24)], [span(19, 22), span(20, 23)])).toBe(4);
    expect(goodPlanHours([span(18, 24)], [span(19, 21), span(19, 21)])).toBe(2);
  });

  it("adds separate free windows and listings across them", () => {
    expect(goodPlanHours([span(6, 18), span(30, 42)], [span(10, 12), span(31, 33)])).toBe(4);
  });

  it("rounds down to whole hours", () => {
    const half = { startMs: 19 * HOUR, endMs: 20.5 * HOUR };
    expect(goodPlanHours([span(18, 24)], [half])).toBe(1);
    expect(goodPlanHours([span(18, 24)], [{ startMs: 19 * HOUR, endMs: 19.5 * HOUR }])).toBe(0);
  });

  it("is 0 with nothing to go to, so the screen hides the line", () => {
    expect(goodPlanHours([span(18, 24)], [])).toBe(0);
    expect(goodPlanHours([], [span(19, 21)])).toBe(0);
  });

  it("blocks out 2 hours for something with no end", () => {
    const start = 19 * HOUR;
    expect(planSpan(start)).toEqual({ startMs: start, endMs: start + 2 * HOUR });
    expect(planSpan(start, null).endMs - start).toBe(2 * HOUR);
    expect(planSpan(start, start + 3 * HOUR).endMs - start).toBe(3 * HOUR);
    expect(goodPlanHours([span(18, 24)], [planSpan(start)])).toBe(2);
  });

  it("merges touching spans and drops backwards ones", () => {
    expect(mergeSpans([span(1, 3), span(3, 5), span(9, 8)])).toEqual([span(1, 5)]);
  });
});

describe("candidateSpans", () => {
  const climbing: Pass = { id: "p", kind: "climbing", label: "Climbing", place: "" };
  const events = [
    { cornerKey: "sports/climbing", eventId: 1, title: "Climb", startsAt: 100 * HOUR, endsAt: 103 * HOUR, price: "$30", online: false },
    { cornerKey: "art/drawing", eventId: 2, title: "Draw", startsAt: 120 * HOUR, price: "Free", online: false },
    { cornerKey: "art/pottery", eventId: 3, title: "Pots", startsAt: 140 * HOUR, price: "$80", online: false },
  ];
  const pursuits = [{ cornerKey: "art/drawing", pursuitId: "x", title: "Sketch", startsAt: 160 * HOUR, hostName: "Sam" }];

  it("keeps only what fits the budget, with a pass covering its own Corner", () => {
    const spans = candidateSpans({ events, pursuits, budget: 50, passes: [] });
    expect(spans.map((s) => s.startMs / HOUR)).toEqual([100, 120, 160]);
    const free = candidateSpans({ events, pursuits, budget: 0, passes: [climbing] });
    expect(free.map((s) => s.startMs / HOUR)).toEqual([100, 120, 160]);
    const none = candidateSpans({ events, pursuits: [], budget: 0, passes: [] });
    expect(none.map((s) => s.startMs / HOUR)).toEqual([120]);
  });

  it("uses a listing's own end, else 2 hours", () => {
    const spans = candidateSpans({ events, pursuits, budget: 50, passes: [] });
    expect((spans[0].endMs - spans[0].startMs) / HOUR).toBe(3);
    expect((spans[1].endMs - spans[1].startMs) / HOUR).toBe(2);
  });
});

describe("the seven days", () => {
  const now = ny(10, 30, 12);
  const days = weekDays(now);

  it("starts today and runs 7 days, labelled in New York", () => {
    expect(days).toHaveLength(7);
    expect(rangeLine(days, now)).toBe("Fri Oct 30 to Thu Nov 5");
    expect(days.map((d) => d.dayKey)).toEqual(["fri", "sat", "sun", "mon", "tue", "wed", "thu"]);
  });

  it("makes Sunday Nov 1 25 hours long, when the clocks go back", () => {
    const sunday = days[2];
    expect(sunday.d).toBe(1);
    expect((sunday.endMs - sunday.startMs) / HOUR).toBe(25);
    expect(days[1].endMs).toBe(sunday.startMs);
    expect(days[3].startMs).toBe(sunday.endMs);
  });

  it("puts a time after midnight in New York on the next day, though it is already tomorrow in UTC", () => {
    const lateSaturday = ny(10, 31, 23, 30);
    const d = weekDays(lateSaturday);
    expect(d[0].d).toBe(31);
    expect(dayIndexOf(ny(10, 31, 23, 45), d)).toBe(0);
    expect(dayIndexOf(ny(11, 1, 0, 30), d)).toBe(1);
    expect(dayIndexOf(ny(11, 1, 1, 30), d)).toBe(1);
    expect(dayIndexOf(ny(11, 7, 12), d)).toBe(-1);
  });

  it("calls today Tonight from 6 PM and Today before", () => {
    expect(dayHeading(days[0], ny(10, 30, 17, 59))).toBe("Today");
    expect(dayHeading(days[0], ny(10, 30, 18))).toBe("Tonight");
    expect(dayHeading(days[1], now)).toBe("Tomorrow");
    expect(dayHeading(days[2], now)).toBe("Sunday");
  });

  it("reads a quiet day as one line", () => {
    expect(nothingOnLine(days[3])).toBe("Mon 2 · Nothing on");
  });
});

describe("what each day holds", () => {
  const now = ny(10, 30, 12);
  const days = weekDays(now);
  const left = windowsLeft(["fri-eve", "sat-day", "sat-eve", "sun-day"], now);

  it("joins a free daytime and evening into one slot, and a lone one stays", () => {
    const c = dayContents(days, [], left, now);
    expect(c[0].free.map((f) => f.part)).toEqual(["eve"]);
    expect(c[1].free.map((f) => f.part)).toEqual(["all"]);
    expect(c[2].free.map((f) => f.part)).toEqual(["day"]);
    expect(c[3].free).toEqual([]);
  });

  it("drops a free slot that has a plan in it", () => {
    const c = dayContents(days, [plan({ startsAt: ny(10, 31, 19) })], left, now);
    expect(c[1].plans).toHaveLength(1);
    expect(c[1].free.map((f) => f.part)).toEqual(["day"]);
  });

  it("leaves out a plan that is already over", () => {
    const later = ny(10, 30, 21);
    const c = dayContents(weekDays(later), [plan({ startsAt: ny(10, 30, 18) })], windowsLeft([], later), later);
    expect(c[0].plans).toHaveLength(0);
    const under = dayContents(weekDays(later), [plan({ startsAt: ny(10, 30, 20) })], [], later);
    expect(under[0].plans).toHaveLength(1);
  });

  it("labels a tile for a screen reader", () => {
    const c = dayContents(days, [plan({ startsAt: ny(10, 31, 19) })], left, now);
    expect(tileLabel(c[1])).toBe("Saturday 31, 1 plan, free daytime");
    expect(tileLabel(c[3])).toBe("Monday 2, nothing on");
    expect(tileLabel(c[0])).toBe("Today 30, free evening");
  });

  it("links a free slot to Discover with its window", () => {
    const c = dayContents(days, [], left, now);
    expect(findSomethingPath(c[1].free[0])).toBe("/discover?window=sat-day");
    expect(findSomethingPath(c[0].free[0])).toBe("/discover?window=fri-eve");
  });

  it("lists the weekdays that have a free evening", () => {
    expect(freeEvenings(["thu-eve", "fri-day", "sat-eve", "sun-eve"])).toEqual(["Thu", "Sat", "Sun"]);
    expect(freeEvenings(["sat-day"])).toEqual([]);
    expect(freeEvenings([])).toEqual([]);
  });
});

describe("the budget", () => {
  const now = ny(10, 30, 12);
  const pass: Pass = { id: "p", kind: "climbing", label: "Climbing", place: "" };

  it("snaps to the four amounts", () => {
    expect(snapBudget(0)).toBe(0);
    expect(snapBudget(20)).toBe(0);
    expect(snapBudget(30)).toBe(50);
    expect(snapBudget(80)).toBe(100);
    expect(snapBudget(180)).toBe(200);
    expect(snapBudget(999)).toBe(200);
  });

  it("reads only a plain number as a price", () => {
    expect(plainPrice("$12")).toBe(12);
    expect(plainPrice("12")).toBe(12);
    expect(plainPrice("$12.50")).toBe(12.5);
    expect(plainPrice("Free")).toBe(0);
    expect(plainPrice("$12 or pay what you can")).toBeNull();
    expect(plainPrice("donation")).toBeNull();
    expect(plainPrice("")).toBeNull();
    expect(plainPrice(null)).toBeNull();
  });

  it("adds up this month's priced plans and counts the unpriced apart", () => {
    const plans = [
      plan({ id: "a", price: "$20", startsAt: ny(10, 5, 19) }),
      plan({ id: "b", price: "$12.50", startsAt: ny(10, 31, 19) }),
      plan({ id: "c", price: null, startsAt: ny(10, 31, 20) }),
      plan({ id: "d", price: "$40", startsAt: ny(11, 2, 19) }),
      plan({ id: "e", price: "pay what you like", startsAt: ny(10, 29, 19) }),
      plan({ id: "f", kind: "session", price: null, startsAt: ny(10, 31, 9) }),
      plan({ id: "g", price: null, cornerKey: "sports/climbing", startsAt: ny(10, 31, 17) }),
    ];
    expect(monthSpend(plans, [pass], now)).toEqual({ sum: 32.5, unpriced: 2 });
    expect(monthSpend(plans, [], now)).toEqual({ sum: 32.5, unpriced: 3 });
  });

  it("writes the line under the slider", () => {
    expect(budgetLine(100, { sum: 32.5, unpriced: 0 })).toBe("$32.50 planned so far · $67.50 left this month");
    expect(budgetLine(50, { sum: 20, unpriced: 2 })).toBe("$20 planned so far · $30 left this month, plus 2 plans without a price");
    expect(budgetLine(50, { sum: 20, unpriced: 1 })).toBe("$20 planned so far · $30 left this month, plus 1 plan without a price");
    expect(budgetLine(50, { sum: 80, unpriced: 0 })).toBe("$80 planned so far · $0 left this month");
  });

  it("says only free plans at 0 and when no budget is saved", () => {
    expect(budgetLine(0, { sum: 0, unpriced: 3 })).toBe("Only free plans and ones your pass covers");
    expect(budgetLine(null, { sum: 0, unpriced: 0 })).toBe("Only free plans and ones your pass covers");
  });
});

describe("the ticket's lines", () => {
  it("splits a start time into two lines in New York", () => {
    expect(ticketTime(ny(10, 31, 19))).toEqual({ top: "7", bottom: "PM" });
    expect(ticketTime(ny(10, 31, 19, 30))).toEqual({ top: "7:30", bottom: "PM" });
    expect(ticketTime(ny(10, 31, 9))).toEqual({ top: "9", bottom: "AM" });
    expect(ticketTime(ny(11, 1, 0, 15))).toEqual({ top: "12:15", bottom: "AM" });
    expect(ticketTime(ny(10, 31, 12))).toEqual({ top: "12", bottom: "PM" });
  });

  it("names a Pursuit's session, but not a plan of one", () => {
    expect(kindLine(plan({ kind: "session", session: { n: 4, total: 5 } }))).toBe("Pursuit · session 4 of 5");
    expect(kindLine(plan({ kind: "session", session: { n: 1, total: 1 } }))).toBeNull();
    expect(kindLine(plan())).toBeNull();
  });

  it("writes place and price in the host's words, a pass by name, and never $0", () => {
    const pass: Pass = { id: "p", kind: "climbing", label: "Climbing", place: "" };
    expect(placeLine(plan({ place: "Brooklyn Boulders, Gowanus", price: "$25" }), [])).toBe("Brooklyn Boulders, Gowanus · $25");
    expect(placeLine(plan({ place: "Brooklyn Boulders, Gowanus", price: "$25", cornerKey: "sports/climbing" }), [pass])).toBe("Brooklyn Boulders, Gowanus · your climbing pass");
    expect(placeLine(plan({ place: "Riverside Park", price: null }), [])).toBe("Riverside Park");
    expect(placeLine(plan({ place: undefined, price: "Free" }), [])).toBe("Free");
    expect(placeLine(plan({ place: undefined, price: null }), [])).toBe("");
    expect(placeLine(plan({ place: "Riverside Park", price: null }), [])).not.toContain("$0");
  });

  it("says who is going, naming at most 3 connections", () => {
    const f = (name: string) => ({ id: name, name });
    expect(goingLine({ friends: [f("Priya Shah")], total: 2 })).toBe("You and Priya");
    expect(goingLine({ friends: [f("Priya"), f("Sam"), f("Maya")], total: 4 })).toBe("You, Priya, Sam and Maya");
    expect(goingLine({ friends: [f("Priya"), f("Sam"), f("Maya")], total: 9 })).toBe("Priya, Sam and Maya · 9 going");
    expect(goingLine({ friends: [f("Priya")], total: 5 })).toBe("Priya · 5 going");
  });

  it("never names a stranger: with no connections going there is no line", () => {
    expect(goingLine({ friends: [], total: 6 })).toBeNull();
    expect(goingLine({ friends: [], total: 1 })).toBeNull();
  });

  it("offers Bring someone only when just you are going", () => {
    expect(isJustYou({ friends: [], total: 1 })).toBe(true);
    expect(isJustYou({ friends: [], total: 6 })).toBe(false);
    expect(isJustYou({ friends: [{ id: "a", name: "Priya" }], total: 2 })).toBe(false);
  });
});
