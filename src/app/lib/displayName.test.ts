import { describe, expect, it } from "vitest";
import { cleanDisplayName, DISPLAY_NAME_MAX, isEmailPrefixName, validateDisplayName } from "./displayName";

describe("displayName", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanDisplayName("  Mia   Chen ")).toBe("Mia Chen");
  });
  it("rejects empty and whitespace-only names", () => {
    expect(validateDisplayName("").ok).toBe(false);
    expect(validateDisplayName("   ").ok).toBe(false);
  });
  it("rejects names over the limit", () => {
    expect(validateDisplayName("a".repeat(DISPLAY_NAME_MAX + 1)).ok).toBe(false);
    expect(validateDisplayName("a".repeat(DISPLAY_NAME_MAX)).ok).toBe(true);
  });
  it("returns the cleaned name", () => {
    expect(validateDisplayName(" Mia ")).toEqual({ ok: true, name: "Mia" });
  });
  it("detects an email-prefix name", () => {
    expect(isEmailPrefixName("mia.chen", "mia.chen@example.org")).toBe(true);
    expect(isEmailPrefixName("Mia Chen", "mia.chen@example.org")).toBe(false);
    expect(isEmailPrefixName("", "")).toBe(false);
  });
});
