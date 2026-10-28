import { beforeEach, describe, expect, it, vi } from "vitest";
import { CITY_MAX, cleanCity, cleanMoods, readLocalInterests, suggestCities } from "./interests";

describe("interests", () => {
  // The test runs in node: give the code under test a small localStorage.
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
  });

  it("keeps known moods once each, in the order the moods are listed", () => {
    expect(cleanMoods(["people", "make", "make", "nonsense", 4])).toEqual(["make", "people"]);
    expect(cleanMoods("make")).toEqual([]);
    expect(cleanMoods(null)).toEqual([]);
  });

  it("trims and collapses a city, and caps it at the column limit", () => {
    expect(cleanCity("  New   York ")).toBe("New York");
    expect(cleanCity("x".repeat(CITY_MAX + 20))).toHaveLength(CITY_MAX);
  });

  it("suggests cities that start with what was typed, never the exact match", () => {
    expect(suggestCities("ban")).toEqual(["Bangalore"]);
    expect(suggestCities("Bangalore")).toEqual([]);
    expect(suggestCities("").length).toBeGreaterThan(0);
  });

  it("reads back only what is valid from this device", () => {
    expect(readLocalInterests()).toBeNull();
    window.localStorage.setItem("soosh.interests.v1", JSON.stringify({ city: " Pune ", moods: ["move", "bogus"] }));
    expect(readLocalInterests()).toEqual({ city: "Pune", moods: ["move"] });
    window.localStorage.setItem("soosh.interests.v1", "{not json");
    expect(readLocalInterests()).toBeNull();
  });
});
