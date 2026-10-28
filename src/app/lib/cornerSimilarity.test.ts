import { describe, expect, it } from "vitest";
import { CORNER_CATEGORIES } from "../data/cornerCategories";
import { homeCornersIn, type HomeCorner } from "../data/homeCorners";
import { MIN_ROW_CARDS, fillRow, similarity, traitsOf } from "./cornerSimilarity";

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

describe("fillRow", () => {
  const short = CORNER_CATEGORIES.map((c) => homeCornersIn(c.slug)).filter((r) => r.length > 0 && r.length < MIN_ROW_CARDS);

  it("there are short rows to fill", () => {
    expect(short.length).toBeGreaterThan(0);
  });

  it("pads every short row to the minimum, own Corners first, no repeats", () => {
    for (const own of short) {
      const out = fillRow(own, all);
      expect(out.length).toBe(MIN_ROW_CARDS);
      expect(out.slice(0, own.length)).toEqual(own);
      expect(new Set(out.map((c) => `${c.spaceSlug}/${c.slug}`)).size).toBe(out.length);
    }
  });

  it("is deterministic and leaves a long enough row alone", () => {
    const own = short[0];
    expect(fillRow(own, all)).toEqual(fillRow(own, all));
    const long = all.slice(0, MIN_ROW_CARDS + 2);
    expect(fillRow(long, all)).toEqual(long);
  });

  it("fills with what a row's people would plausibly like: makers for the yarn row", () => {
    const yarn = homeCornersIn("yarn-fabric");
    if (yarn.length === 0) return;
    const fillers = fillRow(yarn, all).slice(yarn.length);
    const makers = fillers.filter((c) => traitsOf(c).kind === "making" || traitsOf(c).moods.has("make"));
    expect(makers.length).toBeGreaterThanOrEqual(Math.ceil(fillers.length / 2));
  });

  it("never fills with an adults-only Corner, and returns nothing extra for an empty row", () => {
    for (const own of short) for (const c of fillRow(own, all).slice(own.length)) expect(traitsOf(c as HomeCorner).adultsOnly).toBe(false);
    expect(fillRow([], all)).toEqual([]);
  });
});
