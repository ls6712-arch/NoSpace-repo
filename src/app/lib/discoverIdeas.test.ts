import { describe, expect, it } from "vitest";
import { WHO_ORDER, defaultPills, loosenSpend, parsePassCorners, passTagFor } from "./discoverIdeas";
import { nyTimeToMs } from "./homeWeek";

// Thursday Oct 29, 2026, noon in New York.
const THU_NOON = nyTimeToMs(2026, 10, 29, 12);

describe("defaultPills", () => {
  it("starts at Tonight, Under $25 and A friend with nothing saved", () => {
    expect(defaultPills(null, THU_NOON)).toEqual({ time: "tonight", spend: "under25", who: "friend" });
    expect(defaultPills({ windows: [], budget: null }, THU_NOON)).toEqual({ time: "tonight", spend: "under25", who: "friend" });
  });

  it("takes Time from the next free window: an evening is Tonight, all day is Weekend", () => {
    expect(defaultPills({ windows: ["thu-eve"], budget: 50 }, THU_NOON).time).toBe("tonight");
    expect(defaultPills({ windows: ["sat-day", "sat-eve"], budget: 50 }, THU_NOON).time).toBe("weekend");
    expect(defaultPills({ windows: ["sat-day"], budget: 50 }, THU_NOON).time).toBe("tonight");
    // The next one counts, not a later one: Thursday evening comes before Saturday all day.
    expect(defaultPills({ windows: ["thu-eve", "sat-day", "sat-eve"], budget: 50 }, THU_NOON).time).toBe("tonight");
  });

  it("takes Spend from the monthly budget: 0 is Free, anything else Under $25", () => {
    expect(defaultPills({ windows: [], budget: 0 }, THU_NOON).spend).toBe("free");
    for (const budget of [50, 100, 200] as const) expect(defaultPills({ windows: [], budget }, THU_NOON).spend).toBe("under25");
  });
});

describe("pill values", () => {
  it("lists Who in the order of the dropdown", () => {
    expect(WHO_ORDER).toEqual(["solo", "friend", "new"]);
  });

  it("loosens Spend to Treat me and nothing else", () => {
    expect(loosenSpend({ time: "hour", spend: "free", who: "new" })).toEqual({ time: "hour", spend: "treat", who: "new" });
  });
});

describe("pass tags", () => {
  const map = parsePassCorners({ pass_corners: { museum: ["art-creative/drawing"], climbing: ["sports-fitness/climbing"] } });

  it("reads Home's map and tags a Corner a pass covers", () => {
    expect(passTagFor("art-creative/drawing", [{ kind: "museum" }], map)).toBe("Your museum pass");
    expect(passTagFor("sports-fitness/climbing", [{ kind: "museum" }, { kind: "climbing" }], map)).toBe("Your climbing pass");
  });

  it("tags nothing without a matching pass or a map", () => {
    expect(passTagFor("art-creative/drawing", [{ kind: "climbing" }], map)).toBeNull();
    expect(passTagFor("art-creative/drawing", [], map)).toBeNull();
    expect(passTagFor("art-creative/drawing", [{ kind: "museum" }], parsePassCorners(null))).toBeNull();
  });
});
