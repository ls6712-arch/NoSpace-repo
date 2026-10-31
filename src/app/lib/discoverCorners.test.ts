import { describe, expect, it } from "vitest";
import { BE_THE_FIRST, PEOPLE_FALLBACK, PLACE_FALLBACK, cornerCandidates, cornerCardModel, visitorCorners } from "./discoverCorners";
import { CORNER_IDEAS } from "../data/cornerIdeas";

describe("cornerCandidates", () => {
  it("offers Corners with an idea, never a 21 and over one or a duplicate", () => {
    const keys = cornerCandidates();
    expect(keys.length).toBeGreaterThan(100);
    expect(keys).not.toContain("food-cooking/home-brewing");
    expect(keys).not.toContain("food-cooking/espresso");
    for (const k of keys) expect(CORNER_IDEAS[k], k).toBeDefined();
  });
});

describe("cornerCardModel", () => {
  it("has three tabs in order, each opening the Corner page on its section", () => {
    const m = cornerCardModel({ cornerKey: "crafts-making/pottery", hasHome: true, hasGroup: true, hasPlace: true });
    expect(m.name).toBe("Pottery");
    expect(m.tabs.map((t) => t.label)).toEqual(["At home", "With people", "At a place"]);
    expect(m.tabs.map((t) => t.to)).toEqual([
      "/corners/pottery?section=home",
      "/corners/pottery?section=people",
      "/corners/pottery?section=place",
    ]);
    expect(m.tabs.every((t) => t.supplied)).toBe(true);
    expect(m.hook.length).toBeGreaterThan(0);
    expect(m.tabs[0].line).toBe("Take a beginner wheel class");
  });

  it("names the soonest open Pursuit and the nearest Space on the tabs, with fallbacks when there is no name", () => {
    const c = { cornerKey: "crafts-making/pottery", hasHome: true, hasGroup: true, hasPlace: true };
    const named = cornerCardModel(c, { people: "Wheel night with Priya", place: "Kiln House" });
    expect(named.tabs[1].line).toBe("Wheel night with Priya");
    expect(named.tabs[2].line).toBe("Kiln House");
    const plain = cornerCardModel(c);
    expect(plain.tabs[1].line).toBe(PEOPLE_FALLBACK);
    expect(plain.tabs[2].line).toBe(PLACE_FALLBACK);
    expect(PEOPLE_FALLBACK).toBe("Find people to go with");
    expect(PLACE_FALLBACK).toBe("Find a place near you");
  });

  it("says Be the first where nothing is there and opens Create a Pursuit or Create a Space", () => {
    const m = cornerCardModel({ cornerKey: "crafts-making/pottery", hasHome: true, hasGroup: false, hasPlace: false });
    // Names only ever go on a tab that has something behind it.
    const withNames = cornerCardModel({ cornerKey: "crafts-making/pottery", hasHome: true, hasGroup: false, hasPlace: false }, { people: "X", place: "Y" });
    expect(withNames.tabs[1].line).toBe(BE_THE_FIRST);
    expect(withNames.tabs[2].line).toBe(BE_THE_FIRST);
    expect(m.tabs[1]).toMatchObject({ line: BE_THE_FIRST, supplied: false, to: "/pursuits/new?hobby=crafts-making&sub=pottery&together=1" });
    expect(m.tabs[2]).toMatchObject({ line: BE_THE_FIRST, supplied: false, to: "/create-space" });
    expect(m.tabs[0].supplied).toBe(true);
  });
});

describe("visitorCorners", () => {
  it("takes one Corner from each category before a second from any", () => {
    const keys = ["a/one", "a/two", "b/one", "c/one", "b/two"];
    expect(visitorCorners(3, keys)).toEqual(["a/one", "b/one", "c/one"]);
    expect(visitorCorners(5, keys)).toEqual(["a/one", "b/one", "c/one", "a/two", "b/two"]);
    expect(visitorCorners(9, keys)).toHaveLength(5);
  });

  it("gives six from six different categories for the real list", () => {
    const six = visitorCorners(6);
    expect(new Set(six.map((k) => k.split("/")[0])).size).toBe(6);
  });
});
