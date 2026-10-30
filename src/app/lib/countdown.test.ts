import { describe, expect, it } from "vitest";
import { formatCountdown } from "./countdown";

describe("formatCountdown", () => {
  it("reads as a clock", () => {
    expect(formatCountdown(30)).toBe("0:30");
    expect(formatCountdown(9)).toBe("0:09");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(75)).toBe("1:15");
  });

  it("rounds a part second up and never goes negative", () => {
    expect(formatCountdown(0.2)).toBe("0:01");
    expect(formatCountdown(-5)).toBe("0:00");
  });
});
