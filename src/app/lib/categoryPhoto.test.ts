import { describe, expect, it } from "vitest";
import { CORNER_CATEGORIES } from "../data/cornerCategories";
import { hasHobbyPhoto } from "../data/hobbyPhotos";
import { categoryPhotoCorner } from "./categoryPhoto";
import { cornerPhoto } from "./cornerPhoto";

describe("categoryPhotoCorner", () => {
  it("gives each of the 18 categories a Corner from it, with a photo of its own", () => {
    for (const cat of CORNER_CATEGORIES) {
      const c = categoryPhotoCorner(cat.slug);
      expect(c, cat.slug).toBeDefined();
      expect(hasHobbyPhoto(c!.slug), `${cat.slug}: ${c!.slug} has no photo of its own`).toBe(true);
    }
  });

  it("uses a different picture for every category", () => {
    const imgs = CORNER_CATEGORIES.map((cat) => {
      const c = categoryPhotoCorner(cat.slug)!;
      return cornerPhoto(c.spaceSlug, c.slug);
    });
    expect(new Set(imgs).size).toBe(CORNER_CATEGORIES.length);
  });

  it("prefers the first curated Corner", () => {
    const art = categoryPhotoCorner("art-design")!;
    expect(art.curated).toBeDefined();
  });
});
