import { describe, expect, it } from "vitest";
import { isBlocklistedName } from "./blocklist";

describe("isBlocklistedName", () => {
  const blocklist = ["lego"];

  it("blocks an exact-token match, any casing", () => {
    expect(isBlocklistedName("LEGO Technic", blocklist)).toBe(true);
  });

  it("blocks the simple plural", () => {
    expect(isBlocklistedName("Legos", blocklist)).toBe(true);
  });

  it("blocks a hyphenated token", () => {
    expect(isBlocklistedName("lego-builds", blocklist)).toBe(true);
  });

  it("does not block a word that merely contains the term as a substring", () => {
    expect(isBlocklistedName("Leg of lamb", blocklist)).toBe(false);
    expect(isBlocklistedName("Allegory", blocklist)).toBe(false);
    expect(isBlocklistedName("Legolas", blocklist)).toBe(false);
    expect(isBlocklistedName("Bootleg Orchestra", blocklist)).toBe(false);
  });

  it("does not block unrelated names", () => {
    expect(isBlocklistedName("Pottery", blocklist)).toBe(false);
  });

  it("has nothing to block with an empty list", () => {
    expect(isBlocklistedName("LEGO Technic", [])).toBe(false);
  });
});
