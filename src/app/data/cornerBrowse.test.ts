import { describe, expect, it } from "vitest";
import { isBrowsableCorner } from "./hobbies";
import { MOOD_CHIPS, moodCards } from "./moodCards";
import { quickGuides } from "./cornerGuides";

describe("merged and hidden Corners in the Discover lists", () => {
  it("never appear on a mood chip's cards or in the 15 minutes row", () => {
    for (const chip of MOOD_CHIPS) {
      for (const c of moodCards(chip.id)) expect(isBrowsableCorner(c.spaceSlug, c.cornerSlug), `${chip.id}: ${c.cornerSlug}`).toBe(true);
    }
    for (const c of quickGuides()) expect(isBrowsableCorner(c.spaceSlug, c.cornerSlug), c.cornerSlug).toBe(true);
  });
});
