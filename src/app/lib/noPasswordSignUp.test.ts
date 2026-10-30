import { describe, expect, it } from "vitest";

// Every account is made through the onboarding, which asks for a birthday. The old
// email-and-password sign-up page is gone; nothing in the app may create an account
// with a password and no birthday step.
const sources = import.meta.glob(["../**/*.ts", "../**/*.tsx", "!../**/*.test.*"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("sign-up goes through the onboarding", () => {
  it("never calls supabase.auth.signUp", () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /auth\.signUp\s*\(/.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });

  it("has no old log in or onboarding page left", () => {
    const files = Object.keys(sources);
    expect(files.some((f) => f.endsWith("/OnboardingLegacy.tsx"))).toBe(false);
    expect(Object.values(sources).some((t) => t.includes("LoginLegacy"))).toBe(false);
  });
});
