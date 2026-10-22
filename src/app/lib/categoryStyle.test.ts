import { describe, expect, it } from "vitest";
import { CORNER_CATEGORIES } from "../data/cornerCategories";
import { CATEGORY_ICON, categoryExamples, categoryField, cornerStyle } from "./categoryStyle";

describe("category look", () => {
  it("gives every category an icon and a hue", () => {
    for (const c of CORNER_CATEGORIES) {
      expect(CATEGORY_ICON[c.slug], c.slug).toBeDefined();
      expect(categoryField(c.slug), c.slug).toBeTruthy();
    }
  });

  it("never gives two neighbours in the 2-across or 4-across grid the same hue", () => {
    const hues = CORNER_CATEGORIES.map((c) => categoryField(c.slug));
    for (let i = 1; i < hues.length; i++) expect(hues[i], `${i}`).not.toBe(hues[i - 1]);
    for (let i = 4; i < hues.length; i++) expect(hues[i], `${i}`).not.toBe(hues[i - 4]);
  });

  it("shows three examples on a tile", () => {
    for (const c of CORNER_CATEGORIES) expect(categoryExamples(c).split(", ")).toHaveLength(3);
  });

  it("colours a Corner by its category, and an unmapped one by its old Space", () => {
    const crochet = cornerStyle("crafts-making", "crochet") as Record<string, string>;
    expect(crochet["--field"]).toBe("var(--field-rose)");
    const unmapped = cornerStyle("food-cooking", "no-such-corner") as Record<string, string>;
    expect(unmapped["--field"]).toBe("var(--field-terracotta)");
  });
});
