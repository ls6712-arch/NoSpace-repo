import { describe, expect, it } from "vitest";
import { LANDING_COPY } from "./copy";
import landing from "./Landing.tsx?raw";
import welcome from "../pages/Welcome.tsx?raw";
import arrival from "../pages/InviteArrival.tsx?raw";
import inviteCard from "../components/OnboardingInviteCard.tsx?raw";

// Sign-up is open to anyone 18 and over. No signed-out page asks for an invite or a place on a list.
const GATE = /invite-only|request an invite|waitlist|wait list|on the list/i;

describe("open sign-up copy", () => {
  it("has no invite-only or waitlist language on the landing page", () => {
    for (const [key, value] of Object.entries(LANDING_COPY)) {
      const text = typeof value === "string" ? value : JSON.stringify(value);
      expect(text, key).not.toMatch(GATE);
    }
    expect(landing).not.toMatch(GATE);
  });

  it("sends the landing buttons to sign-up", () => {
    expect(LANDING_COPY.signUp).toBe("Sign up");
    expect(landing).toContain('to="/onboarding"');
    expect(landing).not.toContain("WaitlistForm");
  });

  it("has no invite-only or waitlist language on the other invite-era screens", () => {
    for (const [name, source] of Object.entries({ welcome, arrival, inviteCard })) {
      expect(source, name).not.toMatch(GATE);
    }
  });
});
