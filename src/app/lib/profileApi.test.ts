import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../lib/supabase", () => ({ supabase: { rpc } }));

import { fetchMoments, fetchPursuits } from "./profileApi";

beforeEach(() => {
  rpc
    .mockReset()
    .mockResolvedValue({ data: { total: 0, items: [] }, error: null });
});

describe("fetchMoments", () => {
  it("passes the Pursuit to the database filter, so only that Pursuit's Moments come back", async () => {
    await fetchMoments("p1", 100, 0, "pursuit-9");
    expect(rpc).toHaveBeenCalledWith("get_profile_moments", {
      p_profile: "p1",
      p_limit: 100,
      p_offset: 0,
      p_pursuit: "pursuit-9",
    });
  });

  it("sends no filter (null) for the plain Moments tab", async () => {
    await fetchMoments("p1", 30, 60);
    expect(rpc).toHaveBeenCalledWith("get_profile_moments", {
      p_profile: "p1",
      p_limit: 30,
      p_offset: 60,
      p_pursuit: null,
    });
  });
});

describe("compatible Pursuit profile reader", () => {
  it("falls back only while the new reader is not installed", async () => {
    rpc
      .mockResolvedValueOnce({
        error: { code: "PGRST202", message: "Missing function" },
        data: null,
      })
      .mockResolvedValueOnce({ error: null, data: [] });
    expect(await fetchPursuits("p1")).toEqual({ ok: true, value: [] });
    expect(rpc.mock.calls.map((c) => c[0])).toEqual([
      "get_compatible_profile_pursuits",
      "get_profile_pursuits",
    ]);
  });
  it("does not hide permission failures behind the original reader", async () => {
    rpc.mockResolvedValueOnce({
      error: { code: "42501", message: "Not allowed" },
      data: null,
    });
    expect(await fetchPursuits("p1")).toEqual({
      ok: false,
      message: "Not allowed",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("returns the enriched owner rows without another request", async () => {
    const value = [
      { id: "p", workflow: { current: 4, target: 10, unit: "paintings" } },
    ];
    rpc.mockResolvedValueOnce({ error: null, data: value });
    expect(await fetchPursuits("p1")).toEqual({ ok: true, value });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
