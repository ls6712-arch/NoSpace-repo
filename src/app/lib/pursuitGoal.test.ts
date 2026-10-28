import { describe, expect, it } from "vitest";
import { WEEK_CHOICES, clampCount, daysBetween, endsAtFor, logLabel, nextWeeks, pursuitTitleFor } from "./pursuitGoal";

describe("pursuit goal helpers", () => {
  it("keeps the count in range", () => {
    expect(clampCount(0)).toBe(1);
    expect(clampCount(99)).toBe(30);
    expect(clampCount(5.4)).toBe(5);
  });

  it("cycles the weeks and wraps", () => {
    expect(nextWeeks(4)).toBe(6);
    expect(nextWeeks(WEEK_CHOICES[WEEK_CHOICES.length - 1])).toBe(WEEK_CHOICES[0]);
    expect(nextWeeks(5)).toBe(WEEK_CHOICES[0]);
  });

  it("ends at the close of the day, weeks away", () => {
    const from = new Date(2026, 9, 28, 15, 0);
    const end = new Date(endsAtFor(4, from));
    expect([end.getFullYear(), end.getMonth(), end.getDate(), end.getHours()]).toEqual([2026, 10, 25, 23]);
  });

  it("titles with the Corner and plural helpers", () => {
    expect(pursuitTitleFor("Pasta", 5, 4)).toBe("Pasta 5 times in 4 weeks");
    expect(pursuitTitleFor("Pasta", 1, 1)).toBe("Pasta 1 time in 1 week");
  });

  it("labels the next log", () => {
    expect(logLabel("Pasta", 1)).toBe("Log pasta #2");
    expect(logLabel(undefined, 0)).toBe("Log #1");
  });

  it("counts days, at least one", () => {
    expect(daysBetween(0, 26 * 86_400_000)).toBe(26);
    expect(daysBetween(0, 1000)).toBe(1);
  });
});
