import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const maybeSingle = vi.fn();
const eqCalls: Array<[string, unknown]> = [];
const query = {
  eq: (col: string, val: unknown) => {
    eqCalls.push([col, val]);
    return query;
  },
  maybeSingle,
};
const from = vi.fn((_table: string) => ({ select: () => query, insert, update }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc, from } }));

const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { TERMS_VERSION } = await import("../config");
const {
  flushTermsAcceptance,
  needsTermsAcceptance,
  recordTermsAcceptance,
  rememberTermsAcceptance,
} = await import("./termsAcceptance");

const PENDING = "sushii-terms-accepted-pending";

beforeEach(() => {
  vi.clearAllMocks();
  eqCalls.length = 0;
  store.clear();
});

describe("TERMS_VERSION", () => {
  it("is a real date that has started, which is all the database accepts", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const asDate = new Date(`${TERMS_VERSION}T00:00:00Z`);
    expect(Number.isNaN(asDate.getTime())).toBe(false);
    expect(asDate.getTime()).toBeLessThanOrEqual(Date.now() + 36 * 3600 * 1000);
  });
});

describe("terms acceptance: the database stamps the time", () => {
  it("parks the version being accepted, never a time", () => {
    rememberTermsAcceptance();
    expect(store.get(PENDING)).toBe(TERMS_VERSION);
  });

  it("calls accept_terms with the version as its only argument, so no client time can reach the database", async () => {
    rpc.mockResolvedValue({ data: "2026-10-08T00:00:00Z", error: null });
    rememberTermsAcceptance();
    await flushTermsAcceptance();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]).toEqual(["accept_terms", { p_version: TERMS_VERSION }]);
    expect(Object.keys(rpc.mock.calls[0][1])).toEqual(["p_version"]);
  });

  it("ignores a forged time left in storage, and an older version", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    store.set(PENDING, "2000-01-01T00:00:00.000Z");
    await flushTermsAcceptance();
    // Not the current version: dropped, the person is asked again instead.
    expect(rpc).not.toHaveBeenCalled();
    expect(store.has(PENDING)).toBe(false);

    store.set(PENDING, TERMS_VERSION);
    await flushTermsAcceptance();
    expect(rpc.mock.calls[0]).toEqual(["accept_terms", { p_version: TERMS_VERSION }]);
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("2000");
  });

  it("never writes the table directly", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    rememberTermsAcceptance();
    await flushTermsAcceptance();
    await recordTermsAcceptance();
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("clears the pending flag once recorded, and keeps it on failure", async () => {
    rememberTermsAcceptance();
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    await flushTermsAcceptance();
    expect(store.get(PENDING)).toBe(TERMS_VERSION);
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
    expect(rpc.mock.calls[0]).toEqual(["accept_terms", { p_version: TERMS_VERSION }]);
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    expect(await recordTermsAcceptance()).toEqual({ error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "22023" } });
    expect((await recordTermsAcceptance()).error).toBe("retry");
  });
});

describe("terms acceptance: once per version", () => {
  it("asks only about the current version in the person's own table", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await needsTermsAcceptance("u1");
    expect(from).toHaveBeenCalledWith("terms_acceptances");
    expect(eqCalls).toEqual([
      ["user_id", "u1"],
      ["terms_version", TERMS_VERSION],
    ]);
  });

  it("needs acceptance only when there is no record of this version", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await needsTermsAcceptance("u1")).toBe(true);
    maybeSingle.mockResolvedValueOnce({ data: { terms_version: TERMS_VERSION }, error: null });
    expect(await needsTermsAcceptance("u1")).toBe(false);
  });

  it("a new version means a person who accepted the old one is asked again", async () => {
    // The table only holds an older version, so the query for the current one finds nothing.
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await needsTermsAcceptance("u1")).toBe(true);
  });

  it("blocks nobody before the table exists", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "PGRST205" } });
    expect(await needsTermsAcceptance("u1")).toBe(false);
    maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "42P01" } });
    expect(await needsTermsAcceptance("u1")).toBe(false);
  });
});
