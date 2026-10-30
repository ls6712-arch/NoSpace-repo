import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS, backTarget, isCounted, nextStep, prevStep, resolveStep, slideDirection } from "./steps";

describe("onboarding steps", () => {
  it("has the twelve screens in order", () => {
    expect(ONBOARDING_STEPS).toHaveLength(12);
    expect(nextStep("welcome")).toBe("signup");
    expect(nextStep("invite")).toBeNull();
    expect(prevStep("welcome")).toBeNull();
  });

  it("counts only the three taste questions", () => {
    expect(ONBOARDING_STEPS.filter(isCounted)).toEqual(["picks", "free", "yours"]);
  });

  it("has Back everywhere except the welcome and the plan", () => {
    const noBack = ONBOARDING_STEPS.filter((s) => backTarget(s, false) === null);
    expect(noBack).toEqual(["welcome", "plan"]);
  });

  it("does not send a signed-in person back to a screen before the account", () => {
    expect(backTarget("name", false)).toBe("code");
    expect(backTarget("name", true)).toBeNull();
    expect(backTarget("birthday", true)).toBe("name");
  });

  describe("resolveStep", () => {
    it("starts signed-out people at the welcome and signed-in people at the name", () => {
      expect(resolveStep(null, null, false)).toBe("welcome");
      expect(resolveStep(null, null, true)).toBe("name");
    });

    it("resumes after the last finished screen", () => {
      expect(resolveStep(null, "birthday", true)).toBe("where");
      expect(resolveStep("garbage", "birthday", true)).toBe("where");
    });

    it("lets a URL go back but never skip ahead", () => {
      expect(resolveStep("name", "where", true)).toBe("name");
      expect(resolveStep("yours", "where", true)).toBe("picks");
      expect(resolveStep("plan", null, true)).toBe("name");
    });

    it("keeps a signed-in person off the pre-account screens", () => {
      expect(resolveStep("welcome", "where", true)).toBe("name");
    });

    it("lets someone with no account walk the pre-account screens and nothing past them", () => {
      expect(resolveStep("signup", null, false)).toBe("signup");
      expect(resolveStep("code", null, false)).toBe("code");
      expect(resolveStep("name", null, false)).toBe("code");
    });

    it("opens every screen when there are no accounts to protect", () => {
      expect(resolveStep("plan", null, false, true)).toBe("plan");
      expect(resolveStep(null, null, false, true)).toBe("welcome");
    });

    it("stays on the last screen once everything is finished", () => {
      expect(resolveStep(null, "invite", true)).toBe("invite");
    });
  });

  it("slides forward, back, and not at all on the first screen", () => {
    expect(slideDirection(null, "welcome")).toBe(0);
    expect(slideDirection("name", "birthday")).toBe(1);
    expect(slideDirection("birthday", "name")).toBe(-1);
  });
});
