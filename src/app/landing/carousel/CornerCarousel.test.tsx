// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { isBrowsableCorner } from "../../data/hobbies";
import { categoryOfCorner } from "../../data/cornerCategories";
import { CornerCarousel } from "./CornerCarousel";
import { CAROUSEL_CORNERS, carouselCorners } from "./corners";

afterEach(cleanup);

describe("landing Corner carousel", () => {
  it("shows every listed Corner, each browsable with its own credited photo", () => {
    const corners = carouselCorners();
    expect(corners).toHaveLength(CAROUSEL_CORNERS.length);
    for (const [space, slug] of CAROUSEL_CORNERS) expect(isBrowsableCorner(space, slug), slug).toBe(true);
    expect(new Set(corners.map(c => c.src)).size).toBe(corners.length);
    for (const c of corners) {
      expect(c.to).toBe(`/corners/${c.slug}`);
      expect(c.alt.length, c.slug).toBeGreaterThan(0);
      expect(c.src.startsWith("https://images.unsplash.com/"), c.slug).toBe(true);
    }
  });
  it("never puts two Corners from the same group side by side, including where the row loops", () => {
    const groups = CAROUSEL_CORNERS.map(([space, slug]) => categoryOfCorner(space, slug)?.slug);
    groups.forEach((g, i) => { expect(g).toBeTruthy(); expect(g).not.toBe(groups[(i + 1) % groups.length]); });
  });
  it("is left out when the browser has no WebGL2", () => {
    const { container } = render(<MemoryRouter><CornerCarousel/></MemoryRouter>);
    expect(container.innerHTML).toBe("");
  });
});
