import { describe, expect, it } from "vitest";
import { clockOf, dragRange, isDraggable, parseClock, partOf, planActions, planKind, planStartsAt, rangeText, slotTitle, snapMs, tapRange, timeAtRow } from "./calendarActions";
import { nyTimeToMs } from "./homeWeek";
import { weekDays, type WeekPlanDetail } from "./weekView";

const ny = (m: number, d: number, h: number, min = 0) => nyTimeToMs(2026, m, d, h) + min * 60_000;
const day = (m: number, d: number) => weekDays(ny(m, d, 12), 1)[0];
const alone = { friends: [], total: 1 };
const plan = (over: Partial<WeekPlanDetail>): WeekPlanDetail => ({ id: "session-1", kind: "session", title: "x", startsAt: 0, color: "blue", going: alone, ...over });

describe("what a plan offers", () => {
  it("offers change, bring and cancel for a plan only you are in", () => {
    const p = plan({ mine: true });
    expect(planKind(p)).toBe("own");
    expect(planActions(p)).toEqual(["change", "bring", "cancel"]);
    expect(isDraggable(p)).toBe(true);
  });

  it("offers change my time and leave for a plan with others that is yours, and only leave when it is not", () => {
    const withOthers = { friends: [{ id: "a", name: "Sam" }], total: 2 };
    expect(planActions(plan({ mine: true, going: withOthers }))).toEqual(["change", "leave"]);
    expect(planActions(plan({ mine: false, going: withOthers }))).toEqual(["leave"]);
    expect(isDraggable(plan({ mine: true, going: withOthers }))).toBe(false);
  });

  it("offers move and skip for a session of a longer Pursuit, skip only when it is not yours", () => {
    const s = { n: 4, total: 5 };
    expect(planActions(plan({ mine: true, session: s }))).toEqual(["move", "skip"]);
    expect(planActions(plan({ mine: false, session: s }))).toEqual(["skip"]);
    expect(planKind(plan({ mine: true, session: s }))).toBe("pursuit");
    expect(isDraggable(plan({ mine: true, session: s }))).toBe(false);
  });

  it("offers only leave for a host's listing, and never drags it", () => {
    const p = plan({ id: "event-3", kind: "event", mine: undefined });
    expect(planActions(p)).toEqual(["leave"]);
    expect(isDraggable(p)).toBe(false);
  });
});

describe("a tap or a drag on empty hours", () => {
  it("snaps to 15 minutes", () => {
    expect(snapMs(ny(11, 3, 10, 7))).toBe(ny(11, 3, 10, 0));
    expect(snapMs(ny(11, 3, 10, 8))).toBe(ny(11, 3, 10, 15));
  });

  it("reads a row of the grid as a time", () => {
    // 7 AM start, 48px an hour: 96px down is 9 AM.
    expect(timeAtRow(day(11, 3), 96, 48, 7)).toBe(ny(11, 3, 9));
    expect(timeAtRow(day(11, 3), 100, 48, 7)).toBe(ny(11, 3, 9));
  });

  it("makes a tap into the rest of its part of the day", () => {
    expect(tapRange(day(11, 3), ny(11, 3, 14, 20))).toEqual({ startMs: ny(11, 3, 14), endMs: ny(11, 3, 18) });
    expect(tapRange(day(11, 3), ny(11, 3, 22, 10))).toEqual({ startMs: ny(11, 3, 22), endMs: ny(11, 4, 0) });
    expect(tapRange(day(11, 3), ny(11, 3, 18, 0))).toEqual({ startMs: ny(11, 3, 18), endMs: ny(11, 4, 0) });
  });

  it("keeps at least 30 minutes after a tap at the end of the part", () => {
    const r = tapRange(day(11, 3), ny(11, 3, 23, 50));
    expect(r.endMs - r.startMs).toBeGreaterThanOrEqual(30 * 60_000);
  });

  it("makes a drag into a snapped range, either direction, at least 30 minutes", () => {
    expect(dragRange(ny(11, 3, 9, 2), ny(11, 3, 11, 14))).toEqual({ startMs: ny(11, 3, 9), endMs: ny(11, 3, 11, 15) });
    expect(dragRange(ny(11, 3, 11), ny(11, 3, 9))).toEqual({ startMs: ny(11, 3, 9), endMs: ny(11, 3, 11) });
    expect(dragRange(ny(11, 3, 9), ny(11, 3, 9, 5))).toEqual({ startMs: ny(11, 3, 9), endMs: ny(11, 3, 9, 30) });
  });
});

describe("the sheets' words", () => {
  it("titles a time", () => {
    expect(slotTitle(ny(11, 3, 22))).toBe("Tuesday, 10 PM");
    expect(slotTitle(ny(11, 3, 19, 30))).toBe("Tuesday, 7:30 PM");
  });

  it("says midnight for the end of the day", () => {
    expect(rangeText(ny(11, 3, 22), ny(11, 4, 0))).toBe("10 PM to midnight");
    expect(rangeText(ny(11, 3, 14), ny(11, 3, 18))).toBe("2 to 6 PM");
  });
});

describe("the plan sheet's time", () => {
  it("uses the day's default hour for Daytime and Evening", () => {
    expect(planStartsAt(day(11, 3), "day")).toBe(ny(11, 3, 12));
    expect(planStartsAt(day(11, 3), "eve")).toBe(ny(11, 3, 19));
  });

  it("uses an exact time when one is typed, and the default when it is not a time", () => {
    expect(planStartsAt(day(11, 3), "eve", "20:30")).toBe(ny(11, 3, 20, 30));
    expect(planStartsAt(day(11, 3), "day", "9:05")).toBe(ny(11, 3, 9, 5));
    expect(planStartsAt(day(11, 3), "eve", "25:00")).toBe(ny(11, 3, 19));
    expect(planStartsAt(day(11, 3), "eve", "")).toBe(ny(11, 3, 19));
  });

  it("parses and writes clock times", () => {
    expect(parseClock("07:45")).toEqual({ h: 7, min: 45 });
    expect(parseClock("7:60")).toBeNull();
    expect(parseClock("noon")).toBeNull();
    expect(clockOf(ny(11, 3, 19, 30))).toBe("19:30");
    expect(clockOf(ny(11, 3, 7, 5))).toBe("07:05");
  });

  it("tells Daytime from Evening", () => {
    expect(partOf(ny(11, 3, 17, 59))).toBe("day");
    expect(partOf(ny(11, 3, 18))).toBe("eve");
  });
});
