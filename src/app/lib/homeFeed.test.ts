import { describe, expect, it } from "vitest";
import type { Post } from "../data/posts";
import { buildFeed, classifyFeed, interleaveFeed, type FeedItem } from "./homeFeed";

const post = (id: number, over: Partial<Post> = {}): Post =>
  ({ id, hobbySlug: "kitchen", type: "photo", media: "", creator: "x", caption: "", likes: 0, createdAt: id, visibility: "public", ...over }) as Post;

const item = (id: number, source: FeedItem["source"]): FeedItem => ({ post: post(id), source });

describe("interleaveFeed", () => {
  it("puts one Space promotion after every third friend card", () => {
    const friends = [1, 2, 3, 4, 5, 6, 7].map((i) => item(i, "friend"));
    const spaces = [100, 101, 102].map((i) => item(i, "space"));
    expect(interleaveFeed(friends, spaces).map((i) => i.post.id)).toEqual([1, 2, 3, 100, 4, 5, 6, 101, 7]);
  });

  it("never exceeds a quarter at any prefix length", () => {
    const friends = Array.from({ length: 30 }, (_, i) => item(i + 1, "friend"));
    const spaces = Array.from({ length: 30 }, (_, i) => item(100 + i, "space"));
    const out = interleaveFeed(friends, spaces);
    let promos = 0;
    out.forEach((it, i) => {
      if (it.source === "space") promos++;
      expect(promos / (i + 1)).toBeLessThanOrEqual(0.25);
    });
  });

  it("shows no promotions when there are fewer than three friend cards", () => {
    expect(interleaveFeed([item(1, "friend"), item(2, "friend")], [item(100, "space")])).toHaveLength(2);
    expect(interleaveFeed([], [item(100, "space")])).toEqual([]);
  });

  it("drops spare promotions instead of bunching them", () => {
    const out = interleaveFeed([1, 2, 3].map((i) => item(i, "friend")), [100, 101].map((i) => item(i, "space")));
    expect(out.map((i) => i.post.id)).toEqual([1, 2, 3, 100]);
  });
});

describe("classifyFeed", () => {
  const inputs = { meId: "me", followingIds: ["f1"], spacePostIds: new Set([3, 4]), followedCorners: new Set(["pasta"]) };

  it("counts a friend's Moment at a Space as a friend card, not a promotion", () => {
    const { friends, spaces } = classifyFeed([post(3, { userId: "f1" })], inputs);
    expect(friends.map((i) => i.post.id)).toEqual([3]);
    expect(spaces).toEqual([]);
  });

  it("counts a stranger's Space Moment or followed Corner Moment as a promotion", () => {
    const { friends, spaces } = classifyFeed([post(4, { userId: "s" }), post(5, { userId: "s", subHobby: "pasta" })], inputs);
    expect(friends).toEqual([]);
    expect(spaces.map((i) => i.post.id)).toEqual([5, 4]);
  });

  it("skips your own and unrelated Moments", () => {
    const { friends, spaces } = classifyFeed([post(6, { userId: "me", subHobby: "pasta" }), post(7, { userId: "z" })], inputs);
    expect(friends.length + spaces.length).toBe(0);
  });
});

describe("buildFeed", () => {
  it("orders friends newest first", () => {
    const out = buildFeed([post(1, { userId: "f1" }), post(2, { userId: "f1" })], { followingIds: ["f1"], spacePostIds: new Set(), followedCorners: new Set() });
    expect(out.map((i) => i.post.id)).toEqual([2, 1]);
  });
});

describe("what Home can carry (Discover leaves all of it out)", () => {
  const inputs = { meId: "me", followingIds: ["pal"], spacePostIds: new Set([3]), followedCorners: new Set(["knitting"]) };
  const all = [
    post(1, { userId: "pal" }), // someone you follow
    post(2, { userId: "stranger" }), // a stranger, no Space, no Corner you follow
    post(3, { userId: "stranger2" }), // a stranger's Moment in a Space you joined
    post(4, { userId: "stranger3", subHobby: "knitting" }), // a stranger's Moment in a Corner you follow
    post(5, { userId: "me" }), // yours
  ];

  it("only ever carries followed people, joined Spaces' Moments and followed Corners' Moments", () => {
    const { friends, spaces } = classifyFeed(all, inputs);
    expect(friends.map((i) => i.post.id)).toEqual([1]);
    expect(spaces.map((i) => i.post.id).sort()).toEqual([3, 4]);
  });

  it("never carries a stranger's Moment that is in none of them, or your own", () => {
    const ids = [...classifyFeed(all, inputs).friends, ...classifyFeed(all, inputs).spaces].map((i) => i.post.id);
    expect(ids).not.toContain(2);
    expect(ids).not.toContain(5);
  });
});
