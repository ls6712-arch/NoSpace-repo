import { describe, expect, it } from "vitest";
import { hobbies, HIDDEN_CORNERS, MERGED_CORNERS, canonicalCorner, isBrowsableCorner, mergedSlugTarget } from "../data/hobbies";
import { isInCorner, postCornerKey } from "./cornerAlias";

const post = (hobbySlug: string, corner?: string, subHobby?: string) => ({ hobbySlug, corner, subHobby });
const exists = (key: string) => {
  const [sp, sl] = key.split("/");
  return !!hobbies.find((h) => h.slug === sp)?.subItems.some((s) => s.slug === sl);
};

describe("merged and hidden Corners", () => {
  it("name only Corners that exist, and no chains", () => {
    for (const [from, to] of Object.entries(MERGED_CORNERS)) {
      expect(exists(from), from).toBe(true);
      expect(exists(to), to).toBe(true);
      expect(to in MERGED_CORNERS, `${to} is itself merged away`).toBe(false);
    }
    for (const slug of HIDDEN_CORNERS) expect(hobbies.some((h) => h.subItems.some((s) => s.slug === slug)), slug).toBe(true);
  });

  it("never hide a Corner that others are merged into", () => {
    for (const to of Object.values(MERGED_CORNERS)) expect(HIDDEN_CORNERS.has(to.split("/")[1]), to).toBe(false);
  });

  it("resolve a merged-away Corner to the kept one, and leave the rest alone", () => {
    expect(canonicalCorner("food-cooking", "espresso")).toEqual({ spaceSlug: "food-cooking", slug: "coffee" });
    expect(canonicalCorner("art-creative", "ceramics")).toEqual({ spaceSlug: "crafts-making", slug: "pottery" });
    expect(canonicalCorner("photography-film", "outdoor-photography")).toEqual({ spaceSlug: "photography-film", slug: "photography" });
    expect(canonicalCorner("food-cooking", "Pasta")).toEqual({ spaceSlug: "food-cooking", slug: "pasta" });
    expect(mergedSlugTarget("espresso")).toBe("coffee");
    expect(mergedSlugTarget("outdoor-photography")).toBe("photography");
    expect(mergedSlugTarget("coffee")).toBeUndefined();
  });

  it("are not browsable, but the kept Corners are", () => {
    expect(isBrowsableCorner("food-cooking", "espresso")).toBe(false);
    expect(isBrowsableCorner("tech-building", "cad")).toBe(false);
    expect(isBrowsableCorner("food-cooking", "coffee")).toBe(true);
  });
});

describe("Moments of a merged Corner", () => {
  it("count under the kept Corner, however they were tagged", () => {
    expect(postCornerKey(post("food-cooking", "espresso"))).toBe("food-cooking/coffee");
    expect(postCornerKey(post("art-creative", undefined, "ceramics"))).toBe("crafts-making/pottery");
    expect(postCornerKey(post("food-cooking"))).toBeUndefined();
    expect(isInCorner(post("food-cooking", "home-coffee"), "food-cooking", "coffee")).toBe(true);
    expect(isInCorner(post("food-cooking", "coffee"), "food-cooking", "espresso")).toBe(true);
    expect(isInCorner(post("food-cooking", "tea"), "food-cooking", "coffee")).toBe(false);
    expect(isInCorner(post("art-creative", "Ceramics"), "crafts-making", "pottery")).toBe(true);
  });
});
