import { describe, expect, it } from "vitest";
import { CORNER_ACTIVITIES } from "./cornerActivities";
import { CATALOG_CORNERS } from "./catalogCorners";
import { hobbies } from "./hobbies";

const byCorner = new Map<string, typeof CORNER_ACTIVITIES[number][]>();
for (const a of CORNER_ACTIVITIES) byCorner.set(a.cornerSlug, [...(byCorner.get(a.cornerSlug) ?? []), a]);

/** The coverage rule (brief of Nov 7, 2026, 1 and 6): every Corner with activities always has options for every situation. */
describe("every Corner with activities has options for every situation", () => {
  it("has 300 activities on 50 Corners as delivered", () => {
    expect(CORNER_ACTIVITIES).toHaveLength(300);
    expect(byCorner.size).toBe(50);
  });

  it.each([...byCorner.entries()])("%s: at least 5, one solo, one with others, one free, one low energy, no duplicate titles", (slug, list) => {
    expect(list.length, `${slug} has ${list.length}`).toBeGreaterThanOrEqual(5);
    expect(list.some((a) => a.who.includes("solo")), `${slug} has no solo activity`).toBe(true);
    expect(list.some((a) => a.who.includes("friend") || a.who.includes("group")), `${slug} has none with others`).toBe(true);
    expect(list.some((a) => a.cost === "free"), `${slug} has no free activity`).toBe(true);
    expect(list.some((a) => a.energy === "low"), `${slug} has no low-energy activity`).toBe(true);
    expect(new Set(list.map((a) => a.title)).size, `${slug} has a duplicate title`).toBe(list.length);
  });

  it("has unique ids of the form {corner_slug}-{n}", () => {
    expect(new Set(CORNER_ACTIVITIES.map((a) => a.id)).size).toBe(CORNER_ACTIVITIES.length);
    for (const a of CORNER_ACTIVITIES) expect(a.id).toMatch(new RegExp(`^${a.cornerSlug}-\\d+$`));
  });

  it("puts every activity on a Corner that exists, under the Space the app knows it by", () => {
    const space = new Map<string, string>();
    for (const h of hobbies) for (const s of h.subItems) if (!space.has(s.slug)) space.set(s.slug, h.slug);
    for (const c of CATALOG_CORNERS) space.set(c.slug, c.spaceSlug);
    for (const a of CORNER_ACTIVITIES) expect(space.get(a.cornerSlug), `${a.id} (${a.cornerSlug})`).toBe(a.spaceSlug);
  });

  it("uses no dash as punctuation and no link in what people read", () => {
    for (const a of CORNER_ACTIVITIES) {
      for (const text of [a.title, a.how, a.firstStep, a.momentPrompt]) {
        expect(text, a.id).not.toMatch(/[–—]/);
        expect(text, a.id).not.toMatch(/https?:\/\/|www\./i);
      }
    }
  });
});
