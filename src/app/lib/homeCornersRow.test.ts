import { describe, expect, it } from "vitest";
import { canonicalCorner } from "../data/hobbies";
import { homeCornersRow } from "./homeCornersRow";

const c = (spaceSlug: string, slug: string, name: string) => ({ spaceSlug, slug, name });
// Catalog order. Four have a 3D world (Pottery, Gardening, Reading, Board games); Knitting and Baking do not.
const known = [
  c("crafts-making", "knitting", "Knitting"),
  c("crafts-making", "pottery", "Pottery"),
  c("home-garden", "gardening", "Gardening"),
  c("food-drink", "baking", "Baking"),
  c("books-writing", "reading", "Reading"),
  c("gaming-tabletop", "board-games", "Board games"),
];
const post = (hobbySlug: string, corner: string, createdAt: number) => ({ hobbySlug, subHobby: undefined, corner, createdAt });
const slugs = (r: { corners: { slug: string }[] }) => r.corners.map((x) => x.slug);
const none = { followed: [], known, feed: [], picks: [], affinity: new Map<string, number>() };

describe("the Corners row on Home", () => {
  it("shows a visitor the Corners with a 3D world, in catalog order", () => {
    const r = homeCornersRow(none);
    expect(r.yours).toBe(false);
    expect(slugs(r)).toEqual(["pottery", "gardening", "reading", "board-games"]);
  });

  it("puts onboarding picks first, then affinity, then the rest", () => {
    const r = homeCornersRow({
      ...none,
      // Knitting is a pick too, but has no 3D world, so it is not in this row.
      picks: ["crafts-making/knitting", "gaming-tabletop/board-games", "books-writing/reading"],
      affinity: new Map([["home-garden/gardening", 3], ["crafts-making/pottery", 1], ["books-writing/reading", 9]]),
    });
    expect(r.yours).toBe(false);
    expect(slugs(r)).toEqual(["board-games", "reading", "gardening", "pottery"]);
  });

  it("shows someone who follows Corners only those, the most recently active first, with or without a 3D world", () => {
    const r = homeCornersRow({
      ...none,
      followed: ["crafts-making:knitting", "food-drink:baking", "books-writing:reading"],
      feed: [post("books-writing", "reading", 50), post("food-drink", "baking", 90), post("crafts-making", "pottery", 99), post("food-drink", "baking", 10)],
      picks: ["crafts-making/pottery"],
    });
    expect(r.yours).toBe(true);
    // Knitting has no Moment in the feed, so it follows the two that do. Pottery is not followed, so it is not here.
    expect(slugs(r)).toEqual(["baking", "reading", "knitting"]);
  });

  it("shows no more than six, and each Corner once", () => {
    const many = Array.from({ length: 9 }, (_, i) => c("s", `corner-${i}`, `Corner ${i}`));
    const r = homeCornersRow({ ...none, known: many, followed: [...many.map((x) => `s:${x.slug}`), "s:corner-0"] });
    expect(r.corners).toHaveLength(6);
    expect(new Set(slugs(r)).size).toBe(6);
  });

  it("shows a Corner once, not also the Corners that were merged into it", () => {
    // Ceramics was merged into Pottery (MERGED_CORNERS), so it has Pottery's 3D world and opens Pottery's page.
    expect(canonicalCorner("art-creative", "ceramics")).toEqual({ spaceSlug: "crafts-making", slug: "pottery" });
    const r = homeCornersRow({ ...none, known: [c("art-creative", "ceramics", "Ceramics"), ...known] });
    expect(slugs(r)).toEqual(["pottery", "gardening", "reading", "board-games"]);
  });

  it("has nothing to show when no Corner has a 3D world and none is followed", () => {
    expect(homeCornersRow({ ...none, known: [known[0], known[3]] }).corners).toEqual([]);
  });
});
