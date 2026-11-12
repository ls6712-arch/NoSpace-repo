import { describe, expect, it } from "vitest";
import { CATALOG_CORNERS } from "./catalogCorners";
import { CATALOG_CORNER_CATEGORY } from "./catalogCornerCategories";
import { CORNER_CATEGORIES, categoryOfCorner } from "./cornerCategories";
import { catalogCornersIn, homeCornersIn, isCompleteCorner, notStartedIn } from "./homeCorners";

const slugsOfCategories = new Set(CORNER_CATEGORIES.map((c) => c.slug));

describe("catalog Corners in the 18 categories", () => {
  it("give every catalog Corner exactly one real category, and no category entry without a Corner", () => {
    for (const c of CATALOG_CORNERS) {
      expect(slugsOfCategories.has(CATALOG_CORNER_CATEGORY[c.slug]), c.slug).toBe(true);
      expect(categoryOfCorner(c.spaceSlug, c.slug)?.slug, c.slug).toBe(CATALOG_CORNER_CATEGORY[c.slug]);
    }
    const catalogSlugs = new Set(CATALOG_CORNERS.map((c) => c.slug));
    for (const slug of Object.keys(CATALOG_CORNER_CATEGORY)) expect(catalogSlugs.has(slug), slug).toBe(true);
  });

  it("list each catalog Corner once under 'Not started here yet' while it has no guide, curated entry and photo", () => {
    const chips = CORNER_CATEGORIES.flatMap((c) => notStartedIn(c.slug));
    expect(new Set(chips.map((c) => c.slug)).size).toBe(chips.length);
    for (const c of chips) expect(isCompleteCorner(c.spaceSlug, c.slug), c.slug).toBe(false);
    // Nothing in the catalog is complete today, so none is in the main grid and every one is a chip.
    const inGrid = new Set(CORNER_CATEGORIES.flatMap((c) => homeCornersIn(c.slug)).map((c) => c.slug));
    for (const c of CATALOG_CORNERS) expect(inGrid.has(c.slug), `${c.slug} is in the main grid`).toBe(false);
    expect(chips.length).toBeGreaterThan(250);
  });

  it("moves a catalog Corner into the main grid on its own once it is complete, and out of the chips", () => {
    const category = CATALOG_CORNER_CATEGORY["acroyoga"];
    const before = catalogCornersIn(category);
    expect(before.notStarted.map((c) => c.slug)).toContain("acroyoga");
    expect(before.grid.map((c) => c.slug)).not.toContain("acroyoga");

    const after = catalogCornersIn(category, (_space, slug) => slug === "acroyoga");
    expect(after.grid.map((c) => c.slug)).toEqual(["acroyoga"]);
    expect(after.notStarted.map((c) => c.slug)).not.toContain("acroyoga");
    expect(after.notStarted).toHaveLength(before.notStarted.length - 1);
  });

  it("keeps each chip to a name and a link, in A to Z order", () => {
    for (const cat of CORNER_CATEGORIES) {
      const names = notStartedIn(cat.slug).map((c) => c.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    }
  });
});
