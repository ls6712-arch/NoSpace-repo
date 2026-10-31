import { describe, expect, it } from "vitest";
import { spaceActivityLine } from "./SpacesRow";
import type { DiscoverSpace } from "../../lib/discover";

const START = Date.parse("2026-11-05T23:00:00Z");
const space = (over: Partial<DiscoverSpace> = {}): DiscoverSpace => ({
  id: "s1", slug: "clay", name: "Clay", cornerKey: "crafts-making/pottery", neighborhood: "Gowanus", access: "open", momentsThisMonth: 48,
  nextEvent: { title: "Open night", startsAt: START }, ...over,
});

describe("spaceActivityLine", () => {
  it("shows the next event when Home does not already rank it", () => {
    expect(spaceActivityLine(space(), new Set())).toMatch(/^Open night · /);
  });

  it("never shows a dated event Home ranks in its top four, and shows the Moments instead", () => {
    expect(spaceActivityLine(space(), new Set([`clay|Open night|${START}`]))).toBe("48 Moments this month");
  });

  it("says 1 Moment this month in the singular and says nothing for none", () => {
    expect(spaceActivityLine(space({ nextEvent: null, momentsThisMonth: 1 }), new Set())).toBe("1 Moment this month");
    expect(spaceActivityLine(space({ nextEvent: null, momentsThisMonth: 0 }), new Set())).toBe("");
  });

  it("never mentions members", () => {
    expect(spaceActivityLine(space({ nextEvent: null }), new Set())).not.toMatch(/member/i);
  });
});
