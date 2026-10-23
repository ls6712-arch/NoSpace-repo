import { describe, expect, it } from "vitest";
import { MOODS, cornersForMood } from "./moods";
import { CORNER_GUIDES } from "./cornerGuides";

describe("moods", () => {
  it("gives every mood at least 4 Corners, so no row is ever thin", () => {
    const thin = MOODS.filter((m) => cornersForMood(m.id).length < 4).map((m) => m.id);
    expect(thin).toEqual([]);
  });

  it("never shows adults-only activities", () => {
    const adult = Object.entries(CORNER_GUIDES).filter(([, g]) => g.adultsOnly).map(([k]) => k.split("/")[1]);
    expect(adult.length).toBeGreaterThan(0);
    for (const m of MOODS) {
      expect(cornersForMood(m.id).some((c) => adult.includes(c.cornerSlug))).toBe(false);
    }
  });

  it("has labels with no dashes and sentence case", () => {
    for (const m of MOODS) {
      expect(m.label).not.toMatch(/[—–]/);
      expect(m.label[0]).toBe(m.label[0].toUpperCase());
      expect(m.label.slice(1)).toBe(m.label.slice(1).toLowerCase());
    }
  });
});
