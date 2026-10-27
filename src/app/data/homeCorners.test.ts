import { describe, expect, it } from "vitest";
import { hobbies } from "./hobbies";
import { CORNER_CATEGORIES } from "./cornerCategories";
import { CURATED_CORNERS } from "./curatedCorners";
import { homeCornersIn } from "./homeCorners";
import { cornerPhoto } from "../lib/cornerPhoto";
import { hasHobbyPhoto } from "./hobbyPhotos";

const all = CORNER_CATEGORIES.flatMap((c) => homeCornersIn(c.slug));

describe("home Corners", () => {
  it("list every built-in Corner once (149 entries, three of them shared by two Spaces)", () => {
    const entries = hobbies.reduce((n, h) => n + h.subItems.length, 0);
    expect(entries).toBe(149);
    expect(new Set(all.map((c) => c.slug)).size).toBe(all.length);
    const builtIn = new Set(hobbies.flatMap((h) => h.subItems.map((s) => s.slug)));
    expect(all).toHaveLength(builtIn.size);
  });

  it("mark exactly the curated Corners as curated", () => {
    expect(all.filter((c) => c.curated).map((c) => c.slug).sort()).toEqual(CURATED_CORNERS.map((c) => c.slug).sort());
  });

  it("give every Corner a photo of its own, never its Space's cover", () => {
    const missing = all.filter((c) => !hasHobbyPhoto(c.slug) || !cornerPhoto(c.spaceSlug, c.slug));
    expect(missing.map((c) => `${c.spaceSlug}/${c.slug}`)).toEqual([]);
  });
});
