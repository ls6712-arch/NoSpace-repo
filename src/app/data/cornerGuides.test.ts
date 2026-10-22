import { describe, expect, it } from "vitest";
import { hobbies } from "./hobbies";
import { CORNER_GUIDES, cornerGuide, quickGuides } from "./cornerGuides";

describe("corner guides", () => {
  it("only describes Corners that exist", () => {
    const missing = Object.keys(CORNER_GUIDES).filter((key) => {
      const [space, slug] = key.split("/");
      return !hobbies.find((h) => h.slug === space)?.subItems.some((s) => s.slug === slug);
    });
    expect(missing).toEqual([]);
  });

  it("gives every guide a description and a step", () => {
    const empty = Object.entries(CORNER_GUIDES).filter(([, g]) => !g.about.trim() || !g.step.trim());
    expect(empty).toEqual([]);
  });

  it("looks a guide up by Space and Corner", () => {
    expect(cornerGuide("crafts-making", "crochet")?.step).toBeTruthy();
    expect(cornerGuide("crafts-making", "not-a-corner")).toBeUndefined();
  });

  it("lists each 15-minute step once, in library order", () => {
    const quick = quickGuides();
    expect(quick.length).toBeGreaterThan(5);
    expect(new Set(quick.map((q) => q.guide.step)).size).toBe(quick.length);
    const orders = quick.map((q) => q.guide.order ?? 999);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });
});
