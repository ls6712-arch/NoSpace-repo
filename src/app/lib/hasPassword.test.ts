import { describe, expect, it } from "vitest";
import { hasPassword } from "./hasPassword";

describe("hasPassword", () => {
  it("is true only when the account says so", () => {
    expect(hasPassword({ user_metadata: { has_password: true } })).toBe(true);
    expect(hasPassword({ user_metadata: {} })).toBe(false);
    expect(hasPassword({ user_metadata: { has_password: "yes" } })).toBe(false);
    expect(hasPassword({ user_metadata: null })).toBe(false);
    expect(hasPassword(null)).toBe(false);
  });
});
