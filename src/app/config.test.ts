import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL, SUPPORT_CONTACT } from "./config";

describe("launch config", () => {
  // The Terms and Privacy Policy pages and the landing footer link to this
  // address. An empty or malformed value would publish a dead Contact link.
  it("has a contact email that looks like an email address", () => {
    expect(CONTACT_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});

describe("SUPPORT_CONTACT", () => {
  it("is one https or mailto link with a label", () => {
    expect(SUPPORT_CONTACT.href).toMatch(/^(https:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+\.[^\s@]+)$/);
    expect(SUPPORT_CONTACT.label.trim().length).toBeGreaterThan(0);
  });
});
