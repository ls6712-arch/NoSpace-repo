import { describe, expect, it } from "vitest";
import { DEFAULT_RETRY_SECONDS, isNoAccountError, retryAfterSeconds } from "./authErrors";

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

describe("retryAfterSeconds", () => {
  it("reads the wait out of Supabase's own message", () => {
    expect(retryAfterSeconds({ status: 429, message: "For security purposes, you can only request this after 52 seconds." })).toBe(52);
  });

  it("falls back to a minute when the limit gives no wait", () => {
    expect(retryAfterSeconds({ status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" })).toBe(DEFAULT_RETRY_SECONDS);
  });

  it("is null for anything that is not the limit", () => {
    expect(retryAfterSeconds(null)).toBeNull();
    expect(retryAfterSeconds({ status: 422, code: "otp_disabled", message: "Signups not allowed for otp" })).toBeNull();
    expect(retryAfterSeconds({ message: "Failed to fetch" })).toBeNull();
  });
});
