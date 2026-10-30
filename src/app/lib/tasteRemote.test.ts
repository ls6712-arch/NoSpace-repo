// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const sb = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("../../lib/supabase", () => ({ supabase: sb }));

import { cleanPicks, fetchCornerActivity, fetchInviteCorner, savePasses } from "./tasteRemote";

beforeEach(() => {
  sb.rpc.mockReset();
  sb.from.mockReset();
});

describe("tasteRemote", () => {
  it("cleans picks: strings of space/slug only, each once", () => {
    expect(cleanPicks(["a/b", "a/b", "nope", 3, "x/y/z", "c/d"])).toEqual(["a/b", "c/d"]);
    expect(cleanPicks(null)).toEqual([]);
  });

  it("adds an event count and a Pursuit count per Corner", async () => {
    sb.rpc.mockResolvedValue({ data: [{ corner_key: "a/b", events: 2, pursuits: 1 }], error: null });
    const m = await fetchCornerActivity("Brooklyn");
    expect(sb.rpc).toHaveBeenCalledWith("corners_with_activity", { p_city: "Brooklyn", p_days: 14 });
    expect(m.get("a/b")).toBe(3);
  });

  it("asks nothing without a city, and shrugs off an error", async () => {
    expect((await fetchCornerActivity("  ")).size).toBe(0);
    expect(sb.rpc).not.toHaveBeenCalled();
    sb.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect((await fetchCornerActivity("Brooklyn")).size).toBe(0);
  });

  it("reads the friend's Corner from an invite, or null", async () => {
    sb.rpc.mockResolvedValue({ data: [{ hobby_slug: "sports-fitness", sub_hobby: "climbing" }], error: null });
    expect(await fetchInviteCorner("tok")).toMatch(/\/climbing$/);
    sb.rpc.mockResolvedValue({ data: [], error: null });
    expect(await fetchInviteCorner("tok")).toBeNull();
  });

  it("saves passes by id and removes the ones that are gone", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const inFn = vi.fn().mockResolvedValue({ error: null });
    const eq = vi.fn().mockReturnValue({ in: inFn });
    sb.from.mockReturnValue({ upsert, delete: () => ({ eq }) });
    const r = await savePasses("u1", [{ id: "p1", kind: "bike", label: "Bike", place: "  Citi  " }], ["p1", "p2"]);
    expect(r.error).toBeNull();
    expect(upsert.mock.calls[0][0][0]).toMatchObject({ id: "p1", user_id: "u1", place: "Citi" });
    expect(inFn).toHaveBeenCalledWith("id", ["p2"]);
  });
});
