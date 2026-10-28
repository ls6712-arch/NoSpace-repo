import { describe, expect, it } from "vitest";
import { STORY, recapLayout } from "./recapImage";

describe("recapLayout", () => {
  it("lays 10 tiles in 5 columns and 2 rows inside the story frame", () => {
    const l = recapLayout(10);
    expect(l.tiles).toHaveLength(10);
    expect(new Set(l.tiles.map((t) => t.y)).size).toBe(2);
    for (const t of l.tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.w).toBeLessThanOrEqual(STORY.width);
    }
    expect(l.stub.y + l.stub.h).toBeLessThanOrEqual(STORY.height);
  });

  it("never draws more than 10 tiles and keeps the stub below them", () => {
    const l = recapLayout(25);
    expect(l.tiles).toHaveLength(10);
    const bottom = Math.max(...l.tiles.map((t) => t.y + t.h));
    expect(l.stub.y).toBeGreaterThan(bottom);
  });

  it("copes with no photos", () => {
    const l = recapLayout(0);
    expect(l.tiles).toHaveLength(0);
    expect(l.stub.h).toBeGreaterThan(0);
  });
});
