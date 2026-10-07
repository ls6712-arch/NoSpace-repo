import { describe, expect, it } from "vitest";
import { cornerColorFor } from "./cornerColor";

describe("cornerColorFor", () => {
  it("is deterministic — the same key always gets the same color", () => {
    const key = "food-cooking-sourdough-baking";
    const first = cornerColorFor(key);
    for (let i = 0; i < 10; i++) {
      expect(cornerColorFor(key)).toBe(first);
    }
  });

  it("spreads different keys across more than one color", () => {
    const keys = [
      "food-cooking-sourdough-baking",
      "books-writing-storytelling",
      "art-creative-watercolor",
      "nature-outdoors-birdwatching",
      "crafts-making-woodworking",
      "music-vinyl-collecting",
      "gaming-tabletop-dungeons-and-dragons",
      "home-garden-houseplants",
    ];
    const colors = new Set(keys.map(cornerColorFor));
    expect(colors.size).toBeGreaterThan(1);
  });

  it("always returns one of the eight corner CSS variables", () => {
    const allowed = new Set([
      "var(--corner-terracotta)",
      "var(--corner-plum)",
      "var(--corner-forest)",
      "var(--corner-denim)",
      "var(--corner-mustard)",
      "var(--corner-olive)",
      "var(--corner-rose)",
      "var(--corner-sky)",
    ]);
    for (const key of ["a", "bb", "ccc", "space-slug-corner-slug", ""]) {
      expect(allowed.has(cornerColorFor(key))).toBe(true);
    }
  });
});
