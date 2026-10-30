// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const sb = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../lib/supabase", () => ({ supabase: sb }));

import { fetchSpacesWithMemberMoments, onlySpacesWithMemberMoments, resetSpacesWithMemberMomentsCache } from "./spaceMoments";

const spaces = [{ id: "a" }, { id: "b" }];

beforeEach(() => {
  sb.rpc.mockReset();
  resetSpacesWithMemberMomentsCache();
});

describe("when spaces_with_member_moments() does not exist", () => {
  it("shows every Space", async () => {
    sb.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Could not find the function" } });
    expect(await onlySpacesWithMemberMoments(spaces)).toEqual(spaces);
  });
  it("does not ask again once it knows", async () => {
    sb.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await onlySpacesWithMemberMoments(spaces);
    await onlySpacesWithMemberMoments(spaces);
    expect(sb.rpc).toHaveBeenCalledTimes(1);
  });
  it("shows every Space when the request fails or throws", async () => {
    sb.rpc.mockResolvedValueOnce({ data: null, error: { code: "500" } });
    expect(await onlySpacesWithMemberMoments(spaces)).toEqual(spaces);
    sb.rpc.mockRejectedValueOnce(new Error("offline"));
    expect(await onlySpacesWithMemberMoments(spaces)).toEqual(spaces);
  });
  it("still hides when a function that exists says so", async () => {
    sb.rpc.mockResolvedValue({ data: ["a"], error: null });
    expect(await fetchSpacesWithMemberMoments(["a", "b"])).toEqual(new Set(["a"]));
    expect(await onlySpacesWithMemberMoments(spaces)).toEqual([{ id: "a" }]);
  });
});
