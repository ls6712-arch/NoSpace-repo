import { describe, expect, it } from "vitest";
import { CORNER_GUIDES } from "../../data/cornerGuides";
import { categoryOfCorner } from "../../data/cornerCategories";
import {
  DAY_MS,
  DEFAULT_WEIGHTS,
  authorAffinity,
  categoryAffinity,
  cornerAffinity,
  freshness,
  friendDidIt,
  libraryPrior,
  mergeWeights,
  momentQuality,
  novelty,
  rankMoments,
  rankRooms,
  rankTickets,
  seenTonight,
  timeFit,
  type RankPost,
  type Signals,
  type TicketCandidate,
} from "./index";

// Wednesday Oct 21, 2026, 12:00 local: a weekday daytime.
const NOW = new Date(2026, 9, 21, 12, 0, 0).getTime();
const ago = (days: number) => NOW - days * DAY_MS;

const candidates: TicketCandidate[] = Object.entries(CORNER_GUIDES).map(([key, guide]) => {
  const [spaceSlug, cornerSlug] = key.split("/");
  return { spaceSlug, cornerSlug, label: cornerSlug, guide };
});

function signals(over: Partial<Signals> = {}): Signals {
  return {
    viewerId: "me",
    now: NOW,
    following: new Map(),
    blockedIds: new Set(),
    interactions: [],
    cornerEvents: [],
    hobbyFollowKeys: new Set(),
    ownMoments: [
      { cornerKey: "art-creative/drawing", createdAt: ago(40) },
      { cornerKey: "art-creative/drawing", createdAt: ago(41) },
      { cornerKey: "art-creative/drawing", createdAt: ago(42) },
    ],
    reportedMomentIds: new Set(),
    savedTicketKeys: new Set(),
    ...over,
  };
}

let nextId = 1;
function post(over: Partial<RankPost> = {}): RankPost {
  return {
    id: nextId++,
    userId: "u" + nextId,
    createdAt: ago(1),
    visibility: "public",
    type: "photo",
    hasMedia: true,
    hobbySlug: "gaming-tabletop",
    corner: "board-games",
    caption: "A caption",
    loveCount: 0,
    inCount: 0,
    thoughtCount: 0,
    ...over,
  };
}

describe("features", () => {
  it("authorAffinity: exact values from hand-built interactions", () => {
    // One thought today: x = 3, 1 - exp(-3/6).
    expect(authorAffinity([{ authorId: "a", kind: "thought", at: NOW }], "a", NOW)).toBeCloseTo(1 - Math.exp(-0.5), 10);
    // A love 21 days ago is worth half: x = 0.5.
    expect(authorAffinity([{ authorId: "a", kind: "love", at: ago(21) }], "a", NOW)).toBeCloseTo(1 - Math.exp(-0.5 / 6), 10);
    // Other authors and anything older than 90 days count for nothing.
    expect(authorAffinity([{ authorId: "b", kind: "countMeIn", at: NOW }], "a", NOW)).toBe(0);
    expect(authorAffinity([{ authorId: "a", kind: "countMeIn", at: ago(91) }], "a", NOW)).toBe(0);
  });

  it("cornerAffinity, categoryAffinity: exact values", () => {
    const own = [{ cornerKey: "a/b", kind: "own" as const, at: NOW }];
    expect(cornerAffinity(own, new Set(), "a/b", NOW)).toBeCloseTo(1 - Math.exp(-0.5), 10); // 3
    expect(cornerAffinity([{ cornerKey: "a/b", kind: "love", at: NOW }], new Set(), "a/b", NOW)).toBeCloseTo(1 - Math.exp(-1 / 6), 10);
    expect(cornerAffinity([], new Set(["a/b"]), "a/b", NOW)).toBeCloseTo(1 - Math.exp(-2 / 6), 10); // hobby follow
    // The category takes the best Corner in it, times 0.6.
    expect(categoryAffinity("games-puzzles", (k) => (k === "gaming-tabletop/chess" ? 0.5 : 0.1))).toBeCloseTo(0.3, 10);
  });

  it("friendDidIt, novelty, freshness, libraryPrior, timeFit", () => {
    const following = new Map([["f", { name: "Theo" }]]);
    const p = post({ userId: "f", createdAt: ago(1) });
    expect(friendDidIt([p], following, "gaming-tabletop/board-games", NOW)).toEqual({ value: 1, userId: "f" });
    expect(friendDidIt([{ ...p, createdAt: ago(8) }], following, "gaming-tabletop/board-games", NOW).value).toBe(0);
    expect(friendDidIt([{ ...p, userId: "stranger" }], following, "gaming-tabletop/board-games", NOW).value).toBe(0);
    expect(novelty([{ cornerKey: "x/y", createdAt: 1 }], "x/y")).toBe(0);
    expect(novelty([], "x/y")).toBe(1);
    expect(freshness(NOW, NOW)).toBe(1);
    expect(freshness(NOW - 1.5 * DAY_MS, NOW)).toBeCloseTo(0.5, 10);
    expect(libraryPrior({ quick: true, order: 12 })).toBeCloseTo(0.88, 10);
    expect(libraryPrior({})).toBe(0.3);
    expect(timeFit({ quick: true, together: "solo", where: "indoors" }, new Date(NOW)).value).toBe(1);
    expect(timeFit({ together: "solo", where: "indoors" }, new Date(NOW)).value).toBe(0.5);
    expect(timeFit({ together: "together", where: "indoors" }, new Date(2026, 9, 23, 19)).fits).toBe("weekend");
  });

  it("every feature returns 0 to 1", () => {
    const wild = { loveCount: 1e9, inCount: 1e9, thoughtCount: 1e9 };
    for (const q of [momentQuality({ loveCount: 0, inCount: 0, thoughtCount: 0 }), momentQuality(wild), momentQuality({ loveCount: -5, inCount: 0, thoughtCount: 0 })]) {
      expect(q).toBeGreaterThanOrEqual(0);
      expect(q).toBeLessThanOrEqual(1);
    }
    expect(momentQuality({ loveCount: 0, inCount: 0, thoughtCount: 0 })).toBe(0);
    for (const c of candidates) {
      const v = [libraryPrior(c.guide), timeFit(c.guide, new Date(NOW)).value];
      for (const n of v) expect(n >= 0 && n <= 1).toBe(true);
    }
  });
});

describe("filters", () => {
  it("a blocked author, the viewer's own Moment and a reported Moment never appear", () => {
    const own = post({ userId: "me" });
    const blocked = post({ userId: "bad" });
    const reported = post({ userId: "x" });
    const ok = post({ userId: "ok" });
    const s = signals({ blockedIds: new Set(["bad"]), reportedMomentIds: new Set([reported.id]) });
    const ids = rankMoments([own, blocked, reported, ok], s).map((m) => m.post.id);
    expect(ids).toEqual([ok.id]);
    expect(rankRooms([own, blocked], s).every((r) => r.here.length === 0)).toBe(true);
  });

  it("followers-only Moments show only to followers; Moments older than the window are dropped", () => {
    const f = post({ userId: "f", visibility: "followers" });
    const stranger = post({ userId: "z", visibility: "followers" });
    const old = post({ userId: "o", createdAt: ago(9) });
    const s = signals({ following: new Map([["f", { name: "Fay" }]]) });
    const ids = rankMoments([f, stranger, old], s, DEFAULT_WEIGHTS, { windowDays: 7 }).map((m) => m.post.id);
    expect(ids).toEqual([f.id]);
  });

  it("tickets: adults-only, recently logged and saved Corners are removed", () => {
    const s = signals({
      ownMoments: [
        { cornerKey: "gaming-tabletop/chess", createdAt: ago(3) },
        { cornerKey: "art-creative/drawing", createdAt: ago(40) },
        { cornerKey: "art-creative/drawing", createdAt: ago(41) },
      ],
      savedTicketKeys: new Set(["gaming-tabletop/puzzles"]),
    });
    const keys = rankTickets(candidates, [], s, DEFAULT_WEIGHTS, 200).map((t) => `${t.card.spaceSlug}/${t.card.cornerSlug}`);
    expect(keys).not.toContain("gaming-tabletop/chess");
    expect(keys).not.toContain("gaming-tabletop/puzzles");
    for (const t of rankTickets(candidates, [], s, DEFAULT_WEIGHTS, 200)) expect(t.card.guide.adultsOnly).toBeFalsy();
  });
});

describe("tickets", () => {
  const followed = new Map([["theo", { name: "Theo Park" }]]);

  it("a followed author's Board games yesterday is ticket 1, and the reason names them", () => {
    const s = signals({ following: followed });
    const posts = [post({ userId: "theo", createdAt: ago(1), hobbySlug: "gaming-tabletop", corner: "board-games" })];
    const row = rankTickets(candidates, posts, s);
    expect(row[0].card.cornerSlug).toBe("board-games");
    expect(row[0].reason).toBe("Theo did this this week");
  });

  it("no two adjacent tickets share a category, and the row is capped at 10", () => {
    const row = rankTickets(candidates, [], signals());
    expect(row).toHaveLength(10);
    const cats = row.map((t) => categoryOfCorner(t.card.spaceSlug, t.card.cornerSlug)?.slug);
    for (let i = 1; i < cats.length; i++) expect(cats[i]).not.toBe(cats[i - 1]);
  });

  it("slot 4 holds a discovery ticket: never tried, in a category the viewer hasn't touched", () => {
    const s = signals({ following: followed });
    const row = rankTickets(candidates, [], s);
    const t = row[3];
    expect(t.reasonKind).toBe("exploration");
    expect(t.reason).toBe("Something new for you");
    const key = `${t.card.spaceSlug}/${t.card.cornerSlug}`;
    expect(s.ownMoments.some((m) => m.cornerKey === key)).toBe(false);
    expect(row.slice(0, 3).every((r) => r.reasonKind !== "exploration")).toBe(true);
  });

  it("cold start: a brand-new viewer gets a full row, ordered by time fit then the library", () => {
    const s = signals({ ownMoments: [] });
    const row = rankTickets(candidates, [], s);
    expect(row).toHaveLength(10);
    expect(row.every((t) => t.reasonKind === "timeFit" || t.reasonKind === "libraryPrior")).toBe(true);
    expect(row[0].card.guide.quick).toBe(true); // a weekday daytime fits the quick ones
  });

  it("the reason is a sentence from the table", () => {
    const row = rankTickets(candidates, [], signals({ ownMoments: [] }));
    for (const t of row) expect(t.reason).toMatch(/^(A good first step|Fits a (weeknight|weekend))$/);
  });
});

describe("moments", () => {
  it("the top 4 come from 4 different authors, and no author twice in a row", () => {
    const posts: RankPost[] = [];
    for (let a = 0; a < 6; a++) for (let k = 0; k < 3; k++) posts.push(post({ userId: "a" + a, createdAt: ago(0.1 * (a * 3 + k + 1)) }));
    const ranked = rankMoments(posts, signals());
    const top = ranked.slice(0, 4).map((m) => m.post.userId);
    expect(new Set(top).size).toBe(4);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i].post.userId).not.toBe(ranked[i - 1].post.userId);
  });

  it("cold start: newest public Moments with a photo, best-smoothed first", () => {
    const loved = post({ userId: "a", loveCount: 9 });
    const plain = post({ userId: "b" });
    const noPhoto = post({ userId: "c", hasMedia: false, type: "written", loveCount: 50 });
    const ranked = rankMoments([plain, noPhoto, loved], signals({ ownMoments: [] }));
    expect(ranked.map((m) => m.post.id)).toEqual([loved.id, plain.id]);
  });

  it("Seen tonight is 3 photos and 1 quote", () => {
    const posts = [
      ...[1, 2, 3, 4].map((n) => post({ userId: "p" + n })),
      post({ userId: "q1", hasMedia: false, type: "written", caption: "Slower next week." }),
    ];
    const { photos, quote } = seenTonight(rankMoments(posts, signals()));
    expect(photos).toHaveLength(3);
    expect(quote?.caption).toBe("Slower next week.");
  });

  it("the collage shows 3 different people when it can", () => {
    const posts = [
      ...[1, 2, 3].map((n) => post({ userId: "same", createdAt: ago(0.1 * n) })),
      post({ userId: "x", createdAt: ago(0.5) }),
      post({ userId: "y", createdAt: ago(0.6) }),
    ];
    const { photos } = seenTonight(rankMoments(posts, signals()));
    expect(new Set(photos.map((p) => p.userId)).size).toBe(3);
  });
});

describe("rooms", () => {
  it("names only followed people (at most 2) and never a number", () => {
    const following = new Map([
      ["a", { name: "Ana Ruiz" }],
      ["b", { name: "Ben Cho" }],
      ["c", { name: "Cy Dahl" }],
    ]);
    const posts = [
      post({ userId: "a", createdAt: ago(1) }),
      post({ userId: "b", createdAt: ago(2) }),
      post({ userId: "c", createdAt: ago(3) }),
      post({ userId: "stranger", createdAt: ago(1) }),
    ];
    const rooms = rankRooms(posts, signals({ following }));
    const games = rooms.find((r) => r.slug === "games-puzzles")!;
    expect(games.here).toHaveLength(2);
    expect(games.presence).toBe("Ana and Ben are here");
    expect(rooms[0].slug).toBe("games-puzzles"); // followed people logged there
    expect(games.presence).not.toMatch(/\d/);
    expect(rooms.find((r) => r.slug === "music-sound")!.presence).toBe("Quiet right now");
    expect(rooms.find((r) => r.slug === "music-sound")!.quiet).toBe(true);
    expect(JSON.stringify(rooms)).not.toContain("stranger");
  });
});

describe("weights", () => {
  it("overriding app_config.ranking_weights changes the order", () => {
    const a = post({ userId: "a", hasMedia: true, loveCount: 40, createdAt: ago(4) });
    const b = post({ userId: "b", hasMedia: false, type: "written", loveCount: 0, createdAt: ago(0.1) });
    const s = signals();
    const base = rankMoments([a, b], s).map((m) => m.post.id);
    const tuned = rankMoments(
      [a, b],
      s,
      mergeWeights({ moments: { love: { w: { momentQuality: 40, hasPhoto: 10 } }, value: { love: 40 } } }),
    ).map((m) => m.post.id);
    expect(tuned).not.toEqual(base);
    expect(tuned[0]).toBe(a.id);
  });

  it("ignores anything in the override that is not a known number", () => {
    const w = mergeWeights({ moments: { value: { love: "lots", nope: 3 } }, evil: { x: 1 }, rooms: { anyPublic: 7 } });
    expect(w.moments.value.love).toBe(DEFAULT_WEIGHTS.moments.value.love);
    expect(w.rooms.anyPublic).toBe(7);
    expect((w as unknown as Record<string, unknown>).evil).toBeUndefined();
    expect(mergeWeights(null)).toEqual(DEFAULT_WEIGHTS);
  });
});

describe("what the ranking reads", () => {
  it("never reads a follower count, or anything outside the RankPost fields", () => {
    const allowed = new Set(["id", "userId", "createdAt", "visibility", "type", "hasMedia", "hobbySlug", "corner", "caption", "loveCount", "inCount", "thoughtCount"]);
    const read = new Set<string>();
    const spy = (p: RankPost): RankPost =>
      new Proxy({ ...p, followerCount: 1_000_000, followers: 1_000_000 } as RankPost, {
        get(target, key) {
          if (typeof key === "string") read.add(key);
          return Reflect.get(target, key);
        },
      });
    const posts = [1, 2, 3, 4, 5].map((n) => spy(post({ userId: "u" + n })));
    rankMoments(posts, signals({ following: new Map([["u1", { name: "One" }]]) }));
    rankRooms(posts, signals({ following: new Map([["u1", { name: "One" }]]) }));
    rankTickets(candidates, posts, signals());
    expect(read.size).toBeGreaterThan(0);
    for (const k of read) {
      expect(k).not.toMatch(/follower/i);
      expect(allowed.has(k)).toBe(true);
    }
  });
});
