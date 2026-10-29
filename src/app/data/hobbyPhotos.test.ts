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

  it("credit the Corners added with the Corners home and every Corner in the Oct 28 photo pass and the 10 new Corners", () => {
    const added = ["boxing", "skateboarding", "kayaking", "surfing", "wild-swimming", "sauna-cold-plunge", "music-production", "karaoke", "live-music", "pasta", "trivia", "improv", "volunteering"];
    const pass = [
      "life-drawing", "walking-clubs", "badminton", "skating", "ultimate-frisbee", "rafting", "mahjong", "letter-writing", "city-walks", "film-clubs", "food-tours", "hyrox",
      "crochet", "3d-printing", "sourdough", "bbq", "composting", "djing",
      "embroidery", "woodworking", "paper-crafts", "model-making", "drawing", "songwriting", "calligraphy", "sculpture", "pickleball", "antiques", "dance",
      "trading-cards", "d-d", "choir", "fragrance",
      "cricket", "carrom", "table-tennis", "open-mics", "indian-classical-dance", "indian-classical-music", "piano", "sound-baths", "stargazing", "block-printing",
    ];
    expect([...added, ...pass].filter((s) => !(s in CREDITS))).toEqual([]);
    expect(Object.keys(CREDITS).sort()).toEqual([...added, ...pass].sort());
  });

  it("keeps the make-a-beat photo and credit on music-production, the Corner it was merged into", () => {
    expect(photoCredit("music-production")?.credit).toBe("Veikko Venemies");
    expect(photoCredit("music-production")?.source).toBe("https://unsplash.com/photos/obU1Dubo3vM");
    expect(hasHobbyPhoto("make-a-beat")).toBe(false);
    expect(photoCredit("make-a-beat")).toBeUndefined();
  });
});
