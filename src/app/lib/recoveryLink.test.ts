// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { forgetResetEmail, readRecoveryHash, readResetEmail, rememberResetEmail } from "./recoveryLink";

describe("readRecoveryHash", () => {
  it("knows a good reset link", () => {
    expect(readRecoveryHash("#access_token=abc&refresh_token=def&type=recovery")).toEqual({
      kind: "ready",
      hash: "#access_token=abc&refresh_token=def&type=recovery",
    });
  });

  it("keeps only the tokens when the redirect kept its own fragment", () => {
    const r = readRecoveryHash("#/reset-password#access_token=abc&type=recovery");
    expect(r.kind).toBe("ready");
    expect(r.hash).toBe("#access_token=abc&type=recovery");
  });

  it("knows an expired or used link and points the router at the reset screen", () => {
    const r = readRecoveryHash("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(r).toEqual({ kind: "expired", hash: "#/reset-password" });
  });

  it("leaves an ordinary route alone", () => {
    expect(readRecoveryHash("#/discover")).toEqual({ kind: null, hash: "#/discover" });
    expect(readRecoveryHash("")).toEqual({ kind: null, hash: "" });
  });

  it("does not take a sign-in token for a reset", () => {
    expect(readRecoveryHash("#access_token=abc&type=magiclink").kind).toBeNull();
  });
});

describe("the address a reset link was asked for", () => {
  beforeEach(() => localStorage.clear());

  it("is kept, then forgotten", () => {
    expect(readResetEmail()).toBeNull();
    rememberResetEmail("maya@example.com");
    expect(readResetEmail()).toBe("maya@example.com");
    forgetResetEmail();
    expect(readResetEmail()).toBeNull();
  });

  it("is dropped after an hour", () => {
    localStorage.setItem("soosh.reset.email", JSON.stringify({ email: "maya@example.com", at: Date.now() - 61 * 60 * 1000 }));
    expect(readResetEmail()).toBeNull();
  });
});
