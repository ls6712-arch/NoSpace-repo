// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const otp = vi.hoisted(() => ({ fn: vi.fn(), password: vi.fn(), update: vi.fn() }));
vi.mock("../../lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signInWithOtp: otp.fn,
      signInWithPassword: otp.password,
      updateUser: otp.update,
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

import { AuthProvider, useAuth } from "./AuthContext";
import { recordSendMs } from "../lib/sendTiming";

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  sessionStorage.clear();
  otp.fn.mockReset();
  otp.password.mockReset();
  otp.update.mockReset();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function timed(email: string) {
  const { result } = renderHook(() => useAuth(), { wrapper });
  const t0 = Date.now();
  let answer: { error: string | null } | undefined;
  const pending = act(async () => {
    answer = await result.current.sendSignInCode(email);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  await pending;
  return { answer, took: Date.now() - t0 };
}

describe("sendSignInCode", () => {
  it("never asks Supabase to create the account", async () => {
    otp.fn.mockResolvedValue({ error: null });
    await timed("mia@example.com");
    expect(otp.fn).toHaveBeenCalledWith({ email: "mia@example.com", options: { shouldCreateUser: false } });
  });

  it("answers an unknown email exactly like a known one", async () => {
    otp.fn.mockResolvedValueOnce({ error: null });
    const known = await timed("mia@example.com");
    otp.fn.mockResolvedValueOnce({ error: { status: 422, code: "otp_disabled", message: "Signups not allowed for otp" } });
    const unknown = await timed("nobody@example.com");
    expect(unknown.answer).toEqual(known.answer);
    expect(unknown.answer).toEqual({ error: null });
  });

  it("holds an unknown email back as long as a real send usually takes", async () => {
    [1500, 1500, 1500].forEach(recordSendMs);
    otp.fn.mockResolvedValue({ error: { status: 422, code: "otp_disabled", message: "Signups not allowed for otp" } });
    const unknown = await timed("nobody@example.com");
    expect(unknown.took).toBeGreaterThanOrEqual(1500);
  });

  it("still reports a real failure, such as the mail server being down", async () => {
    otp.fn.mockResolvedValue({ error: { status: 500, code: "unexpected_failure", message: "Error sending magic link email", name: "AuthApiError" } });
    const failed = await timed("mia@example.com");
    expect(failed.answer?.error).toBeTruthy();
  });
});

describe("the rest of the sign-in calls", () => {
  it("reports asking for too many codes as a wait, not a failure (log in and sign-up)", async () => {
    otp.fn.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit", message: "For security purposes, you can only request this after 52 seconds." } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    let login: unknown;
    let signup: unknown;
    await act(async () => {
      login = await result.current.sendSignInCode("mia@example.com");
      signup = await result.current.sendEmailCode("mia@example.com");
    });
    expect(login).toEqual({ error: null, retryAfterSeconds: 52 });
    expect(signup).toEqual({ error: null, retryAfterSeconds: 52 });
  });

  it("reports the hourly cap, which has no time to give, as too many (never a guessed wait)", async () => {
    otp.fn.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded" } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    let login: unknown;
    let signup: unknown;
    await act(async () => {
      login = await result.current.sendSignInCode("mia@example.com");
      signup = await result.current.sendEmailCode("mia@example.com");
    });
    expect(login).toEqual({ error: null, tooMany: true });
    expect(signup).toEqual({ error: null, tooMany: true });
  });

  it("hands the log in screen the status of a failed password log in, and nothing that says why", async () => {
    otp.password.mockResolvedValue({ error: { message: "Invalid login credentials", status: 400, code: "invalid_credentials" } });
    const { result } = renderHook(() => useAuth(), { wrapper });
    let answer: unknown;
    await act(async () => {
      answer = await result.current.signIn("mia@example.com", "wrong-password");
    });
    expect(answer).toEqual({ error: "Invalid login credentials", status: 400, code: "invalid_credentials" });
  });

  it("records that the account has a password when one is added", async () => {
    otp.update.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.updatePassword("a-long-password");
    });
    expect(otp.update).toHaveBeenCalledWith({ password: "a-long-password", data: { has_password: true } });
  });
});
