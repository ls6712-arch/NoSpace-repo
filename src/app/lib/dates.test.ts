import { describe, expect, it } from "vitest";
import { formatDuration, formatStarts, formatWait } from "./dates";

const NOW = Date.UTC(2026, 9, 26, 12, 0, 0);

describe("formatStarts", () => {
  it("counts minutes inside the next hour", () => {
    expect(formatStarts(NOW + 20 * 60_000, { now: NOW })).toBe("Starts in 20m");
  });
  it("counts hours inside the next day", () => {
    expect(formatStarts(NOW + 3.5 * 3_600_000, { now: NOW })).toBe("Starts in 4h");
  });
  it("gives the day and time after that", () => {
    expect(formatStarts(NOW + 3 * 24 * 3_600_000, { now: NOW, timeZone: "UTC" })).toBe("Thu, Oct 29, 12:00 PM");
  });
  it("gives the day and time once it has started", () => {
    expect(formatStarts(NOW - 3_600_000, { now: NOW, timeZone: "UTC" })).toBe("Mon, Oct 26, 11:00 AM");
  });
});

describe("formatDuration", () => {
  it("reads whole hours as hours and the rest as minutes", () => {
    expect(formatDuration(30)).toBe("30 min");
    expect(formatDuration(60)).toBe("1 hr");
    expect(formatDuration(90)).toBe("90 min");
    expect(formatDuration(240)).toBe("4 hr");
  });
  it("gives nothing for a missing or zero length", () => {
    expect(formatDuration(0)).toBe("");
    expect(formatDuration(Number.NaN)).toBe("");
  });
});

describe("formatWait", () => {
  it("reads as seconds, minutes or hours, with the right plural", () => {
    expect(formatWait(1)).toBe("1 second");
    expect(formatWait(45)).toBe("45 seconds");
    expect(formatWait(60)).toBe("1 minute");
    expect(formatWait(300)).toBe("5 minutes");
    expect(formatWait(3600)).toBe("1 hour");
    expect(formatWait(7200)).toBe("2 hours");
  });

  it("rounds up and is empty for nothing to wait", () => {
    expect(formatWait(44.2)).toBe("45 seconds");
    expect(formatWait(61)).toBe("2 minutes");
    expect(formatWait(0)).toBe("");
    expect(formatWait(-3)).toBe("");
  });
});

describe("formatMonthYear", () => {
  it("always has the year", async () => {
    const { formatMonthYear } = await import("./dates");
    expect(formatMonthYear(new Date(2026, 9, 5))).toBe("October 2026");
    expect(formatMonthYear("not a date")).toBe("");
  });
});
