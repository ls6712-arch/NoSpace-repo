import { describe, expect, it } from "vitest";
import { MOODS, cornersForMood } from "./moods";
import { CORNER_GUIDES } from "./cornerGuides";
import { CURATED_CORNERS } from "./curatedCorners";
import { isBrowsableCorner } from "./hobbies";

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

  it("shows every browsable curated Corner under at least one mood (adults-only aside)", () => {
    const inAMood = new Set(MOODS.flatMap((m) => cornersForMood(m.id).map((c) => `${c.spaceSlug}/${c.cornerSlug}`)));
    const missing = CURATED_CORNERS.filter(
      (x) => isBrowsableCorner(x.spaceSlug, x.slug) && !CORNER_GUIDES[`${x.spaceSlug}/${x.slug}`]?.adultsOnly && !inAMood.has(`${x.spaceSlug}/${x.slug}`),
    ).map((x) => `${x.spaceSlug}/${x.slug}`);
    expect(missing).toEqual([]);
  });

  it("keeps Indian classical dance under Move but not open mics", () => {
    const move = cornersForMood("move").map((c) => `${c.spaceSlug}/${c.cornerSlug}`);
    expect(move).toContain("art-creative/indian-classical-dance");
    expect(move).toContain("sports-fitness/dance");
    expect(move).not.toContain("art-creative/open-mics");
    // open mics still show under the moods its guide says: people.
    const people = cornersForMood("people").map((c) => `${c.spaceSlug}/${c.cornerSlug}`);
    expect(people).toContain("art-creative/open-mics");
  });

  it("has labels with no dashes and sentence case", () => {
    for (const m of MOODS) {
      expect(m.label).not.toMatch(/[—–]/);
      expect(m.label[0]).toBe(m.label[0].toUpperCase());
      expect(m.label.slice(1)).toBe(m.label.slice(1).toLowerCase());
    }
  });
});
