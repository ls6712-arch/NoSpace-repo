import { describe, expect, it } from "vitest";
import { LENSES, interleaveRows } from "./cornerLenses";
import { billboardCorners } from "./billboard";
import { CURATED_CORNERS } from "../data/curatedCorners";
import { cornerKey } from "../data/homeCorners";
import type { CornerLive } from "./cornersLive";

describe("LENSES", () => {
  it("has unique ids and titles", () => {
    expect(new Set(LENSES.map((l) => l.id)).size).toBe(LENSES.length);
    expect(new Set(LENSES.map((l) => l.title)).size).toBe(LENSES.length);
  });
  it("uses only wording already in the glossary", async () => {
    const fs = await import("node:fs");
    const glossary = fs.readFileSync("docs/glossary.md", "utf8");
    for (const l of LENSES) expect(glossary, l.title).toContain(l.title);
  });
});

describe("interleaveRows", () => {
  it("leads with a lens, then one after every two groups, leftovers last", () => {
    expect(interleaveRows(["a", "b", "c"], [1, 2, 3, 4, 5], 2)).toEqual(["a", 1, 2, "b", 3, 4, "c", 5]);
    expect(interleaveRows(["a", "b", "c", "d"], [1, 2], 2)).toEqual(["a", 1, 2, "b", "c", "d"]);
  });
  it("handles no lenses and no groups", () => {
    expect(interleaveRows([], [1, 2], 2)).toEqual([1, 2]);
    expect(interleaveRows(["a"], [], 2)).toEqual(["a"]);
  });
});

describe("billboardCorners", () => {
  const now = Date.UTC(2026, 9, 27, 12);
  const soon = (id: number) => ({ id, spaceId: "s", title: "t", startsAt: new Date(now + 3_600_000).toISOString(), endsAt: null, timezone: "UTC", meets: null, neighborhood: null, city: null, teaser: false });
  it("puts Corners with events this week first, then fills to five with no repeats", () => {
    const hot = CURATED_CORNERS[3];
    const live = new Map<string, CornerLive>([[cornerKey(hot), { spaces: [], events: [soon(1), soon(2)] }]]);
    const out = billboardCorners(live, now);
    expect(out[0]).toBe(hot);
    expect(out).toHaveLength(5);
    expect(new Set(out).size).toBe(5);
  });
  it("is five curated Corners with nothing live, and changes with the week", () => {
    const a = billboardCorners(new Map(), now);
    const b = billboardCorners(new Map(), now + 7 * 24 * 3_600_000);
    expect(a).toHaveLength(5);
    expect(a.map((x) => x.slug)).not.toEqual(b.map((x) => x.slug));
  });
});
