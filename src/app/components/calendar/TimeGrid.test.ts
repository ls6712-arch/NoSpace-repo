import { describe, expect, it } from "vitest";
import { GRID_START_HOUR, HOUR_PX, blockBox, openingHour, stack } from "./TimeGrid";
import { calendarDays } from "../../lib/calendarView";
import { nyTimeToMs } from "../../lib/homeWeek";
import { weekDays } from "../../lib/weekView";
it.each([
  [3, 8],
  [11, 1],
])("positions 9 AM on the 9 AM row on %s/%s", (m, d) => {
  const at = nyTimeToMs(2026, m, d, 9);
  const day = weekDays(at, 1)[0];
  expect(blockBox(day, at, nyTimeToMs(2026, m, d, 10))).toEqual({
    top: (9 - GRID_START_HOUR) * HOUR_PX,
    height: HOUR_PX,
  });
});

describe("the week timeline", () => {
  it("runs the whole day, midnight to midnight", () => {
    expect(GRID_START_HOUR).toBe(0);
  });

  it("opens an hour before now in a week that holds today", () => {
    const now = nyTimeToMs(2026, 11, 8, 19);
    expect(openingHour(calendarDays(weekDays(now, 7), [], [], [], now), now)).toBe(18);
  });

  it("opens just before the first plan in another week, or in the morning when there is none", () => {
    const now = nyTimeToMs(2026, 11, 8, 19);
    const next = weekDays(nyTimeToMs(2026, 11, 20, 12), 7);
    const plan = { id: "event-1", kind: "event" as const, title: "Run", startsAt: nyTimeToMs(2026, 11, 21, 9), endsAt: nyTimeToMs(2026, 11, 21, 10), color: "lime" as const, going: { friends: [], total: 1 } };
    expect(openingHour(calendarDays(next, [plan], [], [], now), now)).toBe(8.5);
    expect(openingHour(calendarDays(next, [], [], [], now), now)).toBe(7);
  });

  it("stacks overlapping plans with an offset, the later one on top, instead of slivers", () => {
    expect(stack({ lane: 0, of: 1 })).toEqual({ left: "4px", width: "calc(100% - 8px)", zIndex: 1 });
    const [a, b] = [stack({ lane: 0, of: 2 }), stack({ lane: 1, of: 2 })];
    expect(a.left).toBe("calc(0% + 4px)");
    expect(b.left).toBe("calc(28% + 4px)");
    expect(b.zIndex).toBeGreaterThan(a.zIndex);
    // Every card keeps more of the column than an even split would give it.
    for (const [s, of] of [[a, 2], [b, 2], [stack({ lane: 2, of: 3 }), 3]] as const) expect(Number(s.width.match(/calc\(([\d.]+)%/)![1])).toBeGreaterThan(100 / of);
  });
});
