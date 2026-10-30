import { describe, expect, it } from "vitest";
import { CORNER_GUIDES } from "./cornerGuides";
import { CORNER_IDEAS, cornerIdea } from "./cornerIdeas";

const TIMES = ["hour", "tonight", "weekend"];
const SPENDS = ["free", "under25", "treat"];
const WHOS = ["solo", "friend", "new"];

describe("corner ideas", () => {
  it("only covers Corners that have a guide, and every guide has one", () => {
    expect(Object.keys(CORNER_IDEAS).sort()).toEqual(Object.keys(CORNER_GUIDES).sort());
  });

  it("uses only known values and never leaves a field empty", () => {
    for (const [key, idea] of Object.entries(CORNER_IDEAS)) {
      expect(idea.time.length, key).toBeGreaterThan(0);
      expect(idea.spend.length, key).toBeGreaterThan(0);
      expect(idea.who.length, key).toBeGreaterThan(0);
      expect(idea.time.every((t) => TIMES.includes(t)), key).toBe(true);
      expect(idea.spend.every((s) => SPENDS.includes(s)), key).toBe(true);
      expect(idea.who.every((w) => WHOS.includes(w)), key).toBe(true);
      expect(idea.ideaTitle.trim(), key).not.toBe("");
      expect(idea.how.trim(), key).not.toBe("");
    }
  });

  it("puts no price on an idea", () => {
    for (const [key, idea] of Object.entries(CORNER_IDEAS)) {
      expect(`${idea.ideaTitle} ${idea.how}`, key).not.toMatch(/\$\s?\d/);
    }
  });

  it("looks an idea up by Space and Corner", () => {
    expect(cornerIdea("food-cooking", "cooking")?.ideaTitle).toBeTruthy();
    expect(cornerIdea("food-cooking", "not-a-corner")).toBeUndefined();
  });
});
