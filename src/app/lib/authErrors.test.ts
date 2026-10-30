import { describe, expect, it } from "vitest";
import { isNoAccountError } from "./authErrors";

describe("isNoAccountError", () => {
  it("recognises an unknown email by code or by message", () => {
    expect(isNoAccountError({ code: "otp_disabled" })).toBe(true);
    expect(isNoAccountError({ code: "signup_disabled" })).toBe(true);
    expect(isNoAccountError({ message: "Signups not allowed for otp" })).toBe(true);
    expect(isNoAccountError({ message: "User not found" })).toBe(true);
  });

  it("does not treat anything else as a missing account", () => {
    expect(isNoAccountError(null)).toBe(false);
    expect(isNoAccountError({ code: "over_email_send_rate_limit", message: "email rate limit exceeded" })).toBe(false);
    expect(isNoAccountError({ message: "Failed to fetch" })).toBe(false);
  });
});
