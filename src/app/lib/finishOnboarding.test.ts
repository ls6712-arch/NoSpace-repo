import { describe, expect, it, vi } from "vitest";
import { finishOnboarding } from "./onboardingRemote";

const rpc = (r: { data: unknown; error: { code?: string } | null }) => ({ rpc: vi.fn(async () => r) });

describe("finishing onboarding goes through the database", () => {
  it("is finished when finish_onboarding says so, and never writes the flag itself", async () => {
    const fallback = vi.fn(async () => ({ error: null }));
    const client = rpc({ data: true, error: null });
    expect(await finishOnboarding(fallback, client)).toBe("ok");
    expect(client.rpc).toHaveBeenCalledWith("finish_onboarding");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("is refused without a birthdate, with no way around it from here", async () => {
    const fallback = vi.fn(async () => ({ error: null }));
    expect(await finishOnboarding(fallback, rpc({ data: false, error: null }))).toBe("refused");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("uses the old update only while the migration isn't live (function not found)", async () => {
    const fallback = vi.fn(async () => ({ error: null }));
    expect(await finishOnboarding(fallback, rpc({ data: null, error: { code: "PGRST202" } }))).toBe("ok");
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it("any other error is an error, not a fallback", async () => {
    const fallback = vi.fn(async () => ({ error: null }));
    expect(await finishOnboarding(fallback, rpc({ data: null, error: { code: "42501" } }))).toBe("error");
    expect(fallback).not.toHaveBeenCalled();
  });
});
