import { describe, expect, it } from "vitest";
import { pursuitStatus, sessionsThisWeek, startOfWeek } from "./journal";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

describe("startOfWeek (Step 5a)", () => {
  it("is Monday 00:00 local for any day of that week", () => {
    const monday = at(2026, 10, 5, 0); // Mon Oct 5, 2026
    expect(startOfWeek(at(2026, 10, 5, 9))).toBe(monday);
    expect(startOfWeek(at(2026, 10, 8))).toBe(monday);
    expect(startOfWeek(at(2026, 10, 11, 23))).toBe(monday); // Sunday
  });
});

describe("sessionsThisWeek (Step 5a)", () => {
  const now = at(2026, 10, 8, 18); // Thu Oct 8, 2026
  it("counts different days, not Moments", () => {
    expect(sessionsThisWeek([at(2026, 10, 5, 9), at(2026, 10, 5, 20), at(2026, 10, 7)], now)).toBe(2);
  });
  it("ignores last week and anything after now", () => {
    expect(sessionsThisWeek([at(2026, 10, 4), at(2026, 10, 9)], now)).toBe(0);
  });
  it("is 0 with no Moments", () => {
    expect(sessionsThisWeek([], now)).toBe(0);
  });
});

describe("pursuitStatus with Let go (Step 5a)", () => {
  it("reads let_go when let go", () => {
    expect(pursuitStatus({ letGoAt: 1 })).toBe("let_go");
  });
  it("Completed wins over Let go; Let go wins over Resting", () => {
    expect(pursuitStatus({ finishedAt: 1, letGoAt: 1 })).toBe("complete");
    expect(pursuitStatus({ letGoAt: 1, pausedAt: 1 })).toBe("let_go");
  });
});
