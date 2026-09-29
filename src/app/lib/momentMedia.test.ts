import { describe, expect, it } from "vitest";
import { isCacheEntryFresh, partitionCachedPaths, resolvePostMedia } from "./momentMedia";
import { Post } from "../data/posts";

const basePost: Post = {
  id: 1,
  hobbySlug: "pottery",
  type: "photo",
  media: "",
  creator: "Alex",
  caption: "hi",
  likes: 0,
  createdAt: 0,
  visibility: "public",
};

describe("isCacheEntryFresh", () => {
  it("is fresh strictly before its expiry", () => {
    expect(isCacheEntryFresh({ url: "x", expiresAt: 1000 }, 500)).toBe(true);
  });

  it("is not fresh at or after its expiry", () => {
    expect(isCacheEntryFresh({ url: "x", expiresAt: 1000 }, 1000)).toBe(false);
    expect(isCacheEntryFresh({ url: "x", expiresAt: 1000 }, 1500)).toBe(false);
  });
});

describe("partitionCachedPaths", () => {
  it("answers entirely from the cache when every path is fresh", () => {
    const cache = new Map([
      ["a", { url: "url-a", expiresAt: 1000 }],
      ["b", { url: "url-b", expiresAt: 1000 }],
    ]);
    const { cached, toSign } = partitionCachedPaths(["a", "b"], cache, 500);
    expect(toSign).toEqual([]);
    expect(Object.fromEntries(cached)).toEqual({ a: "url-a", b: "url-b" });
  });

  it("sends an uncached path to sign, keeps a cached one from the cache", () => {
    const cache = new Map([["a", { url: "url-a", expiresAt: 1000 }]]);
    const { cached, toSign } = partitionCachedPaths(["a", "b"], cache, 500);
    expect(toSign).toEqual(["b"]);
    expect(Object.fromEntries(cached)).toEqual({ a: "url-a" });
  });

  it("re-signs a path whose cached entry has gone stale, even if it's still in the map", () => {
    const cache = new Map([["a", { url: "url-a", expiresAt: 1000 }]]);
    const { cached, toSign } = partitionCachedPaths(["a"], cache, 1000);
    expect(toSign).toEqual(["a"]);
    expect(cached.size).toBe(0);
  });

  it("returns nothing to sign and an empty cache for an empty input", () => {
    const { cached, toSign } = partitionCachedPaths([], new Map(), 0);
    expect(toSign).toEqual([]);
    expect(cached.size).toBe(0);
  });
});

describe("resolvePostMedia", () => {
  it("leaves a legacy post (no mediaPaths) completely unchanged", () => {
    const post: Post = { ...basePost, media: "https://legacy/url.jpg" };
    expect(resolvePostMedia(post, new Map())).toBe(post);
  });

  it("fills media and mediaUrls from the signed map, in path order", () => {
    const post: Post = { ...basePost, mediaPaths: ["a", "b"] };
    const signed = new Map([
      ["a", "https://signed/a"],
      ["b", "https://signed/b"],
    ]);
    const result = resolvePostMedia(post, signed);
    expect(result.media).toBe("https://signed/a");
    expect(result.mediaUrls).toEqual(["https://signed/a", "https://signed/b"]);
  });

  it("drops a path the signing call couldn't resolve, keeping the rest", () => {
    const post: Post = { ...basePost, mediaPaths: ["a", "missing", "b"] };
    const signed = new Map([
      ["a", "https://signed/a"],
      ["b", "https://signed/b"],
    ]);
    const result = resolvePostMedia(post, signed);
    expect(result.mediaUrls).toEqual(["https://signed/a", "https://signed/b"]);
  });

  it("renders as no media at all when every path is unresolved", () => {
    const post: Post = { ...basePost, mediaPaths: ["gone"] };
    const result = resolvePostMedia(post, new Map());
    expect(result.media).toBe("");
    expect(result.mediaUrls).toEqual([]);
  });
});
