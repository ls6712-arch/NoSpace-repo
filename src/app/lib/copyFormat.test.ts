import { describe, expect, it } from "vitest";
import { plural, pluralWord } from "./plural";
import { formatDate, formatDateRange, formatDateTime, formatMonth, formatWhen } from "./dates";

describe("plural", () => {
  it("uses the singular only for exactly 1", () => {
    expect(plural(0, "Moment")).toBe("0 Moments");
    expect(plural(1, "Moment")).toBe("1 Moment");
    expect(plural(2, "Moment")).toBe("2 Moments");
  });
  it("handles irregular units", () => {
    expect(plural(1, "loaf", "loaves")).toBe("1 loaf");
    expect(plural(2, "loaf", "loaves")).toBe("2 loaves");
    expect(plural(0.5, "loaf", "loaves")).toBe("0.5 loaves");
    expect(plural(1, "knife", "knives")).toBe("1 knife");
  });
  it("takes an irregular plural", () => {
    expect(plural(1, "person", "people")).toBe("1 person");
    expect(plural(5, "person", "people")).toBe("5 people");
    expect(pluralWord(1, "is", "are")).toBe("is");
    expect(pluralWord(3, "is", "are")).toBe("are");
  });
  it("groups thousands, or shortens them when compact", () => {
    expect(plural(1200, "Moment")).toBe("1,200 Moments");
    expect(plural(1200, "Moment", { compact: true })).toBe("1.2k Moments");
    expect(plural(1200, "person", "people", { compact: true })).toBe("1.2k people");
  });
});

// Fixed "now": Fri Oct 2, 2026, 12:00 local time.
const NOW = new Date(2026, 9, 2, 12, 0).getTime();
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe("formatWhen", () => {
  it("is relative under 7 days", () => {
    expect(formatWhen(NOW - 10_000, { now: NOW })).toBe("now");
    expect(formatWhen(NOW - 5 * 60_000, { now: NOW })).toBe("5m");
    expect(formatWhen(NOW - 3 * 3_600_000, { now: NOW })).toBe("3h");
    expect(formatWhen(at(2026, 9, 29), { now: NOW })).toBe("3d");
    expect(formatWhen(at(2026, 9, 26, 11), { now: NOW })).toBe("6d");
  });
  it("reads inside a sentence with ago", () => {
    expect(formatWhen(NOW - 10_000, { now: NOW, ago: true })).toBe("just now");
    expect(formatWhen(at(2026, 9, 29), { now: NOW, ago: true })).toBe("3d ago");
  });
  it("says Yesterday for the day before inside a sentence", () => {
    expect(formatWhen(NOW - 26 * 3_600_000, { now: NOW, ago: true })).toBe("Yesterday");
    expect(formatWhen(NOW - 26 * 3_600_000, { now: NOW })).toBe("1d");
  });
  it("switches to a date at 7 days, with the year only if not this year", () => {
    expect(formatWhen(at(2026, 9, 24), { now: NOW })).toBe("Sep 24");
    expect(formatWhen(at(2026, 9, 24), { now: NOW, ago: true })).toBe("Sep 24");
    expect(formatWhen(at(2025, 9, 24), { now: NOW })).toBe("Sep 24, 2025");
  });
  it("gives a future time its date", () => {
    expect(formatWhen(at(2026, 10, 5), { now: NOW })).toBe("Oct 5");
  });
});

describe("formatDate and friends", () => {
  it("formats a date", () => {
    expect(formatDate(at(2026, 10, 5), { now: NOW })).toBe("Oct 5");
    expect(formatDate(at(2027, 1, 5), { now: NOW })).toBe("Jan 5, 2027");
    expect(formatDate(at(2026, 9, 24), { now: NOW, weekday: "long", month: "long" })).toBe(
      "Thursday, September 24",
    );
  });
  it("formats a month heading", () => {
    expect(formatMonth(at(2026, 9, 3), { now: NOW })).toBe("September");
    expect(formatMonth(at(2025, 9, 3), { now: NOW })).toBe("September 2025");
  });
  it("formats a date and time", () => {
    expect(formatDateTime(at(2026, 10, 3, 19), { now: NOW })).toBe("Sat, Oct 3, 7:00 PM");
  });
  it("uses an en dash for ranges", () => {
    expect(formatDateRange(at(2026, 10, 1), at(2026, 10, 5), { now: NOW })).toBe("Oct 1 to 5");
    expect(formatDateRange(at(2026, 9, 28), at(2026, 10, 3), { now: NOW })).toBe("Sep 28 to Oct 3");
    expect(formatDateRange(at(2025, 12, 30), at(2026, 1, 2), { now: NOW })).toBe("Dec 30, 2025 to Jan 2, 2026");
  });
  it("returns empty text for a bad date", () => {
    expect(formatWhen("not a date")).toBe("");
  });
});
