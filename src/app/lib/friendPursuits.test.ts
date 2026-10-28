import { describe, expect, it } from "vitest";
import { progressLine } from "./friendPursuits";
import type { Measure, ProgressEntry } from "./journal";

const measure = { kind: "count", target: 10, unit: "loaves", allowPartial: false, allowDecimals: false, defaultAmount: 1, startingAmount: 0 } as Measure;
const entry = (amount: number): ProgressEntry => ({ id: "", projectId: "p", amount, createdAt: 0 });

describe("progressLine", () => {
  it("reads as 'N of M unit'", () => {
    expect(progressLine(measure, [entry(1), entry(2)])).toBe("3 of 10 loaves");
  });

  it("never shows more than the target", () => {
    expect(progressLine(measure, [entry(12)])).toBe("10 of 10 loaves");
  });

  it("is nothing without a measure", () => {
    expect(progressLine(undefined, [entry(1)])).toBeUndefined();
    expect(progressLine({ ...measure, target: 0 }, [])).toBeUndefined();
  });
});
