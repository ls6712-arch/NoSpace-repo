import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CORNER_WORLDS } from "../world/corners";
import { cornerPhoto, cornerPhotoAlt } from "./cornerPhoto";
import { CORNER_STILL_KEYS, cornerHasStill, cornerPicture, cornerPictureAlt } from "./cornerPicture";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

describe("cornerPicture", () => {
  it("has a still for exactly the Corners whose 3D world is switched on", () => {
    expect([...CORNER_STILL_KEYS].sort()).toEqual(CORNER_WORLDS.map((w) => w.key).sort());
  });

  it("points at a file that is there: a WebP under 80 kB, 800 by 800", () => {
    for (const w of CORNER_WORLDS) {
      const [spaceSlug, slug] = w.key.split("/");
      const src = cornerPicture(spaceSlug, slug)!;
      expect(src).toBe(`/worlds/${w.slug}/card.webp`);
      const bytes = fs.readFileSync(path.join(root, "public", src));
      expect(bytes.length, src).toBeLessThan(80_000);
      // A lossy WebP: "RIFF", the size, "WEBPVP8 ", then the frame header with both sides (14 bits each).
      expect(bytes.toString("latin1", 0, 4) + bytes.toString("latin1", 8, 16), src).toBe("RIFFWEBPVP8 ");
      expect([bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff], src).toEqual([800, 800]);
      expect(cornerPictureAlt(spaceSlug, slug, w.name)).toBe(w.name);
    }
  });

  it("gives a Corner without a 3D world exactly the photo and alt text it has today", () => {
    for (const [spaceSlug, slug] of [["crafts-making", "knitting"], ["food-drink", "baking"], ["no-such-space", "no-such-corner"]]) {
      expect(cornerHasStill(spaceSlug, slug)).toBe(false);
      for (const width of [160, 600, 1600]) expect(cornerPicture(spaceSlug, slug, width)).toBe(cornerPhoto(spaceSlug, slug, width));
      expect(cornerPictureAlt(spaceSlug, slug, "A name")).toBe(cornerPhotoAlt(slug));
    }
  });

  it("is the only place that names the still files", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && read(rel).includes("card.webp")) hits.push(rel);
      }
    };
    walk("src");
    expect(hits).toEqual(["src/app/lib/cornerPicture.ts"]);
  });
});

describe("Home and Discover show still pictures only", () => {
  // Everything these pages gained for Corner pictures. None of it may reach the 3D engine or the world configs:
  // the helper keeps its own short list so that a card downloads no part of a 3D world.
  const files = ["src/app/lib/cornerPicture.ts", "src/app/lib/homeCornersRow.ts", "src/app/components/home/CornersRow.tsx", "src/app/components/home/SuggestionPhoto.tsx", "src/app/components/corners/CornerCard.tsx", "src/app/components/discover/CornerTearCard.tsx"];
  it("imports nothing from the 3D world", () => {
    for (const f of files) {
      expect(read(f), f).not.toMatch(/from "three"/);
      expect(read(f), f).not.toMatch(/from "[^"]*\/world(\/|")/);
      expect(read(f), f).not.toMatch(/import\(/);
    }
  });
  it("never says room in what a person reads", () => {
    const row = read("src/app/components/home/CornersRow.tsx");
    const copy = row.slice(row.indexOf("export const CORNERS_ROW_COPY"), row.indexOf("} as const;"));
    expect(copy).not.toMatch(/room/i);
    // Every other string a person can meet here is a Corner's own name or one-line description.
    expect(row.match(/(?:alt|aria-label|title|label)="[^"]*"/g) ?? []).toEqual([]);
  });
});
