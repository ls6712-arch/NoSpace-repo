import { describe, expect, it } from "vitest";
import { nyParts, nyTimeToMs, weekChips, weekLine, windowPhrase, windowsLeft } from "./homeWeek";

// Thursday Nov 5, 2026, 5:00 PM in New York (EST, UTC minus 5).
const NOW = Date.parse("2026-11-05T22:00:00Z");

describe("New York time helpers", () => {
  it("reads the parts of a moment in New York", () => {
    expect(nyParts(NOW)).toEqual({ y: 2026, m: 11, d: 5, hour: 17, dow: 4 });
  });

  it("turns a New York wall clock into a moment, across both daylight saving changes", () => {
    expect(new Date(nyTimeToMs(2026, 11, 5, 18)).toISOString()).toBe("2026-11-05T23:00:00.000Z");
    expect(new Date(nyTimeToMs(2026, 7, 4, 18)).toISOString()).toBe("2026-07-04T22:00:00.000Z");
    // The clocks go back at 2 AM on Sunday Nov 1; noon that day is EST.
    expect(new Date(nyTimeToMs(2026, 11, 1, 12)).toISOString()).toBe("2026-11-01T17:00:00.000Z");
    // They go forward on Sunday Mar 8; 6 PM that day is EDT.
    expect(new Date(nyTimeToMs(2026, 3, 8, 18)).toISOString()).toBe("2026-03-08T22:00:00.000Z");
  });
});

describe("free windows left this week", () => {
  const windows = ["thu-day", "thu-eve", "fri-eve", "sat-day", "sat-eve", "wed-eve"];

  it("counts windows that have not ended, over the next 7 days", () => {
    // Thursday daytime ended at 6 PM... it is 5 PM, so it is still on; Wednesday evening is next week.
    const left = windowsLeft(windows, NOW).map((w) => w.key);
    expect(left).toEqual(["thu-day", "thu-eve", "fri-eve", "sat-day", "sat-eve", "wed-eve"]);
    expect(windowsLeft(windows, NOW)[5].offset).toBe(6);
  });

  it("drops a daytime window once 6 PM has passed, but keeps that evening", () => {
    const later = Date.parse("2026-11-05T23:30:00Z"); // 6:30 PM
    expect(windowsLeft(["thu-day", "thu-eve"], later).map((w) => w.key)).toEqual(["thu-eve"]);
  });

  it("has none when nothing is saved", () => {
    expect(windowsLeft([], NOW)).toEqual([]);
  });

  it("says how many are left and how many plans, with the plan part only when there is one", () => {
    expect(weekLine(2, 1)).toBe("2 free windows left · 1 plan");
    expect(weekLine(1, 2)).toBe("1 free window left · 2 plans");
    expect(weekLine(3, 0)).toBe("3 free windows left");
    expect(weekLine(0, 0)).toBe("0 free windows left");
  });
});

describe("the next 3 days", () => {
  const windows = ["thu-eve", "fri-eve", "sat-day", "sat-eve"];

  it("shows the free part of each day", () => {
    expect(weekChips(windows, [], NOW)).toEqual([
      { heading: "Thu 5", line: "Free evening", plan: false },
      { heading: "Fri 6", line: "Free evening", plan: false },
      { heading: "Sat 7", line: "Free all day", plan: false },
    ]);
  });

  it("shows a plan in place of the free time, with its time", () => {
    const plan = { title: "Bouldering night", startsAt: Date.parse("2026-11-06T00:00:00Z") }; // Thu 7 PM
    const chips = weekChips(windows, [plan], NOW);
    expect(chips[0]).toEqual({ heading: "Thu 5", line: "Bouldering night 7 PM", plan: true });
  });

  it("keeps a half hour in the time and shortens a long title", () => {
    const plan = { title: "A very long pottery class title", startsAt: Date.parse("2026-11-06T23:30:00Z") }; // Fri 6:30 PM
    const chip = weekChips(windows, [plan], NOW)[1];
    expect(chip.line.endsWith("6:30 PM")).toBe(true);
    expect(chip.line.length).toBeLessThanOrEqual(24);
  });

  it("leaves out a day with nothing on it", () => {
    expect(weekChips(["sat-day"], [], NOW)).toEqual([{ heading: "Sat 7", line: "Free daytime", plan: false }]);
    expect(weekChips([], [], NOW)).toEqual([]);
  });

  it("names the part of the day for the reason line", () => {
    expect(windowPhrase(Date.parse("2026-11-06T00:00:00Z"))).toBe("Thursday evening");
    expect(windowPhrase(Date.parse("2026-11-07T15:00:00Z"))).toBe("Saturday daytime");
    expect(windowPhrase(Date.parse("2026-11-07T07:00:00Z"))).toBeNull(); // 2 AM
  });
});
