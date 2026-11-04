// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityPhoto, activityPhoto } from "./ActivityPhoto";
import { ACTIVITY_EXAMPLES } from "./examples";

afterEach(cleanup);

describe("activity photography", () => {
  it("uses the existing photo library and the correctly credited local pier photo", () => {
    for (const example of ACTIVITY_EXAMPLES) {
      const photo = activityPhoto(example);
      expect(photo.src, example.id).toBeTruthy();
      expect(photo.alt, example.id).toBeTruthy();
      expect(photo.source).toMatch(/^https:\/\/unsplash.com\//);
    }
    const photo = activityPhoto(ACTIVITY_EXAMPLES.find(e => e.id === "photo-walk")!);
    expect(photo.credit).toBe("Richard Fox");
    for (const width of [400, 800]) expect(fs.statSync(path.resolve(__dirname, `../../../public/landing/photos/shelf-pier-${width}.webp`)).size).toBeLessThan(120 * 1024);
  });

  it("keeps a useful local graphic if a photo fails instead of leaving a broken image", () => {
    render(<ActivityPhoto example={ACTIVITY_EXAMPLES[0]} priority/>);
    const image = screen.getByRole("img");
    expect(image.getAttribute("loading")).toBe("eager");
    fireEvent.error(image);
    expect(document.querySelector(".lp-activity-photo svg")).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });
});
