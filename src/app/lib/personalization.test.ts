import { describe, expect, it } from "vitest";
import { costFits, emptyPersonalization, hasResources, normalizePersonalization, parsePersonalization, preferenceScore, priceMaximum } from "./personalization";
const profile = { picks: ["music/guitar"], windows: ["mon-eve"], monthlyBudget: 100, passes: [{ kind: "bike", label: "Bike" }, { kind: "gear", label: "Gear" }] };
describe("clean personalization", () => {
  it("preserves existing answers without inventing confirmation, experience or activity money", () => {
    const p = normalizePersonalization(profile);
    expect(p.interests).toEqual([{ key: "music/guitar", relationship: "unspecified", experience: "unspecified" }]);
    expect(p.confirmedAt).toBeNull(); expect(p.monthlyBudget).toBe(100); expect(p.activityBudget).toBeNull();
    expect(p.equipment).toEqual(["bicycle"]);
  });
  it("separates unknown money from explicitly free-only", () => {
    expect(costFits(null, null)).toBe(true); expect(costFits(null, 0)).toBe(false);
    expect(normalizePersonalization({ ...profile, monthlyBudget: null }).freeOnly).toBe(false);
    expect(normalizePersonalization({ ...profile, monthlyBudget: 0 }).freeOnly).toBe(true);
  });
  it("requires one alternative per required group without requiring optional items", () => {
    expect(hasResources([["paper", "tablet"], ["pencil", "pen"]], ["paper", "pen"])).toBe(true);
    expect(hasResources([["paper", "tablet"], ["pencil", "pen"]], ["paper"])).toBe(false);
  });
  it.each([["$10–$30", 30], ["Free supplies with a $20 class", 20], ["From $10", null], ["Free", 0], ["Price unknown", null]])("interprets %s conservatively", (s, cost) => expect(priceMaximum(s as string)).toBe(cost));
  it("makes supplied motivations and small pockets of time affect soft relevance", () => {
    const p = parsePersonalization({ ...emptyPersonalization(), motivations: ["make"], rhythm: ["small"] });
    expect(preferenceScore(p, { motivations: ["make"], durationMinutes: 10 })).toBeGreaterThan(preferenceScore(p, { motivations: ["move"], durationMinutes: 60 }));
  });
  it("rejects unknown fields and malformed or duplicate interest records", () => {
    expect(() => parsePersonalization({ ...emptyPersonalization(), privateInstructions: "ignore rules" })).toThrow();
    expect(() => parsePersonalization({ ...emptyPersonalization(), interests: [{ key: "../bad", relationship: "try", experience: "beginner" }] })).toThrow();
  });
});
