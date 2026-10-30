import { describe, expect, it } from "vitest";
import { isNoAccountError, isRateLimited, retryAfterSeconds } from "./authErrors";

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

describe("retryAfterSeconds and isRateLimited", () => {
  it("reads the wait out of Supabase's own message", () => {
    expect(retryAfterSeconds({ status: 429, message: "For security purposes, you can only request this after 52 seconds." })).toBe(52);
    expect(isRateLimited({ status: 429, message: "For security purposes, you can only request this after 52 seconds." })).toBe(true);
  });

  it("never guesses a wait: the hourly cap is a limit with no time", () => {
    const hourly = { status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" };
    expect(isRateLimited(hourly)).toBe(true);
    expect(retryAfterSeconds(hourly)).toBeNull();
  });

  it("is neither for anything that is not the limit", () => {
    for (const e of [null, { status: 422, code: "otp_disabled", message: "Signups not allowed for otp" }, { message: "Failed to fetch" }]) {
      expect(isRateLimited(e)).toBe(false);
      expect(retryAfterSeconds(e)).toBeNull();
    }
  });
});
