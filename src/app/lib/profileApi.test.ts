import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../lib/supabase", () => ({ supabase: { rpc } }));

import { fetchMoments } from "./profileApi";

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: { total: 0, items: [] }, error: null });
});

describe("fetchMoments", () => {
  it("passes the Pursuit to the database filter, so only that Pursuit's Moments come back", async () => {
    await fetchMoments("p1", 100, 0, "pursuit-9");
    expect(rpc).toHaveBeenCalledWith("get_profile_moments", { p_profile: "p1", p_limit: 100, p_offset: 0, p_pursuit: "pursuit-9" });
  });

  it("sends no filter (null) for the plain Moments tab", async () => {
    await fetchMoments("p1", 30, 60);
    expect(rpc).toHaveBeenCalledWith("get_profile_moments", { p_profile: "p1", p_limit: 30, p_offset: 60, p_pursuit: null });
  });
});
