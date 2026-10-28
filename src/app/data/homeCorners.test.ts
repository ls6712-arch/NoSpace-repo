import { describe, expect, it } from "vitest";
import { hobbies } from "./hobbies";
import { CORNER_CATEGORIES } from "./cornerCategories";
import { CURATED_CORNERS } from "./curatedCorners";
import { homeCornersIn } from "./homeCorners";
import { cornerPhoto } from "../lib/cornerPhoto";
import { hasHobbyPhoto } from "./hobbyPhotos";

const all = CORNER_CATEGORIES.flatMap((c) => homeCornersIn(c.slug));

describe("home Corners", () => {
  it("list every built-in Corner once (161 entries, three of them shared by two Spaces)", () => {
    const entries = hobbies.reduce((n, h) => n + h.subItems.length, 0);
    expect(entries).toBe(161);
    expect(new Set(all.map((c) => c.slug)).size).toBe(all.length);
    const builtIn = new Set(hobbies.flatMap((h) => h.subItems.map((s) => s.slug)));
    expect(all).toHaveLength(builtIn.size);
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
});
