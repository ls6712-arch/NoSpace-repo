import { describe, expect, it } from "vitest";
import type { Post } from "../data/posts";
import { buildFeed, classifyFeed, type FeedInputs } from "./homeFeed";
import { discoverFeed, feedCornerChips, homeWouldShow, postCornerKey } from "./discoverFeed";
import type { DiscoverMoment } from "./discover";

const NOW = Date.parse("2026-10-31T12:00:00Z");
const post = (id: number, userId: string, over: Partial<Post> = {}): Post =>
  ({
    id, userId, hobbySlug: "crafts-making", subHobby: "pottery", creator: "x", caption: "c", likes: 0, createdAt: NOW - id * 60_000,
    visibility: "public", type: "photo", media: "", ...over,
  }) as Post;
const moment = (p: Post): DiscoverMoment => ({ postId: p.id, authorId: p.userId ?? "", createdAt: new Date(p.createdAt).toISOString(), cornerKey: postCornerKey(p) });

// Me = "me". I follow "pal". I joined a Space whose approved Moments include post 3. I follow the Corner "knitting".
const home: FeedInputs = { meId: "me", followingIds: ["pal"], spacePostIds: new Set([3]), followedCorners: new Set(["knitting"]) };

const posts = [
  post(1, "pal"), // followed author: Home
  post(2, "stranger"), // plain stranger: Discover
  post(3, "stranger2"), // shared to a Space I joined: Home
  post(4, "stranger3", { subHobby: "knitting" }), // stranger in a Corner I follow: Home promotes it
  post(5, "me"), // mine: neither
  post(6, "stranger4", { subHobby: "sourdough", hobbySlug: "food-cooking" }), // plain stranger: Discover
];

describe("Home and Discover never carry the same Moment", () => {
  it("splits every Moment to Home or Discover, never both", () => {
    // Pretend the server returned every Moment (it should have left out 1, 3 and 5; the client must cope if it does not).
    const discover = discoverFeed(posts.map(moment), posts, home).map((p) => p.id);
    // Everything Home is able to carry (its promotions only appear after three friend cards, but any of them may).
    const { friends, spaces } = classifyFeed(posts, home);
    const homeCan = [...friends, ...spaces].map((i) => i.post.id).sort();
    const onHome = buildFeed(posts, home).map((i) => i.post.id);
    expect(discover.filter((id) => homeCan.includes(id))).toEqual([]);
    expect(discover.filter((id) => onHome.includes(id))).toEqual([]);
    expect(discover).toEqual([2, 6]);
    expect(homeCan).toEqual([1, 3, 4]);
  });

  it("drops a stranger's Moment in a Corner the person follows, because Home shows it", () => {
    expect(homeWouldShow(posts[3], home)).toBe(true);
    expect(discoverFeed([moment(posts[3])], posts, home)).toEqual([]);
  });

  it("hides an author the person just followed, without a reload", () => {
    expect(discoverFeed(posts.map(moment), posts, home, new Set(["stranger"])).map((p) => p.id)).toEqual([6]);
  });

  it("keeps the server's order and skips a Moment the app does not hold", () => {
    const ms = [moment(posts[5]), { ...moment(posts[1]), postId: 999 }, moment(posts[1])];
    expect(discoverFeed(ms, posts, home).map((p) => p.id)).toEqual([6, 2]);
  });
});

describe("feedCornerChips", () => {
  it("ranks Corners by Moments in the last day, three to five of them", () => {
    const ps = [
      ...[1, 2, 3].map((i) => post(10 + i, `u${i}`, { subHobby: "pottery" })),
      ...[1, 2].map((i) => post(20 + i, `v${i}`, { subHobby: "sourdough", hobbySlug: "food-cooking" })),
      post(31, "w1", { subHobby: "knitting" }),
      post(32, "w2", { subHobby: "chess", hobbySlug: "gaming-tabletop" }),
      post(33, "w3", { subHobby: "poetry", hobbySlug: "books-writing" }),
      post(34, "w4", { subHobby: "yoga", hobbySlug: "health-wellness" }),
      post(35, "w5", { subHobby: "tennis", hobbySlug: "sports-fitness", createdAt: NOW - 3 * 86_400_000 }),
    ];
    const chips = feedCornerChips(ps, NOW);
    expect(chips).toHaveLength(5);
    expect(chips.slice(0, 2)).toEqual(["crafts-making/pottery", "food-cooking/sourdough"]);
    expect(chips).not.toContain("sports-fitness/tennis");
  });

  it("falls back to older Moments when fewer than three Corners have anything from today", () => {
    const ps = [post(1, "a"), post(2, "b", { subHobby: "chess", hobbySlug: "gaming-tabletop", createdAt: NOW - 5 * 86_400_000 }), post(3, "c", { subHobby: "yoga", hobbySlug: "health-wellness", createdAt: NOW - 6 * 86_400_000 })];
    expect(feedCornerChips(ps, NOW)).toEqual(["crafts-making/pottery", "gaming-tabletop/chess", "health-wellness/yoga"]);
  });
});
