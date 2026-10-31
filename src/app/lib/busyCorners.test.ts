import { describe, expect, it } from "vitest";
import { topBusyCorners } from "./busyCorners";

describe("topBusyCorners", () => {
  it("puts the Corners with the most events first and leaves out those with none", () => {
    const out = topBusyCorners([
      { corner_key: "food-cooking/pasta", events: 4 },
      { corner_key: "crafts-making/embroidery", events: 0 },
      { corner_key: "crafts-making/pottery", events: 7 },
    ]);
    expect(out).toEqual([
      { key: "crafts-making/pottery", events: 7 },
      { key: "food-cooking/pasta", events: 4 },
    ]);
  });

  it("keeps at most six, ties in a stable order, and ignores rows that are not a Corner", () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({ corner_key: `a/c${i}`, events: 2 }));
    const out = topBusyCorners([...rows, { corner_key: "nonsense", events: 50 }, { corner_key: null, events: 9 }]);
    expect(out).toHaveLength(6);
    expect(out.map((o) => o.key)).toEqual(["a/c0", "a/c1", "a/c2", "a/c3", "a/c4", "a/c5"]);
  });

  it("is empty when nothing is on, so the page leaves the section out", () => {
    expect(topBusyCorners([])).toEqual([]);
    expect(topBusyCorners([{ corner_key: "a/b", events: 0 }])).toEqual([]);
  });
});
