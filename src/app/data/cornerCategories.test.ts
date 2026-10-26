import { describe, expect, it } from "vitest";
import { hobbies } from "./hobbies";
import { CORNER_CATEGORIES, categoryOfCorner, cornersInCategory } from "./cornerCategories";

describe("the 18 categories", () => {
  it("are 18, with distinct slugs and names, and no word repeated across names", () => {
    expect(CORNER_CATEGORIES).toHaveLength(18);
    expect(new Set(CORNER_CATEGORIES.map((c) => c.slug)).size).toBe(18);
    expect(new Set(CORNER_CATEGORIES.map((c) => c.name)).size).toBe(18);
    const words = CORNER_CATEGORIES.flatMap((c) => c.name.toLowerCase().split(" ")).filter((w) => w !== "and");
    expect(new Set(words).size).toBe(words.length);
  });

  it("put every built-in Corner in exactly one category", () => {
    for (const h of hobbies) {
      for (const s of h.subItems) {
        expect(categoryOfCorner(h.slug, s.slug), `${h.slug}/${s.slug}`).toBeDefined();
      }
    }
    const total = hobbies.reduce((n, h) => n + h.subItems.length, 0);
    expect(total).toBe(149);
  });

  it("list each distinct Corner once, so the three duplicates are merged", () => {
    const listed = CORNER_CATEGORIES.flatMap((c) => cornersInCategory(c.slug).map((x) => x.cornerSlug));
    const builtIn = new Set(hobbies.flatMap((h) => h.subItems.map((s) => s.slug)));
    // 146 distinct built-in slugs, plus the one database-only Corner (storytelling).
    expect(builtIn.size).toBe(146);
    expect(listed).toHaveLength(builtIn.size + 1);
    expect(new Set(listed).size).toBe(listed.length);
    for (const dup of ["trading-cards", "nature-journaling", "outdoor-photography"]) {
      expect(listed.filter((s) => s === dup)).toHaveLength(1);
    }
  });

  it("never show an empty category", () => {
    for (const c of CORNER_CATEGORIES) expect(cornersInCategory(c.slug).length, c.slug).toBeGreaterThan(0);
  });

  it("file the 6 database Corners where the migration does", () => {
    const expected: [string, string, string][] = [
      ["books-writing", "reading", "reading-writing"],
      ["food-cooking", "cooking", "food-drink"],
      ["food-cooking", "storytelling", "reading-writing"],
      ["photography-film", "photography", "photo-film"],
      ["tech-building", "web-design", "skills-side-projects"],
      ["travel-adventure", "travel", "outdoors-adventure"],
    ];
    for (const [space, corner, cat] of expected) expect(categoryOfCorner(space, corner)?.slug).toBe(cat);
  });
});
