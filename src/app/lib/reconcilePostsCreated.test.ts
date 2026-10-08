import { describe, expect, it } from "vitest";
import { badges } from "../data/badges";
import { reconcilePostsCreated } from "./reconcilePostsCreated";

const stats = (postsCreated: number) => ({
  points: 0, postsCreated, likesGiven: 0, purchases: 0, hobbiesVisited: [], hobbiesPosted: [],
});
const firstSession = badges.find((b) => b.id === "first-session")!;

describe("First Session milestone", () => {
  it("is not newly unlocked by a post on an account that already has 21 Moments", () => {
    const before = reconcilePostsCreated(0, 21);
    expect(firstSession.test(stats(before))).toBe(true);
    expect(firstSession.test(stats(before + 1))).toBe(true); // already unlocked before, so no toast
  });
  it("still unlocks on a genuine first Moment", () => {
    expect(firstSession.test(stats(reconcilePostsCreated(0, 0)))).toBe(false);
    expect(firstSession.test(stats(1))).toBe(true);
  });
  it("never lowers the local counter", () => {
    expect(reconcilePostsCreated(30, 21)).toBe(30);
  });
});
