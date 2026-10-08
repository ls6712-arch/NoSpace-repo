import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("../../lib/supabase", () => ({ supabase: { rpc } }));

const { fetchOwnPrivateProfile, resetOwnPrivateProfileCache, PUBLIC_PROFILE_COLUMNS } = await import("./ownProfile");

const ROW = {
  access: "active",
  invited_by: null,
  invite_allowance: 3,
  onboarding_completed: true,
  onboarding_completed_at: null,
  theme_preference: "system",
  is_admin: false,
  discoverable: true,
  show_this_corner: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  resetOwnPrivateProfileCache();
});

describe("owner-only profile columns", () => {
  it("reads them from my_profile_private() with no arguments", async () => {
    rpc.mockResolvedValue({ data: [ROW], error: null });
    expect(await fetchOwnPrivateProfile()).toEqual({ status: "ok", data: ROW });
    expect(rpc.mock.calls[0]).toEqual(["my_profile_private"]);
  });

  it("also accepts a single object", async () => {
    rpc.mockResolvedValue({ data: ROW, error: null });
    expect(await fetchOwnPrivateProfile()).toEqual({ status: "ok", data: ROW });
  });

  it("reports 'missing' before the migration, and asks only once", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect(await fetchOwnPrivateProfile()).toEqual({ status: "missing" });
    expect(await fetchOwnPrivateProfile()).toEqual({ status: "missing" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("does not treat a passing failure as 'missing'", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "500" } });
    expect(await fetchOwnPrivateProfile()).toEqual({ status: "error" });
    rpc.mockResolvedValueOnce({ data: [ROW], error: null });
    expect((await fetchOwnPrivateProfile()).status).toBe("ok");
  });

  it("an empty answer is an error, never an empty profile", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await fetchOwnPrivateProfile()).toEqual({ status: "error" });
  });

  it("the public column list holds none of the owner-only columns", () => {
    for (const col of Object.keys(ROW)) {
      expect(PUBLIC_PROFILE_COLUMNS.split(", ")).not.toContain(col);
    }
  });
});
