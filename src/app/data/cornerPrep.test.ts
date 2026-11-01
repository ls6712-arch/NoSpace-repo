import { describe, expect, it } from "vitest";
import { CORNER_GUIDES } from "./cornerGuides";
import { CURATED_CORNERS } from "./curatedCorners";
import { CORNER_PREP } from "./cornerPrep";
import { startContent } from "../lib/startContent";

const curated = new Set(CURATED_CORNERS.map((c) => `${c.spaceSlug}/${c.slug}`));
const missing = Object.keys(CORNER_GUIDES).filter((k) => !curated.has(k));

describe("Corner prep (what you'll need and steps for the Start page)", () => {
  it("covers every guided Corner that curatedCorners.ts does not", () => {
    expect(missing.filter((k) => !CORNER_PREP[k])).toEqual([]);
  });

  it("only has entries for guided Corners that are not curated", () => {
    for (const k of Object.keys(CORNER_PREP)) {
      expect(CORNER_GUIDES[k], `${k} has a guide`).toBeDefined();
      expect(curated.has(k), `${k} is already curated`).toBe(false);
    }
  });

  it("gives 3 to 5 needs and 2 to 3 steps, with no repeats of the guide step", () => {
    for (const [k, v] of Object.entries(CORNER_PREP)) {
      expect(v.needs.length, `${k} needs`).toBeGreaterThanOrEqual(3);
      expect(v.needs.length, `${k} needs`).toBeLessThanOrEqual(5);
      expect(v.steps.length, `${k} steps`).toBeGreaterThanOrEqual(2);
      expect(v.steps.length, `${k} steps`).toBeLessThanOrEqual(3);
      expect(v.steps, k).not.toContain(CORNER_GUIDES[k].step);
      expect(new Set(v.steps).size, `${k} repeats a step`).toBe(v.steps.length);
    }
  });

  it("keeps to the trust rules: no prices or cost words, no dashes, no result or feeling claims", () => {
    const text = Object.entries(CORNER_PREP).flatMap(([k, v]) => [...v.needs, ...v.steps].map((t) => [k, t] as const));
    for (const [k, t] of text) {
      expect(t, `${k}: ${t}`).not.toMatch(/[–—]/);
      expect(t, `${k}: ${t}`).not.toMatch(/[$€£]|\b(cheap|free|cost|costs|price|priced|pay|paid|afford|budget|dollars?|cash|money|deal|discount)\b/i);
      expect(t, `${k}: ${t}`).not.toMatch(/\b(relax\w*|calm\w*|stress\w*|health\w*|happy|happier|better|improve\w*|guarantee\w*|will make you|burn calories|lose weight|journal\w*|habit\w*|streak\w*)\b/i);
    }
  });

  it("reaches the Start page for every guided Corner", () => {
    for (const k of Object.keys(CORNER_GUIDES)) {
      const [space, corner] = k.split("/");
      const c = startContent(space, corner);
      if (!c) continue; // a guide for a Corner hobbies.ts no longer has
      expect(c.needs.length, `${k} needs`).toBeGreaterThanOrEqual(3);
      expect(c.steps.length, `${k} steps`).toBeGreaterThanOrEqual(3);
    }
  });
});
