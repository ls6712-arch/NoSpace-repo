import { describe, expect, it } from "vitest";
import { hobbies, HIDDEN_CORNERS, MERGED_CORNERS, canonicalCorner, findSpaceForInterest, formerLabelTarget, isBrowsableCorner, mergedSlugTarget } from "../data/hobbies";
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

  it("point every merge at a Corner that is kept and browsable, never at another merged Corner", () => {
    for (const [from, to] of Object.entries(MERGED_CORNERS)) {
      expect(to in MERGED_CORNERS, `${from} points at ${to}, which is itself merged away`).toBe(false);
      const [space, slug] = to.split("/");
      expect(isBrowsableCorner(space, slug), `${from} points at ${to}, which is not browsable`).toBe(true);
    }
  });

  it("relabels keep their slugs, so stored Moments and Pursuits still join", () => {
    const label = (space: string, slug: string) => hobbies.find((h) => h.slug === space)?.subItems.find((s) => s.slug === slug)?.label;
    expect(label("music", "choir")).toBe("Choir and singing");
    expect(label("crafts-making", "model-making")).toBe("Models and miniatures");
    expect(label("sports-fitness", "skating")).toBe("Roller and ice skating");
    expect(label("sports-fitness", "skateboarding")).toBe("Skateboarding");
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

describe("former labels", () => {
  // Typed text and saved labels from before the Oct 28, 2026 merges and relabels.
  const cases: [string, string][] = [
    ["Skating", "sports-fitness/skating"],
    ["Model-making", "crafts-making/model-making"],
    ["Choir", "music/choir"],
    ["Singing", "music/choir"],
    ["Miniatures", "crafts-making/model-making"],
    ["Kombucha", "food-cooking/fermentation"],
    ["Illustration", "art-creative/drawing"],
    ["Watercolor", "art-creative/painting"],
    ["Make a beat", "music/music-production"],
    ["Toys", "collecting-fandom/lego"],
    ["Furniture flipping", "crafts-making/upcycling"],
    ["Restoration", "crafts-making/upcycling"],
    ["Backpacking", "nature-outdoors/hiking"],
    ["Web design", "tech-building/coding"],
    ["Road trips", "travel-adventure/travel"],
    ["Exploration", "travel-adventure/travel"],
  ];

  it.each(cases)("finds the kept Corner for %s", (label, kept) => {
    const hit = findSpaceForInterest(label);
    expect(hit && `${hit.hobbySlug}/${hit.slug}`).toBe(kept);
    expect(isBrowsableCorner(hit!.hobbySlug, hit!.slug)).toBe(true);
  });

  it("ignores case and spaces around the label", () => {
    expect(findSpaceForInterest("  singing ")?.slug).toBe("choir");
    expect(findSpaceForInterest("MODEL-MAKING")?.slug).toBe("model-making");
  });

  it("covers the label of every merged-away Corner that has one", () => {
    for (const [from, to] of Object.entries(MERGED_CORNERS)) {
      const [space, slug] = from.split("/");
      const label = hobbies.find((h) => h.slug === space)?.subItems.find((s) => s.slug === slug)?.label;
      if (!label) continue;
      const hit = formerLabelTarget(label);
      expect(hit && `${hit.hobbySlug}/${hit.slug}`, label).toBe(to);
    }
  });

  it("leaves current labels and other text alone", () => {
    expect(findSpaceForInterest("Roller and ice skating")?.slug).toBe("skating");
    expect(findSpaceForInterest("Choir and singing")?.slug).toBe("choir");
    expect(findSpaceForInterest("Pottery")?.slug).toBe("pottery");
    expect(formerLabelTarget("Roller and ice skating")).toBeUndefined();
    expect(formerLabelTarget("Pottery")).toBeUndefined();
    expect(findSpaceForInterest("gift making")).toBeUndefined();
  });
});
