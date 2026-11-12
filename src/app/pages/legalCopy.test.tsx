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

  it("tells guests what Stubby keeps without an account, and for how long (guest Stubby, Nov 3, 2026)", () => {
    const privacy = text(<PrivacyPolicy />);
    expect(privacy).toContain("Trying Stubby without an account");
    // What the code does: a guest account on the first ask, no email, a salted hash kept 2 days,
    // never the address, deletion after 30 quiet days, carried over on sign-up, not merged on log in.
    expect(privacy).toContain("The first time you ask, we make a guest account for you in this browser. It has no email, name or password.");
    expect(privacy).toContain("(a salted hash) with each guest ask, for 2 days. We never keep the address itself.");
    expect(privacy).toContain("A guest account with no activity for 30 days is deleted, with everything in it.");
    expect(privacy).toContain("If you sign up, everything you did as a guest moves into your new account.");
    expect(privacy).toContain("the guest’s picks aren’t added to it.");
    // The old fixed allowance is gone: limits come from the server now.
    expect(privacy).not.toContain("limit them to 3 a day");
  });

  it("says a date of birth is locked once on file, and what under 18 means", () => {
    const privacy = text(<PrivacyPolicy />);
    expect(privacy).toContain("Once it’s on file it can’t be changed in the app; to correct it, contact us.");
    expect(privacy).toContain("If a date shows you’re under 18, we don’t keep the date, and your account can only use Stubby.");
  });
});
