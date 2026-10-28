import { describe, expect, it } from "vitest";
import { STAGGER, STAGGER_CAP, haptic, pop, press, sheet, shared, staggerDelay } from "./motionTokens";
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
  });

  it("does not throw where vibrate is missing", () => {
    expect(() => haptic()).not.toThrow();
  });
});
