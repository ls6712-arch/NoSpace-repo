import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DURATION_BASE, DURATION_FAST, EASE_STANDARD, STAGGER, STAGGER_CAP, fuse, haptic, page, pop, press, settle, sheet, shared, staggerDelay } from "./motionTokens";
import { springs } from "./springs";

describe("motion tokens", () => {
  it("holds the values the brief fixes", () => {
    expect(press).toMatchObject({ stiffness: 500, damping: 30 });
    expect(pop).toMatchObject({ stiffness: 420, damping: 22 });
    expect(sheet).toMatchObject({ stiffness: 380, damping: 36 });
    expect(shared).toMatchObject({ stiffness: 350, damping: 32 });
    expect(STAGGER).toBe(0.04);
  });

  it("staggers 40ms apart and stops growing past the cap", () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(3)).toBeCloseTo(0.12);
    expect(staggerDelay(500)).toBeCloseTo(STAGGER_CAP * STAGGER);
  });

  it("keeps the older springs import pointing at the same values", () => {
    expect(springs.press).toBe(press);
    expect(springs.sheet).toBe(sheet);
    expect(springs.settle).toBe(settle);
  });

  it("matches the CSS motion tokens in theme.css, so CSS and JS move alike", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../styles/theme.css"), "utf8");
    expect(css).toContain(`--duration-fast: ${DURATION_FAST * 1000}ms;`);
    expect(css).toContain(`--duration-base: ${DURATION_BASE * 1000}ms;`);
    expect(css).toContain(`--ease-standard: cubic-bezier(${EASE_STANDARD.join(", ")});`);
    expect(page).toEqual({ duration: DURATION_BASE, ease: EASE_STANDARD });
  });

  it("burns a fuse at an even speed over the time given", () => {
    expect(fuse(6000)).toEqual({ duration: 6, ease: "linear" });
  });

  it("does not throw where vibrate is missing", () => {
    expect(() => haptic()).not.toThrow();
  });
});
