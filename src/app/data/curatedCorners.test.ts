import { describe, expect, it } from "vitest";
import { hobbies } from "./hobbies";
import { CORNER_CATEGORIES } from "./cornerCategories";
import { MOODS } from "./moods";
import {
  CURATED_CORNERS,
  cornerMoods,
  curatedBySlug,
  curatedCategory,
  curatedFor,
  curatedInCategory,
  howToStart,
  photoSearchLinks,
} from "./curatedCorners";

/** The solo and wellness Corners the brief leaves out of the curated list. */
const EXCLUDED = [
  "meditation", "breathwork", "journaling", "nap-ritual", "stretching-routine", "sudoku-crosswords",
  "self-care-spa-night", "walking-meditation", "smoothie-lab", "memorise-a-poem", "online-course",
  "puzzle-jigsaw", "digital-detox-day", "mindfulness", "nature-journaling", "puzzles",
];

describe("curated Corners", () => {
  it("each match a built-in Corner in hobbies.ts by Space, slug and name", () => {
    for (const x of CURATED_CORNERS) {
      const sub = hobbies.find((h) => h.slug === x.spaceSlug)?.subItems.find((s) => s.slug === x.slug);
      expect(sub, `${x.spaceSlug}/${x.slug} is in hobbies.ts`).toBeDefined();
      expect(x.name, `${x.slug} name drifted from hobbies.ts`).toBe(sub?.label);
    }
  });

  it("have globally unique URL slugs, and no wellness Corner", () => {
    const slugs = CURATED_CORNERS.map((x) => x.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of EXCLUDED) expect(slugs, s).not.toContain(s);
  });

  it("file each Corner in one of the 18 categories", () => {
    const valid = new Set(CORNER_CATEGORIES.map((c) => c.slug));
    for (const x of CURATED_CORNERS) expect(valid.has(curatedCategory(x) ?? ""), x.slug).toBe(true);
    const listed = CORNER_CATEGORIES.flatMap((c) => curatedInCategory(c.slug).map((x) => x.slug));
    expect(listed.sort()).toEqual(CURATED_CORNERS.map((x) => x.slug).sort());
  });

  it("carry an emoji, a duration, a setting, alt text and a photo search", () => {
    for (const x of CURATED_CORNERS) {
      expect(x.emoji.trim().length, x.slug).toBeGreaterThan(0);
      expect(x.durationMinutes, x.slug).toBeGreaterThan(0);
      expect(["home", "outdoors", "anywhere"], x.slug).toContain(x.setting);
      expect(x.coverAlt.trim().length, x.slug).toBeGreaterThan(10);
      const links = photoSearchLinks(x);
      expect(links.unsplash).toMatch(/^https:\/\/unsplash\.com\/s\/photos\//);
      expect(links.pexels).toMatch(/^https:\/\/www\.pexels\.com\/search\//);
    }
  });

  it("give 3 to 5 steps and 3 to 5 things you'll need", () => {
    for (const x of CURATED_CORNERS) {
      const steps = howToStart(x);
      expect(steps.length, `${x.slug} steps`).toBeGreaterThanOrEqual(3);
      expect(steps.length, `${x.slug} steps`).toBeLessThanOrEqual(5);
      expect(x.needs.length, `${x.slug} needs`).toBeGreaterThanOrEqual(3);
      expect(x.needs.length, `${x.slug} needs`).toBeLessThanOrEqual(5);
      expect(new Set(steps).size, `${x.slug} repeats a step`).toBe(steps.length);
    }
  });

  it("start with the Corner's cornerGuides.ts step where it has one", () => {
    expect(howToStart(curatedBySlug("running")!)[0]).toBe("Run-walk for 15 minutes: 1 minute running, 1 minute walking.");
    expect(howToStart(curatedBySlug("climbing")!)[0]).toBe("Book an intro session at a bouldering gym");
  });

  it("use only moods from moods.ts, derived rather than stored", () => {
    const valid = new Set(MOODS.map((m) => m.id));
    for (const x of CURATED_CORNERS) for (const m of cornerMoods(x)) expect(valid.has(m), x.slug).toBe(true);
    expect(cornerMoods(curatedBySlug("run-clubs")!)).toContain("people");
    expect(cornerMoods(curatedBySlug("running")!)).toContain("move");
    expect(cornerMoods(curatedBySlug("hiking")!)).toContain("outside");
    expect(cornerMoods(curatedBySlug("make-a-beat")!)).toContain("make");
  });

  it("look a Corner up by Space and slug", () => {
    expect(curatedFor("sports-fitness", "running")?.name).toBe("Running");
    expect(curatedFor("crafts-making", "running")).toBeUndefined();
  });
});
