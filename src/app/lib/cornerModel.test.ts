import { describe, expect, it } from "vitest";
import { hobbies } from "../data/hobbies";
import { CORNER_CATEGORIES } from "../data/cornerCategories";
import { homeCornersIn } from "../data/homeCorners";
import { builtInCornerModel } from "./cornerModel";

/** The three Corners that sit in two old Spaces; each is one Corner (see cornerCategories.ts). */
const SHARED = ["trading-cards", "nature-journaling", "outdoor-photography"];

describe("built-in Corner slugs", () => {
  it("are unique across Spaces, apart from the three shared Corners", () => {
    const count = new Map<string, number>();
    for (const h of hobbies) for (const s of h.subItems) count.set(s.slug, (count.get(s.slug) ?? 0) + 1);
    const dupes = [...count].filter(([, n]) => n > 1).map(([slug]) => slug).sort();
    expect(dupes).toEqual([...SHARED].sort());
  });
});

describe("builtInCornerModel", () => {
  it("builds a full model for a curated Corner", () => {
    const m = builtInCornerModel("pottery")!;
    expect(m.name).toBe("Pottery");
    expect(m.emoji).toBeTruthy();
    expect(m.meta).toMatch(/hr/);
    expect(m.steps.length).toBeGreaterThanOrEqual(3);
    expect(m.worth).toHaveLength(4);
    expect(m.needs.length).toBeGreaterThan(0);
    expect(m.categorySlug).toBe("crafts-diy");
  });

  it("builds a page for Baking, a Corner with no curated entry: its guide step only", () => {
    const m = builtInCornerModel("baking")!;
    expect(m.name).toBe("Baking");
    expect(m.categorySlug).toBe("food-drink");
    expect(m.about).toBeTruthy();
    expect(m.steps).toHaveLength(1);
    expect(m.emoji).toBeUndefined();
    expect(m.meta).toBeUndefined();
    expect(m.worth).toEqual([]);
    expect(m.needs).toEqual([]);
  });

  it("resolves a shared slug to one Corner, the first Space's", () => {
    for (const slug of SHARED) {
      const first = hobbies.find((h) => h.subItems.some((s) => s.slug === slug))!;
      expect(builtInCornerModel(slug)?.spaceSlug).toBe(first.slug);
    }
  });

  it("resolves every Corner the Corners home lists, with a category, and nothing for an unknown slug", () => {
    for (const cat of CORNER_CATEGORIES) {
      for (const c of homeCornersIn(cat.slug)) {
        const m = builtInCornerModel(c.slug);
        expect(m, c.slug).toBeDefined();
        expect(m!.name).toBe(c.name);
        expect(m!.categorySlug, c.slug).toBeTruthy();
      }
    }
    expect(builtInCornerModel("not-a-corner")).toBeUndefined();
  });
});
