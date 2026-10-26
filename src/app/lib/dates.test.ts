import { describe, expect, it } from "vitest";
import { formatStarts } from "./dates";

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
