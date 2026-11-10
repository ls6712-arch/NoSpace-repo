import { describe, expect, it } from "vitest";
import { canonicalCorner } from "../data/hobbies";
import { followedCorners, homeCornersRow } from "./homeCornersRow";

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
const slugs = (r: { slug: string }[]) => r.map((x) => x.slug);
const none = { followed: [] as string[], known, picks: [] as string[], affinity: new Map<string, number>() };

describe("the Corners row on Home", () => {
  it("shows a visitor the Corners with a 3D world, in catalog order", () => {
    expect(slugs(homeCornersRow(none))).toEqual(["pottery", "gardening", "reading", "board-games"]);
  });

  it("puts onboarding picks first, then affinity, then the rest", () => {
    const r = homeCornersRow({
      ...none,
      // Knitting is a pick too, but has no 3D world, so it is not in this row.
      picks: ["crafts-making/knitting", "gaming-tabletop/board-games", "books-writing/reading"],
      affinity: new Map([["home-garden/gardening", 3], ["crafts-making/pottery", 1], ["books-writing/reading", 9]]),
    });
    expect(slugs(r)).toEqual(["board-games", "reading", "gardening", "pottery"]);
  });

  it("shows someone who follows Corners the same 3D Corners, the ones they follow first", () => {
    // What the founder saw on Nov 10, 2026: following Embroidery and Vegetable gardens (no 3D world) hid every 3D Corner.
    const r = homeCornersRow({
      ...none,
      followed: ["crafts-making:knitting", "food-drink:baking", "books-writing:reading"],
      picks: ["crafts-making/pottery"],
      affinity: new Map([["gaming-tabletop/board-games", 5]]),
    });
    // Reading is followed, Pottery is a pick, Board games has affinity, Gardening is the rest. Knitting and Baking are not here.
    expect(slugs(r)).toEqual(["reading", "pottery", "board-games", "gardening"]);
    // Following only Corners without a 3D world changes nothing about the row.
    expect(slugs(homeCornersRow({ ...none, followed: ["crafts-making:knitting", "food-drink:baking"] }))).toEqual(slugs(homeCornersRow(none)));
  });

  it("never shows a followed Space, an empty follow or an unknown Corner as a Corner", () => {
    // What hobby_follows holds on the live site: whole-Space follows ("space:<slug>"), an empty key, older bare slugs.
    const followed = ["space:books-writing", "space:home-garden", "", "no-space:no-such-corner", "crafts-making:pottery", "knitting"];
    expect(slugs(followedCorners(followed, known))).toEqual(["pottery", "knitting"]);
    // Only the Pottery follow moves anything: a followed Space does not put its Corners first.
    expect(slugs(homeCornersRow({ ...none, followed }))).toEqual(["pottery", "gardening", "reading", "board-games"]);
    expect(slugs(homeCornersRow({ ...none, followed: ["space:books-writing", ""] }))).toEqual(["pottery", "gardening", "reading", "board-games"]);
  });

  it("shows no more than six, and each Corner once", () => {
    expect(slugs(homeCornersRow({ ...none, known: [...known, ...known], limit: 3 }))).toEqual(["pottery", "gardening", "reading"]);
    expect(homeCornersRow({ ...none, known: [...known, ...known] })).toHaveLength(4);
  });

  it("shows a Corner once, not also the Corners that were merged into it", () => {
    // Ceramics was merged into Pottery (MERGED_CORNERS), so it has Pottery's 3D world and opens Pottery's page.
    expect(canonicalCorner("art-creative", "ceramics")).toEqual({ spaceSlug: "crafts-making", slug: "pottery" });
    const r = homeCornersRow({ ...none, known: [c("art-creative", "ceramics", "Ceramics"), ...known] });
    expect(slugs(r)).toEqual(["pottery", "gardening", "reading", "board-games"]);
  });

  it("has nothing to show when no Corner has a 3D world", () => {
    expect(homeCornersRow({ ...none, known: [known[0], known[3]], followed: ["crafts-making:knitting"] })).toEqual([]);
  });
});
