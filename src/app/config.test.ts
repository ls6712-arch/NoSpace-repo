import { describe, expect, it } from "vitest";
import { CONTACT_EMAIL } from "./config";

describe("launch config", () => {
  // The Terms and Privacy Policy pages and the landing footer link to this
  // address. An empty or malformed value would publish a dead Contact link.
  it("has a contact email that looks like an email address", () => {
    expect(CONTACT_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});
