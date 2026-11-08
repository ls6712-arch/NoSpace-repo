import { describe, expect, it } from "vitest";
import { mergeWalls, yourCorners, type HomeWallCard } from "./homeYourCorners";
import type { WallCard } from "./cornerWalls";

const known = [
  { spaceSlug: "ceramics", slug: "pottery", name: "Pottery" },
  { spaceSlug: "fitness", slug: "running", name: "Running" },
  { spaceSlug: "music", slug: "guitar", name: "Guitar" },
];
const post = (hobbySlug: string, corner: string, createdAt: number) => ({ hobbySlug, corner, createdAt });

describe("yourCorners", () => {
  it("uses followed Corners, by space:slug key or an older bare slug", () => {
    const r = yourCorners(["ceramics:pottery", "guitar"], known, []);
    expect(r.fallback).toBe(false);
    expect(r.corners.map((c) => c.name)).toEqual(["Pottery", "Guitar"]);
  });
  it("keeps a followed Corner it does not know yet, by its key", () => {
    expect(yourCorners(["food:sourdough"], known, []).corners).toEqual([{ spaceSlug: "food", slug: "sourdough", name: "sourdough" }]);
  });
  it("falls back to the Corners of the newest public Moments, each once, at most the limit", () => {
    const feed = [post("fitness", "running", 1), post("ceramics", "pottery", 3), post("ceramics", "pottery", 2), post("music", "guitar", 0)];
    const r = yourCorners([], known, feed, 2);
    expect(r.fallback).toBe(true);
    expect(r.corners.map((c) => c.slug)).toEqual(["pottery", "running"]);
  });
  it("is empty with nothing followed and nothing public", () => {
    expect(yourCorners([], known, [])).toEqual({ corners: [], fallback: true });
  });
});

describe("mergeWalls", () => {
  const card = (postId: number, postedAt: number, mine = false) =>
    ({ card: { postId, postedAt, mine } as WallCard, corner: known[0] }) as HomeWallCard;
  it("drops your own Moments and duplicates, newest first, up to the limit", () => {
    const out = mergeWalls([card(1, 10), card(2, 30, true), card(3, 20), card(1, 10), card(4, 5)], 3);
    expect(out.map((c) => c.card.postId)).toEqual([3, 1, 4]);
  });
});
