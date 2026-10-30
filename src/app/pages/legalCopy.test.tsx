// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { TermsCheckbox } from "../components/TermsCheckbox";
import { TERMS_VERSION, suggestionLoggingEnabled } from "../config";
import { PrivacyPolicy } from "./PrivacyPolicy";
import { Terms } from "./Terms";

afterEach(cleanup);
const text = (node: React.ReactElement) => render(<MemoryRouter>{node}</MemoryRouter>).container.textContent?.replace(/\s+/g, " ") ?? "";

describe("the 18+ Terms and Privacy Policy", () => {
  it("asks everyone to accept again: the Terms version moved past the 16+ one", () => {
    expect(TERMS_VERSION > "2026-10-08").toBe(true);
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("says 18 in the Terms and in the checkbox, and 16 nowhere", () => {
    const terms = text(<Terms />);
    expect(terms).toContain("You must be at least 18 years old to create an account. By signing up, you’re confirming you meet that age.");
    cleanup();
    const box = text(<TermsCheckbox checked={false} onChange={() => {}} />);
    expect(box).toContain("I’m 18 or older and agree to the Terms and Privacy Policy");
    expect(terms + box).not.toMatch(/\b16\b/);
  });

  it("no longer says Soosh is invite-only", () => {
    const terms = text(<Terms />);
    expect(terms).not.toMatch(/invite-only/);
    expect(terms).toContain("Invite links are personal. Please only use one that was sent to you, and don’t sell or post them publicly.");
  });

  it("tells people why their date of birth is asked and that it stays private", () => {
    const privacy = text(<PrivacyPolicy />);
    expect(privacy).toContain("We ask for your date of birth to confirm you’re 18 or over. It’s kept private, never shown on your profile or to anyone else, and never used for ads.");
  });

  it("has no open TODO about the date of birth left in the Privacy Policy source", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "PrivacyPolicy.tsx"), "utf8");
    expect(source).not.toMatch(/TODO\(landing page spec §4/);
  });

  it("tells people about the record of Home suggestions, and logging is on only while it does", () => {
    const privacy = text(<PrivacyPolicy />);
    const line = "We keep a short record of the suggestions we show you on Home and which ones you open or join, for 90 days. We use it to make suggestions fit you better. Only you can see it, and it is deleted with your account.";
    expect(privacy).toContain(line);
    // The record is only written while this says so.
    if (suggestionLoggingEnabled) expect(privacy).toContain("We keep a short record of the suggestions we show you on Home");
  });
});
