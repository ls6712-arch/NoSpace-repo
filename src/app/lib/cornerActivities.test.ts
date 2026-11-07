import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CORNER_ACTIVITIES } from "../data/cornerActivities";
import { ACTIVITY_TABS, activitiesFor, activityById, activityFromParams, tryThisPath, durationLabel, hasActivities, inTab } from "./cornerActivities";

const origami1 = activityById("origami-1")!;

describe("activities by Corner", () => {
  it("finds the six for a Corner by its slug, and nothing for a Corner without", () => {
    expect(activitiesFor("origami")).toHaveLength(6);
    expect(activitiesFor("pottery")).toEqual([]);
    expect(hasActivities("origami")).toBe(true);
    expect(hasActivities("pottery")).toBe(false);
  });
  it("finds one by id", () => {
    expect(origami1.title).toBe("Fold a paper crane");
    expect(activityById("nope-1")).toBeUndefined();
    expect(activityById(null)).toBeUndefined();
  });
});

describe("the three tabs", () => {
  it("put an activity under every tab it fits", () => {
    const home = CORNER_ACTIVITIES.filter((a) => inTab(a, "home"));
    const people = CORNER_ACTIVITIES.filter((a) => inTab(a, "people"));
    const place = CORNER_ACTIVITIES.filter((a) => inTab(a, "place"));
    expect(home.every((a) => a.where === "home")).toBe(true);
    expect(people.every((a) => a.who.includes("friend") || a.who.includes("group"))).toBe(true);
    expect(place.every((a) => a.where === "outside" || a.where === "place")).toBe(true);
    // Every activity is under at least one tab (a Corner never loses one), and some are under two.
    for (const a of CORNER_ACTIVITIES) expect(ACTIVITY_TABS.some((t) => inTab(a, t)), a.id).toBe(true);
    expect(CORNER_ACTIVITIES.some((a) => ACTIVITY_TABS.filter((t) => inTab(a, t)).length > 1)).toBe(true);
  });
});

describe("duration labels", () => {
  it("use the Corner meta line's words, from config", () => {
    const by = (d: string) => durationLabel(CORNER_ACTIVITIES.find((a) => a.duration === d)!);
    expect([by("15min"), by("hour"), by("evening"), by("halfday")]).toEqual(["15 min", "1 hr", "3 hr", "4 hr"]);
  });
});

describe('"Try this"', () => {
  it("opens the composer on the Corner, with the activity", () => {
    const path = tryThisPath(origami1);
    expect(path.startsWith("/create?")).toBe(true);
    const params = new URLSearchParams(path.split("?")[1]);
    expect(params.get("hobby")).toBe(origami1.spaceSlug);
    expect(params.get("sub")).toBe("origami");
    expect(params.get("activity")).toBe("origami-1");
  });
  it("gives the composer back the activity, with its prompt, only for the Corner it belongs to", () => {
    const params = new URLSearchParams(tryThisPath(origami1).split("?")[1]);
    expect(activityFromParams(params, "origami")?.momentPrompt).toBe("Your first crane, wonky neck and all.");
    expect(activityFromParams(params, "pottery")).toBeUndefined();
    expect(activityFromParams(new URLSearchParams("activity=forged-9"), "origami")).toBeUndefined();
    expect(activityFromParams(new URLSearchParams(""), "origami")).toBeUndefined();
  });
  it("is wired through the composer and the save, and no Stub rule is touched", () => {
    const log = readFileSync("src/app/pages/Log.tsx", "utf8");
    const content = readFileSync("src/app/context/ContentContext.tsx", "utf8");
    expect(log).toContain("activityFromParams(searchParams, corner)");
    expect(log).toContain("activityId: activity?.id");
    expect(log).toContain("activity.momentPrompt");
    expect(content).toContain("activity_id: input.activityId");
    expect(content).toMatch(/\/activity_id\/\.test\(error\.message/);
  });
});
