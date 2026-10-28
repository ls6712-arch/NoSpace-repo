import { describe, expect, it } from "vitest";
import { categoryOfCorner } from "../data/cornerCategories";
import { relatedCorner } from "./relatedCorner";

describe("relatedCorner", () => {
  it("picks another Corner from the same group, never itself", () => {
    const r = relatedCorner("food-cooking", "pasta");
    expect(r).toBeDefined();
    expect(r!.slug).not.toBe("pasta");
    expect(categoryOfCorner(r!.spaceSlug, r!.slug)?.slug).toBe(categoryOfCorner("food-cooking", "pasta")?.slug);
  });

  it("is the same answer every time", () => {
    expect(relatedCorner("food-cooking", "pasta")?.slug).toBe(relatedCorner("food-cooking", "pasta")?.slug);
  });

  it("has nothing for a Corner outside the 18 groups", () => {
    expect(relatedCorner("no-such-space", "no-such-corner")).toBeUndefined();
  });
});
