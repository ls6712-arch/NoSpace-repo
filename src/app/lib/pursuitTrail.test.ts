import { describe, expect, it } from "vitest";
import { Post } from "../data/posts";
import { isStillMoving, lastMomentText, pursuitMoments, startedText, STILL_MOVING_DAYS } from "./pursuitTrail";
import { isOnlyYou } from "./visibility";

const DAY_MS = 24 * 60 * 60 * 1000;
const PURSUIT = "pursuit-1";
const OTHER_PURSUIT = "pursuit-2";

function makePost(overrides: Partial<Post> & { id: number; createdAt: number }): Post {
  return {
    hobbySlug: "ceramics",
    type: "photo",
    media: "",
    creator: "Mara",
    caption: "A caption",
    likes: 0,
    visibility: "public",
    ...overrides,
  };
}

describe("pursuitMoments", () => {
  it("returns nothing for a Pursuit with 0 Moments", () => {
    const posts = [makePost({ id: 1, createdAt: Date.now(), pursuitId: OTHER_PURSUIT })];
    expect(pursuitMoments(posts, PURSUIT, {})).toHaveLength(0);
  });

  it("returns exactly one for 1 Moment", () => {
    const posts = [makePost({ id: 1, createdAt: Date.now(), pursuitId: PURSUIT })];
    const result = pursuitMoments(posts, PURSUIT, {});
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("returns all 5, oldest to newest, for 5 Moments", () => {
    const posts = Array.from({ length: 5 }, (_, i) =>
      makePost({ id: i, createdAt: i * DAY_MS, pursuitId: PURSUIT }),
    ).reverse(); // stored out of order, as a real feed would be
    const result = pursuitMoments(posts, PURSUIT, {});
    expect(result).toHaveLength(5);
    expect(result.map((m) => m.id)).toEqual([0, 1, 2, 3, 4]);
  });

  it("returns all 12 for exactly 12 Moments (the trail's own display cap)", () => {
    const posts = Array.from({ length: 12 }, (_, i) =>
      makePost({ id: i, createdAt: i * DAY_MS, pursuitId: PURSUIT }),
    );
    expect(pursuitMoments(posts, PURSUIT, {})).toHaveLength(12);
  });

  it("returns all 40 — trimming to the displayed trail length is the caller's job, not this function's", () => {
    const posts = Array.from({ length: 40 }, (_, i) =>
      makePost({ id: i, createdAt: i * DAY_MS, pursuitId: PURSUIT }),
    );
    const result = pursuitMoments(posts, PURSUIT, {});
    expect(result).toHaveLength(40);
    expect(result[0].id).toBe(0);
    expect(result[39].id).toBe(39);
  });

  it("includes a Moment linked only via the local entryProject map (no pursuitId set)", () => {
    const posts = [makePost({ id: 7, createdAt: Date.now() })]; // no pursuitId
    const entryProject = { "7": PURSUIT };
    const result = pursuitMoments(posts, PURSUIT, entryProject);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(7);
  });

  it("does not double-count a Moment carrying both pursuitId and a matching entryProject entry", () => {
    const posts = [makePost({ id: 3, createdAt: Date.now(), pursuitId: PURSUIT })];
    const entryProject = { "3": PURSUIT };
    expect(pursuitMoments(posts, PURSUIT, entryProject)).toHaveLength(1);
  });
});

describe("isStillMoving", () => {
  it("is false with no last-Moment date", () => {
    expect(isStillMoving(undefined)).toBe(false);
  });

  it("is true just inside the window", () => {
    expect(isStillMoving(Date.now() - (STILL_MOVING_DAYS - 1) * DAY_MS)).toBe(true);
  });

  it("is false just outside the window", () => {
    expect(isStillMoving(Date.now() - (STILL_MOVING_DAYS + 1) * DAY_MS)).toBe(false);
  });
});

describe("lastMomentText", () => {
  it("has neutral wording with no Moments", () => {
    expect(lastMomentText(undefined)).toBe("No Moments yet.");
  });

  it("has neutral wording for a long gap — no warning, no nudge", () => {
    const text = lastMomentText(Date.now() - 400 * DAY_MS);
    expect(text).toBe("Last Moment 400 days ago.");
    expect(text).not.toMatch(/hasn't moved|come back|nudge/i);
  });
});

describe("startedText", () => {
  it("omits the year for the current year", () => {
    const now = new Date();
    expect(startedText(now.getTime())).not.toMatch(/\d{4}/);
  });

  it("includes the year for a past year", () => {
    const past = new Date(2020, 2, 1).getTime();
    expect(startedText(past)).toContain("2020");
  });
});

describe("isOnlyYou", () => {
  it("does not treat 'followers' as Only you", () => {
    expect(isOnlyYou({ visibility: "followers" })).toBe(false);
  });

  it("treats a future 'private' value as Only you", () => {
    expect(isOnlyYou({ visibility: "private" })).toBe(true);
  });

  it("does not treat 'public' or 'circle' as Only you", () => {
    expect(isOnlyYou({ visibility: "public" })).toBe(false);
    expect(isOnlyYou({ visibility: "circle" })).toBe(false);
  });
});
