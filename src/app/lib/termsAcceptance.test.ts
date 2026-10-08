import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const update = vi.fn();
const maybeSingle = vi.fn();
const from = vi.fn(() => ({
  select: () => ({ eq: () => ({ maybeSingle }) }),
  update,
}));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc, from } }));

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const {
  flushTermsAcceptance,
  needsTermsAcceptance,
  recordTermsAcceptance,
  rememberTermsAcceptance,
} = await import("./termsAcceptance");

const PENDING = "sushii-terms-accepted-pending";

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
});

describe("terms acceptance: the database stamps the time", () => {
  it("parks a plain flag, never a time", () => {
    rememberTermsAcceptance();
    expect(store.get(PENDING)).toBe("1");
  });

  it("calls accept_terms with no arguments, so no client time can reach the database", async () => {
    rpc.mockResolvedValue({ data: "2026-10-08T00:00:00Z", error: null });
    rememberTermsAcceptance();
    await flushTermsAcceptance();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]).toEqual(["accept_terms"]);
  });

  it("ignores a forged time left in storage", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    store.set(PENDING, "2000-01-01T00:00:00.000Z");
    await flushTermsAcceptance();
    // A value that isn't the plain flag is not a pending acceptance at all.
    expect(rpc).not.toHaveBeenCalled();

    store.set(PENDING, "1");
    await flushTermsAcceptance();
    expect(rpc.mock.calls[0]).toEqual(["accept_terms"]);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("2000");
  });

  it("never writes the column directly", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    rememberTermsAcceptance();
    await flushTermsAcceptance();
    await recordTermsAcceptance();
    expect(update).not.toHaveBeenCalled();
  });

  it("clears the pending flag once recorded, and keeps it on failure", async () => {
    rememberTermsAcceptance();
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    await flushTermsAcceptance();
    expect(store.get(PENDING)).toBe("1");
    rpc.mockResolvedValueOnce({ data: "t", error: null });
    await flushTermsAcceptance();
    expect(store.has(PENDING)).toBe(false);
  });

  it("does nothing when nothing is pending", async () => {
    await flushTermsAcceptance();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("recordTermsAcceptance: ok when recorded, ok before the function exists, error otherwise", async () => {
    rpc.mockResolvedValueOnce({ data: "t", error: null });
    expect(await recordTermsAcceptance()).toEqual({ error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await recordTermsAcceptance()).toEqual({ error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "28000" } });
    expect((await recordTermsAcceptance()).error).toBe("retry");
  });

  it("needsTermsAcceptance: true only for a profile with no recorded time", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { terms_accepted_at: null }, error: null });
    expect(await needsTermsAcceptance("u1")).toBe(true);
    maybeSingle.mockResolvedValueOnce({ data: { terms_accepted_at: "2026-01-01T00:00:00Z" }, error: null });
    expect(await needsTermsAcceptance("u1")).toBe(false);
    // Column not there yet (before the migration): nobody is blocked.
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "42703" } });
    expect(await needsTermsAcceptance("u1")).toBe(false);
  });
});
