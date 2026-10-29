import { describe, expect, it } from "vitest";
import { CORNER_CATEGORIES } from "./cornerCategories";
import { homeCornersIn } from "./homeCorners";
import { CORNER_GUIDES } from "./cornerGuides";
import { curatedFor } from "./curatedCorners";
import { hasHobbyPhoto, photoCredit } from "./hobbyPhotos";
import { LEGACY_THIN, LEGACY_THIN_CEILING, type ThinPart } from "./legacyThin";

// The 12 Corners added with the rule. They ship complete and can never be
// listed in LEGACY_THIN.
const NEW_COMPLETE = [
  "cricket", "carrom", "table-tennis", "escape-rooms", "open-mics",
  "indian-classical-dance", "indian-classical-music", "piano", "sound-baths",
  "stargazing", "resin-art", "block-printing",
];

const all = [...new Map(
  CORNER_CATEGORIES.flatMap((c) => homeCornersIn(c.slug)).map((c) => [c.slug, c]),
).values()];

function missing(c: { spaceSlug: string; slug: string }): ThinPart[] {
  const out: ThinPart[] = [];
  if (!curatedFor(c.spaceSlug, c.slug)) out.push("curated");
  if (!photoCredit(c.slug)) out.push("credit");
  return out;
}

describe("no Corner ships thin", () => {
  it("every browsable Corner has a guide and a photo, with no exceptions", () => {
    for (const c of all) {
      expect(`${c.spaceSlug}/${c.slug}` in CORNER_GUIDES, `${c.slug} guide`).toBe(true);
      expect(hasHobbyPhoto(c.slug), `${c.slug} photo`).toBe(true);
    }
  });

  it("every browsable Corner has a curated entry and a photo credit unless it is listed in LEGACY_THIN", () => {
    for (const c of all) {
      const allowed = LEGACY_THIN[c.slug] ?? [];
      const gaps = missing(c).filter((p) => !allowed.includes(p));
      expect(gaps, `${c.slug} is missing ${gaps.join(" and ")}`).toEqual([]);
    }
  });

  it("every LEGACY_THIN entry is a browsable Corner and is still missing what it lists", () => {
    const bySlug = new Map(all.map((c) => [c.slug, c]));
    for (const [slug, parts] of Object.entries(LEGACY_THIN)) {
      const c = bySlug.get(slug);
      expect(c, `${slug} is not a browsable Corner`).toBeDefined();
      expect(parts.length, `${slug} lists no parts`).toBeGreaterThan(0);
      expect(new Set(parts).size, `${slug} repeats a part`).toBe(parts.length);
      for (const p of parts) {
        expect(missing(c!), `${slug} no longer lacks ${p}: remove it from LEGACY_THIN`).toContain(p);
      }
    }
  });

  it("LEGACY_THIN can only shrink", () => {
    const total = Object.values(LEGACY_THIN).reduce((n, p) => n + p.length, 0);
    expect(total).toBeLessThanOrEqual(LEGACY_THIN_CEILING);
    expect(LEGACY_THIN_CEILING).toBeLessThanOrEqual(151);
  });

  it("no new Corner is ever listed in LEGACY_THIN", () => {
    for (const slug of NEW_COMPLETE) expect(slug in LEGACY_THIN, slug).toBe(false);
  });
});
