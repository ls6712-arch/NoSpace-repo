import { describe, expect, it } from "vitest";
import { MAX_CARDS, MAX_STEP, MOOD_CHIPS, moodCards } from "./moodCards";
import { categoryOfCorner } from "./cornerCategories";

describe("mood cards", () => {
  it("has the nine chips in the approved order", () => {
    expect(MOOD_CHIPS.map((c) => c.label)).toEqual([
      "15 minutes",
      "Make something",
      "Move",
      "Be around people",
      "Some time to yourself",
      "Get outside",
      "Learn something",
      "Play a game",
      "Start with what you have",
    ]);
  });

  it("gives every chip at least 5 and at most 10 cards whose steps fit", () => {
    for (const chip of MOOD_CHIPS) {
      const cards = moodCards(chip.id);
      expect(cards.length, chip.id).toBeGreaterThanOrEqual(5);
      expect(cards.length, chip.id).toBeLessThanOrEqual(MAX_CARDS);
      for (const c of cards) expect(c.guide.step.length, `${chip.id} ${c.cornerSlug}`).toBeLessThanOrEqual(MAX_STEP);
    }
  });

  it("never puts two cards of the same category next to each other", () => {
    for (const chip of MOOD_CHIPS) {
      const cats = moodCards(chip.id).map((c) => categoryOfCorner(c.spaceSlug, c.cornerSlug)?.slug ?? c.spaceSlug);
      // "Play a game" is all one category (Games and puzzles), so no order can separate them.
      if (new Set(cats).size < 2) continue;
      for (let i = 1; i < cats.length; i++) expect(cats[i], `${chip.id} at ${i}`).not.toBe(cats[i - 1]);
    }
  });
});
