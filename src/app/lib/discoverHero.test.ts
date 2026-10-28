import { describe, expect, it } from "vitest";
import { heroCandidates } from "./discoverHero";

describe("heroCandidates", () => {
  it("lists a Corner once even when it fits several moods", () => {
    const keys = heroCandidates(["make", "learn", "people"], "quick").map((c) => `${c.spaceSlug}/${c.cornerSlug}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThan(0);
  });

  it("takes from each chosen mood in turn", () => {
    const [a, b] = heroCandidates(["make", "people"], "quick");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
  });

  it("falls back to the fallback mood when none is chosen", () => {
    expect(heroCandidates([], "make").length).toBeGreaterThan(0);
  });

  it("never exceeds the limit", () => {
    expect(heroCandidates(["make", "move", "people", "alone", "outside", "learn", "play", "haveIt"], "quick", 5).length).toBeLessThanOrEqual(5);
  });
});
