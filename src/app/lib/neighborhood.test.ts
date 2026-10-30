import { describe, expect, it } from "vitest";
import { matchNeighborhood, nearestNeighborhood, placeFromTyped, suggestNeighborhoods } from "./neighborhood";

describe("neighborhood", () => {
  it("suggests by the start of a name or of a word in it", () => {
    expect(suggestNeighborhoods("will").map((n) => n.name)).toEqual(["Williamsburg"]);
    expect(suggestNeighborhoods("heights").map((n) => n.name)).toContain("Washington Heights");
    expect(suggestNeighborhoods("")).toEqual([]);
  });

  it("does not suggest what is already typed in full", () => {
    expect(suggestNeighborhoods("Williamsburg")).toEqual([]);
  });

  it("matches a full name in any case, with or without the apostrophe", () => {
    expect(matchNeighborhood("hells kitchen")?.name).toBe("Hell’s Kitchen");
    expect(matchNeighborhood("  DUMBO ")?.name).toBe("DUMBO");
    expect(matchNeighborhood("Brooklyn")).toBeNull();
  });

  it("turns a neighborhood into New York plus an area, and anything else into a city", () => {
    expect(placeFromTyped("williamsburg")).toEqual({ city: "New York", area: "Williamsburg" });
    expect(placeFromTyped("  Austin  ")).toEqual({ city: "Austin", area: null });
    expect(placeFromTyped("   ")).toBeNull();
  });

  it("finds the nearest neighborhood only inside New York", () => {
    expect(nearestNeighborhood({ lat: 40.7075, lng: -73.9575 })?.name).toBe("Williamsburg");
    expect(nearestNeighborhood({ lat: 30.2672, lng: -97.7431 })).toBeNull();
  });
});
