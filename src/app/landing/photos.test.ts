import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasHobbyPhoto } from "../data/hobbyPhotos";
import { hasSubHobbyArt } from "../components/SubHobbyArt";
import { LANDING_COPY as COPY } from "./copy";
import { PHOTOS, photoSrcSet, usedCredits, type PhotoKey } from "./photos";

const allKeys = (): PhotoKey[] => [
  ...COPY.heroPicks.map((p) => p.image),
  ...Object.values(COPY.demoPicks).map((p) => p.image),
  ...COPY.stubs.map((s) => s.image),
];

describe("landing pictures", () => {
  it("gives every ticket pick and every Stub a picture the app already has", () => {
    for (const key of allKeys()) {
      const spec = PHOTOS[key];
      expect(spec, key).toBeTruthy();
      if (spec.photo) expect(hasHobbyPhoto(spec.photo), `${key} photo`).toBe(true);
      if (spec.local) expect(spec.credit, `${key} credit`).toBeTruthy();
      if (spec.art) expect(hasSubHobbyArt(spec.art.hobby, spec.art.sub), `${key} art`).toBe(true);
      expect(spec.photo || spec.art, key).toBeTruthy();
    }
  });

  it("falls back to an illustration for every photo, so a broken photo never leaves a hole", () => {
    for (const [key, spec] of Object.entries(PHOTOS)) expect(spec.art, key).toBeTruthy();
  });

  it("describes every photo", () => {
    const alts = COPY.photoAlt as Partial<Record<PhotoKey, string>>;
    for (const [key, spec] of Object.entries(PHOTOS)) {
      if (spec.photo || spec.local) expect(alts[key as PhotoKey], key).toBeTruthy();
    }
  });

  it("has every file of our own at both sizes, each under 120KB", () => {
    const dir = path.resolve(__dirname, "../../../public/landing/photos");
    for (const [key, spec] of Object.entries(PHOTOS)) {
      if (!spec.local) continue;
      const widths = spec.local.startsWith("shelf") ? [400, 800] : [600, 1200];
      for (const w of widths) {
        const file = path.join(dir, `${spec.local}-${w}.webp`);
        expect(fs.existsSync(file), `${key} ${w}`).toBe(true);
        expect(fs.statSync(file).size, `${key} ${w}`).toBeLessThan(120 * 1024);
      }
    }
  });

  it("builds a srcset from the app's own photo URLs", () => {
    const set = photoSrcSet("pottery", [400, 800]);
    expect(set).toMatch(/w=400 400w, .*w=800 800w$/);
  });

  it("credits only photographers on record, each once, including the five supplied photos", () => {
    const credits = usedCredits(allKeys());
    expect(new Set(credits.map((c) => c.source)).size).toBe(credits.length);
    for (const name of ["Richard Fox", "Jessica Pamp", "Zalfa Imani", "Alex Zamora", "Peter Okwara"]) {
      expect(credits.map((c) => c.credit)).toContain(name);
    }
    for (const c of credits) expect(c.source).toMatch(/^https:\/\/unsplash\.com\//);
  });
});
