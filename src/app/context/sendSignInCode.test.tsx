// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const otp = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("../../lib/supabase", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signInWithOtp: otp.fn,
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

  it("still reports a real failure, such as the rate limit", async () => {
    otp.fn.mockResolvedValue({ error: { status: 429, code: "over_email_send_rate_limit", message: "email rate limit exceeded", name: "AuthApiError" } });
    const limited = await timed("mia@example.com");
    expect(limited.answer?.error).toBeTruthy();
  });
});
