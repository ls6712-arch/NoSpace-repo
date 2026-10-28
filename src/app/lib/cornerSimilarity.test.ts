import { describe, expect, it } from "vitest";
import { CORNER_CATEGORIES } from "../data/cornerCategories";
import { homeCornersIn } from "../data/homeCorners";
import { similarity, traitsOf } from "./cornerSimilarity";

const all = CORNER_CATEGORIES.flatMap((c) => homeCornersIn(c.slug));
const byName = (n: string) => all.find((c) => c.name === n)!;

describe("similarity", () => {
  it("is 1 at most, symmetric, and higher for like with like", () => {
    const a = traitsOf(byName("Pottery"));
    const b = traitsOf(byName("Woodworking"));
    const far = traitsOf(byName("Running"));
    expect(similarity(a, b)).toBeCloseTo(similarity(b, a));
    expect(similarity(a, b)).toBeLessThanOrEqual(1);
    expect(similarity(a, b)).toBeGreaterThan(similarity(a, far));
  });
});
