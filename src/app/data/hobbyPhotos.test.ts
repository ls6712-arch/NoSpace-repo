import { describe, expect, it } from "vitest";
import { CREDITS, hasHobbyPhoto, photoCredit, photoEntries } from "./hobbyPhotos";

describe("Corner photos", () => {
  it("never use one photo for two Corners", () => {
    const seen = new Map<string, string>();
    const repeats: string[] = [];
    for (const [corner, id] of photoEntries()) {
      const first = seen.get(id);
      if (first) repeats.push(`${id}: ${first}, ${corner}`);
      else seen.set(id, corner);
    }
    expect(repeats).toEqual([]);
  });

  it("use well-formed Unsplash photo ids", () => {
    const bad = photoEntries().filter(([, id]) => !/^photo-[0-9]{10,}-[0-9a-f]{12}$/.test(id));
    expect(bad).toEqual([]);
  });

  it("record a credit, source page and alt text for each credited photo, and only for Corners that have one", () => {
    for (const [corner, c] of Object.entries(CREDITS)) {
      expect(hasHobbyPhoto(corner), corner).toBe(true);
      expect(c.credit.trim().length, corner).toBeGreaterThan(0);
      expect(c.source, corner).toMatch(/^https:\/\/unsplash\.com\/photos\/[\w-]+$/);
      expect(c.alt.trim().length, corner).toBeGreaterThan(10);
    }
    expect(photoCredit("boxing")?.credit).toBe("Lisa Marie Theck");
    expect(photoCredit("pottery")).toBeUndefined();
  });

  it("cover the 15 Corners added with the Corners home", () => {
    const added = ["boxing", "skateboarding", "kayaking", "surfing", "wild-swimming", "sauna-cold-plunge", "make-a-beat", "karaoke", "live-music", "choir", "pasta", "trivia", "improv", "volunteering", "d-d"];
    expect(added.filter((s) => !(s in CREDITS))).toEqual([]);
    expect(Object.keys(CREDITS).sort()).toEqual([...added].sort());
  });
});
