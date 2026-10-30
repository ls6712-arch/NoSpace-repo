import { describe, expect, it } from "vitest";
import { CORNER_GUIDES } from "./cornerGuides";
import { CORNER_IDEAS, DUPLICATE_GUIDES, cornerIdea } from "./cornerIdeas";

const TIMES = ["hour", "tonight", "weekend"];
const SPENDS = ["free", "under25", "treat"];
const WHOS = ["solo", "friend", "new"];

describe("corner ideas", () => {
  it("covers every guide except the six duplicates, and only guides", () => {
    const expected = Object.keys(CORNER_GUIDES).filter((k) => !(k in DUPLICATE_GUIDES));
    expect(Object.keys(CORNER_IDEAS).sort()).toEqual(expected.sort());
    for (const [dropped, kept] of Object.entries(DUPLICATE_GUIDES)) {
      expect(CORNER_GUIDES[dropped], dropped).toBeDefined();
      expect(CORNER_IDEAS[kept], kept).toBeDefined();
      expect(CORNER_IDEAS[dropped], dropped).toBeUndefined();
    }
  });

  it("keeps one of each duplicate the founder named", () => {
    const keys = Object.keys(CORNER_IDEAS);
    expect(keys.filter((k) => /\/(coffee|home-coffee|espresso)$/.test(k))).toHaveLength(1);
    expect(keys.filter((k) => /\/(electronics|arduino)$/.test(k))).toHaveLength(1);
    expect(keys.filter((k) => /\/(books|reading)$/.test(k))).toHaveLength(1);
    expect(keys.filter((k) => /\/(writing|creative-writing)$/.test(k))).toHaveLength(1);
    expect(keys.filter((k) => /\/trading-cards$/.test(k))).toHaveLength(1);
  });

  it("uses only known values", () => {
    for (const [key, idea] of Object.entries(CORNER_IDEAS)) {
      expect(TIMES, key).toContain(idea.time);
      expect(SPENDS, key).toContain(idea.spend);
      expect(idea.who.length, key).toBeGreaterThan(0);
      expect(idea.who.every((w) => WHOS.includes(w)), key).toBe(true);
    }
  });

  it("writes titles as short verb phrases and how lines as time plus where, ending in a full stop", () => {
    for (const [key, idea] of Object.entries(CORNER_IDEAS)) {
      expect(idea.ideaTitle.trim(), key).not.toBe("");
      expect(idea.ideaTitle, key).not.toMatch(/[.!?]$/);
      expect(idea.ideaTitle.split(/\s+/).length, key).toBeLessThanOrEqual(9);
      expect(idea.how, key).toMatch(/\.$/);
      expect(idea.how, key).toMatch(/^(\d+ (minutes?|hours?)|An? (full day|few evenings))/i);
    }
  });

  it("puts no price in an idea and uses US spelling", () => {
    const british = /\b(colour|neighbour|favourite|centre|practise|organis|analys|licence|travell|cosy|grey|jewellery|plough|catalogue|programme)/i;
    for (const [key, idea] of Object.entries(CORNER_IDEAS)) {
      const text = `${idea.ideaTitle} ${idea.how}`;
      expect(text, key).not.toMatch(/[$£€]|\bdollars?\b|\bfree\b/i);
      expect(text, key).not.toMatch(british);
      expect(text, key).not.toMatch(/[–—]/);
    }
  });

  it("applies the founder's value fixes", () => {
    for (const k of ["health-wellness/breathwork", "travel-adventure/exploration", "travel-adventure/backpacking", "travel-adventure/skiing"]) {
      expect(CORNER_IDEAS[k].spend, k).toBe("free");
      expect(["hour", "tonight"], k).toContain(CORNER_IDEAS[k].time);
    }
    for (const k of ["crafts-making/pottery", "sports-fitness/climbing", "nature-outdoors/surfing", "sports-fitness/padel"]) {
      expect(CORNER_IDEAS[k].spend, k).toBe("treat");
    }
    expect(CORNER_IDEAS["nature-outdoors/surfing"].time).toBe("weekend");
  });

  it("looks an idea up by Space and Corner", () => {
    expect(cornerIdea("food-cooking", "sourdough")?.ideaTitle).toBe("Start a sourdough starter");
    expect(cornerIdea("food-cooking", "not-a-corner")).toBeUndefined();
  });
});
