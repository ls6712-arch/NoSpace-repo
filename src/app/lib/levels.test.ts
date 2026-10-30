import { describe, expect, it } from "vitest";
import { LEVELS, getLevel } from "./levels";

describe("getLevel", () => {
  it("starts at level 1 with nothing earned", () => {
    const l = getLevel(0);
    expect(l.index).toBe(1);
    expect(l.name).toBe("Just Getting Started");
    expect(l.next?.name).toBe("First Step");
    expect(l.stubsToNext).toBe(1);
    expect(l.progress).toBe(0);
  });
  it("reaches First Step at 1 and stays there at 2", () => {
    expect(getLevel(1).name).toBe("First Step");
    const two = getLevel(2);
    expect(two.name).toBe("First Step");
    expect(two.stubsToNext).toBe(1);
    expect(two.progress).toBe(0.5);
  });
  it("is Weekend Regular at 7 and still at 9", () => {
    expect(getLevel(7).index).toBe(4);
    const nine = getLevel(9);
    expect(nine.name).toBe("Weekend Regular");
    expect(nine.stubsToNext).toBe(1);
    expect(nine.progress).toBeCloseTo(2 / 3);
  });
  it("reaches Plan Maker at 10", () => {
    const ten = getLevel(10);
    expect(ten.name).toBe("Plan Maker");
    expect(ten.next?.name).toBe("Good Company");
    expect(ten.stubsToNext).toBe(10);
  });
  it("tops out at Local Legend with a full bar and no next level", () => {
    for (const n of [50, 60]) {
      const l = getLevel(n);
      expect(l.index).toBe(8);
      expect(l.name).toBe("Local Legend");
      expect(l.next).toBeNull();
      expect(l.stubsToNext).toBe(0);
      expect(l.progress).toBe(1);
    }
  });
  it("treats a negative count as zero", () => {
    expect(getLevel(-3).index).toBe(1);
  });
  it("pins the thresholds the database uses (private.level_for)", () => {
    expect(LEVELS.map((l) => l.stubs)).toEqual([0, 1, 3, 7, 10, 20, 35, 50]);
  });
});
