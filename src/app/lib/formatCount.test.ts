import { describe, expect, it } from "vitest";
import { formatCount } from "./formatCount";

// A reaction count has to fit a two-column phone grid, so it is never
// longer than 4 characters however big it gets.
describe("formatCount", () => {
  const cases: [number, string][] = [
    [1, "1"],
    [999, "999"],
    [1000, "1k"],
    [1284, "1.2k"],
    [9999, "9.9k"],
    [10_000, "10k"],
    [123_456, "123k"],
    [999_999, "999k"],
    [1_000_000, "1M"],
    [1_250_000, "1.2M"],
    [12_400_000, "12M"],
    [5_000_000_000, "999M"],
  ];
  it.each(cases)("%i → %s", (n, expected) => {
    expect(formatCount(n)).toBe(expected);
  });
  it("never exceeds 4 characters", () => {
    for (let n = 0; n < 2_000_000_000; n = Math.floor(n * 1.37) + 1) {
      expect(formatCount(n).length).toBeLessThanOrEqual(4);
    }
  });
});
