import { describe, expect, it } from "vitest";
import { CORNER_CATEGORIES } from "../data/cornerCategories";
import { homeCornersIn } from "../data/homeCorners";
import { NO_PICK, hasPick, matches, paramsFromPicker, pickerFromParams } from "./cornerFilters";

const all = CORNER_CATEGORIES.flatMap((c) => homeCornersIn(c.slug));
const find = (name: string) => all.find((c) => c.name === name)!;

describe("filters in the URL", () => {
  it("round trip", () => {
    const p = { duration: 60, mood: "make" as const, setting: "home" as const };
    expect(paramsFromPicker(p).toString()).toBe("time=60&mood=make&place=home");
    expect(pickerFromParams(new URLSearchParams("time=60&mood=make&place=home"))).toEqual(p);
    expect(pickerFromParams(new URLSearchParams("place=outdoors"))).toEqual({ ...NO_PICK, setting: "outdoors" });
  });

  it("is null with no filters, and ignores what it cannot read", () => {
    expect(pickerFromParams(new URLSearchParams(""))).toBeNull();
    expect(pickerFromParams(new URLSearchParams("time=7&mood=nope&place=moon"))).toBeNull();
    expect(pickerFromParams(new URLSearchParams("time=120&mood=nope"))).toEqual({ ...NO_PICK, duration: 120 });
    expect(hasPick(NO_PICK)).toBe(false);
  });
});

describe("matches", () => {
  const home = { ...NO_PICK, setting: "home" as const };
  const out = { ...NO_PICK, setting: "outdoors" as const };

  it("treats place exactly: an anywhere Corner is in neither", () => {
    const anywhere = all.filter((c) => c.curated?.setting === "anywhere");
    expect(anywhere.length).toBeGreaterThan(0);
    for (const c of anywhere) {
      expect(matches(c, home), c.name).toBe(false);
      expect(matches(c, out), c.name).toBe(false);
    }
    expect(matches(find("Pottery"), out)).toBe(false);
    expect(matches(find("Improv"), out)).toBe(false);
    expect(matches(find("Skating"), home)).toBe(false);
  });

  it("keeps a home Corner for At home and an outdoors Corner for Outdoors", () => {
    expect(matches(find("Woodworking"), home)).toBe(true);
    expect(matches(find("Woodworking"), out)).toBe(false);
    expect(matches(find("Running"), out)).toBe(true);
    expect(matches(find("Running"), home)).toBe(false);
  });

  it("filters by time and mood", () => {
    expect(matches(find("Running"), { ...NO_PICK, duration: 60 })).toBe(true);
    expect(matches(find("Hiking"), { ...NO_PICK, duration: 60 })).toBe(false);
    expect(matches(find("Pottery"), { ...NO_PICK, mood: "make" })).toBe(true);
    expect(matches(find("Running"), { ...NO_PICK, mood: "make" })).toBe(false);
  });
});

describe("category rows", () => {
  it("hold only their own Corners", () => {
    for (const cat of CORNER_CATEGORIES) {
      for (const c of homeCornersIn(cat.slug)) {
        expect(all.filter((x) => x.slug === c.slug), c.slug).toHaveLength(1);
      }
    }
  });
});
