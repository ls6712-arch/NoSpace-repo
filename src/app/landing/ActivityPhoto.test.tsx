// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityPhoto, activityPhoto } from "./ActivityPhoto";
import { ACTIVITY_EXAMPLES, LANDING_EXAMPLES } from "./examples";

afterEach(cleanup);
const root = path.resolve(__dirname, "../../../public");

describe("uploaded activity photography", () => {
  it("ships every displayed photo and responsive variant locally with source credits", async () => {
    for (const example of LANDING_EXAMPLES) {
      const photo = activityPhoto(example);
      expect(photo.src, example.id).toMatch(/^\/landing\/photos\//);
      expect(photo.alt, example.id).toBeTruthy();
      expect(photo.credit).toBeTruthy();
      expect(photo.source).toMatch(/^https:\/\/unsplash.com\/photos\//);
      for (const width of [400, 800, 1600]) {
        const variant = activityPhoto(example, width);
        const file = path.join(root, variant.src!);
        const meta = await sharp(file).metadata();
        expect(meta.format).toBe("webp");
        expect(meta.width).toBe(width);
        expect(meta.height).toBe(Math.round(width * 10 / 16));
        expect(meta.exif).toBeUndefined();
        expect(fs.statSync(file).size).toBeLessThan(400 * 1024);
      }
    }
    const photo = activityPhoto(LANDING_EXAMPLES.find(e => e.id === "photo-walk")!);
    expect(photo.credit).toBe("Alex Gorin");
    expect(photo.srcSet).toContain("photography-400.webp 400w");
    expect(photo.srcSet).toContain("photography-1600.webp 1600w");
  });

  it("uses a Painting example for the watercolor photograph", () => {
    const example = LANDING_EXAMPLES.find(e => e.id === "paint")!;
    expect(example.interest).toBe("Painting");
    expect(example.corner).toEqual(["art-creative", "painting"]);
    expect(activityPhoto(example).alt).toContain("watercolors");
    expect(activityPhoto(example).src).toContain("painting-800.webp");
  });

  it("tries the original if a responsive candidate fails, then uses the local graphic", () => {
    render(<ActivityPhoto example={LANDING_EXAMPLES[0]} priority/>);
    const image = screen.getByRole("img");
    expect(image.getAttribute("loading")).toBe("eager");
    expect(image.getAttribute("srcset")).toContain("1600w");
    fireEvent.error(image);
    expect(image.getAttribute("srcset")).toBeNull();
    fireEvent.error(image);
    expect(document.querySelector(".lp-activity-photo svg")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });

  it("retains older request ids without fetching unrelated photos", () => {
    for (const id of ["sketch", "birds"]) {
      const photo = activityPhoto(ACTIVITY_EXAMPLES.find(e => e.id === id)!);
      expect(photo.src).toBeUndefined();
      expect(photo.source).toBeUndefined();
      expect(photo.alt).toContain("illustration");
    }
  });
});
