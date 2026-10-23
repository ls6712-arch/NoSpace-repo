import { describe, expect, it } from "vitest";
import { CORNER_CATEGORIES } from "../data/cornerCategories";
import { CATEGORY_ICON, categoryColor, cornerColor } from "./categoryStyle";

describe("category look", () => {
  it("gives every category an icon and a colour", () => {
    for (const c of CORNER_CATEGORIES) {
      expect(CATEGORY_ICON[c.slug], c.slug).toBeDefined();
      expect(categoryColor(c.slug), c.slug).toBeTruthy();
    }
  });

  it("follows the approved map", () => {
    const expected = [
      "rose", "orange", "violet", "blue", "amber", "lime", "teal", "pink", "teal", "rose",
      "blue", "violet", "orange", "violet", "lime", "pink", "blue", "teal",
    ];
    expect(CORNER_CATEGORIES.map((c) => categoryColor(c.slug))).toEqual(expected);
  });

  it("never gives two neighbours in the 4-across grid the same colour", () => {
    const hues = CORNER_CATEGORIES.map((c) => categoryColor(c.slug));
    for (let i = 0; i < hues.length; i++) {
      if (i % 4 !== 0) expect(hues[i], `left of ${i}`).not.toBe(hues[i - 1]);
      if (i >= 4) expect(hues[i], `above ${i}`).not.toBe(hues[i - 4]);
    }
  });

  it("colours a Corner by its category, and an unmapped one by its old Space", () => {
    expect(cornerColor("crafts-making", "crochet")).toBe("rose");
    expect(cornerColor("food-cooking", "no-such-corner")).toBe(cornerColor("food-cooking", "other-unmapped"));
  });
});
