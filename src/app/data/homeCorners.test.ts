import { describe, expect, it } from "vitest";
import { HIDDEN_CORNERS, MERGED_CORNERS, hobbies } from "./hobbies";
import { CORNER_CATEGORIES } from "./cornerCategories";
import { CURATED_CORNERS, cornerAbout } from "./curatedCorners";
import { homeCornersIn } from "./homeCorners";
import { cornerPhoto } from "../lib/cornerPhoto";
import { hasHobbyPhoto } from "./hobbyPhotos";
import { categoryOfCorner } from "./cornerCategories";

const all = CORNER_CATEGORIES.flatMap((c) => homeCornersIn(c.slug));

describe("home Corners", () => {
  it("list every browsable built-in Corner once: not merged away, not hidden", () => {
    const entries = hobbies.reduce((n, h) => n + h.subItems.length, 0);
    expect(entries).toBe(161);
    expect(new Set(all.map((c) => c.slug)).size).toBe(all.length);
    const mergedSlugs = new Set(Object.keys(MERGED_CORNERS).map((k) => k.split("/")[1]));
    const builtIn = new Set(hobbies.flatMap((h) => h.subItems.map((s) => s.slug)));
    const browsable = [...builtIn].filter((slug) => !mergedSlugs.has(slug) && !HIDDEN_CORNERS.has(slug));
    expect(all.map((c) => c.slug).sort()).toEqual(browsable.sort());
    for (const c of all) {
      expect(`${c.spaceSlug}/${c.slug}` in MERGED_CORNERS, c.slug).toBe(false);
      expect(HIDDEN_CORNERS.has(c.slug), c.slug).toBe(false);
    }
  });

  it("give every browsable Corner exactly one category", () => {
    const seen = new Map<string, string>();
    for (const cat of CORNER_CATEGORIES) {
      for (const c of homeCornersIn(cat.slug)) {
        expect(seen.has(c.slug), `${c.slug} is in two categories`).toBe(false);
        seen.set(c.slug, cat.slug);
        expect(categoryOfCorner(c.spaceSlug, c.slug)?.slug, c.slug).toBe(cat.slug);
      }
    }
    expect(seen.size).toBe(all.length);
  });

  it("give every browsable Corner a description, from its guide or its curated entry", () => {
    const missing = all.filter((c) => !cornerAbout(c.spaceSlug, c.slug)?.trim()).map((c) => `${c.spaceSlug}/${c.slug}`);
    expect(missing).toEqual([]);
  });

  it("mark exactly the curated Corners as curated", () => {
    expect(all.filter((c) => c.curated).map((c) => c.slug).sort()).toEqual(CURATED_CORNERS.map((c) => c.slug).sort());
  });

  // Wave 1 (Oct 28, 2026): added before their photos were chosen, so for now they show their
  // Space's cover. Add a photo to hobbyPhotos.ts (PHOTO and CREDITS) and delete the slug here.
  const AWAITING_PHOTO = [
    "life-drawing", "city-walks", "film-clubs", "food-tours", "mahjong", "rafting",
    "letter-writing", "hyrox", "walking-clubs", "badminton", "skating", "ultimate-frisbee",
  ];

  it("give every Corner a photo of its own, never its Space's cover", () => {
    const missing = all.filter((c) => !AWAITING_PHOTO.includes(c.slug) && (!hasHobbyPhoto(c.slug) || !cornerPhoto(c.spaceSlug, c.slug)));
    expect(missing.map((c) => `${c.spaceSlug}/${c.slug}`)).toEqual([]);
  });

  it("only lists a Corner as awaiting a photo while it has none, and still gives it a card image", () => {
    for (const slug of AWAITING_PHOTO) {
      const c = all.find((x) => x.slug === slug);
      expect(c, slug).toBeDefined();
      expect(hasHobbyPhoto(slug), `${slug} has a photo now: remove it from AWAITING_PHOTO`).toBe(false);
      expect(cornerPhoto(c!.spaceSlug, slug), slug).toBeTruthy();
    }
  });

  it("never show one photo on two Corners, apart from the Space covers the awaiting-photo Corners fall back to", () => {
    const bySrc = new Map<string, string[]>();
    for (const c of all) {
      const src = cornerPhoto(c.spaceSlug, c.slug) ?? "";
      bySrc.set(src, [...(bySrc.get(src) ?? []), c.slug]);
    }
    const repeats = [...bySrc.values()].filter((slugs) => slugs.length > 1);
    // A repeat is allowed only when every Corner but one is still waiting for its own photo (and so shows a Space cover).
    const bad = repeats.filter((slugs) => slugs.filter((s) => !AWAITING_PHOTO.includes(s)).length > 1);
    expect(bad).toEqual([]);
  });
});
