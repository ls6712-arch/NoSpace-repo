import { describe, expect, it } from "vitest";
import { laterStep } from "./onboardingProgress";
import { resolveStep } from "../pages/onboarding/steps";
import { signedInTarget } from "./signInTarget";

describe("signedInTarget", () => {
  it("sends a finished account where it was going, or Home", () => {
    expect(signedInTarget({ onboarding_completed: true }, "/pursuit/abc")).toBe("/pursuit/abc");
    expect(signedInTarget({ onboarding_completed: true }, "/")).toBe("/");
  });

  it("sends an unfinished account back into onboarding, keeping the destination", () => {
    expect(signedInTarget({ onboarding_completed: false }, "/join/abc")).toBe("/onboarding?redirect=%2Fjoin%2Fabc");
  });

  it("does not guess before the profile has loaded", () => {
    expect(signedInTarget(null, "/")).toBe("/");
  });

  it("resumes onboarding after the saved step, never at the welcome", () => {
    // The account says birthday is finished; this device knows nothing.
    const saved = laterStep(null, "birthday");
    expect(resolveStep(null, saved, true)).toBe("where");
    // Nothing saved at all: after the account exists, the first screen is the name.
    expect(resolveStep(null, null, true)).toBe("name");
  });
});
