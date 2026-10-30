import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({ calls: [] as { fn: string; args: Record<string, unknown> }[], result: { data: [] as unknown, error: null as unknown }, throws: false }));
const flag = vi.hoisted(() => ({ on: true }));
vi.mock("../config", async (orig) => ({
  ...(await orig<typeof import("../config")>()),
  get suggestionLoggingEnabled() {
    return flag.on;
  },
}));
vi.mock("../../lib/supabase", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpc.calls.push({ fn, args });
      if (rpc.throws) return Promise.reject(new Error("offline"));
      return Promise.resolve(rpc.result);
    },
  },
}));

import {
  fetchDiscoverCorners,
  fetchDiscoverMoments,
  fetchDiscoverSpaces,
  logDiscoverEvent,
  mapCornerRow,
  mapMomentRow,
  mapSpaceRow,
} from "./discover";

beforeEach(() => {
  rpc.calls = [];
  rpc.result = { data: [], error: null };
  rpc.throws = false;
  flag.on = true;
});

describe("mapMomentRow", () => {
  it("maps a row", () => {
    expect(mapMomentRow({ post_id: 7, author_id: "u1", created_at: "2026-11-01T10:00:00+00:00", corner_key: "crafts-making/pottery" })).toEqual({
      postId: 7, authorId: "u1", createdAt: "2026-11-01T10:00:00+00:00", cornerKey: "crafts-making/pottery",
    });
  });
  it("drops a row it cannot show", () => {
    expect(mapMomentRow({ post_id: "x", author_id: "u1", created_at: "2026-11-01T10:00:00+00:00" })).toBeNull();
    expect(mapMomentRow({ post_id: 1, author_id: "", created_at: "2026-11-01T10:00:00+00:00" })).toBeNull();
    expect(mapMomentRow({ post_id: 1, author_id: "u1", created_at: "nope" })).toBeNull();
  });
});

describe("mapCornerRow", () => {
  it("maps the three ways in", () => {
    expect(mapCornerRow({ corner_key: "a/b", has_home: true, has_group: false, has_place: true })).toEqual({ cornerKey: "a/b", hasHome: true, hasGroup: false, hasPlace: true });
  });
  it("treats anything but true as false and drops keys with no Space", () => {
    expect(mapCornerRow({ corner_key: "a/b", has_home: "yes" })?.hasHome).toBe(false);
    expect(mapCornerRow({ corner_key: "ab" })).toBeNull();
  });
});

describe("mapSpaceRow", () => {
  const base = { space_id: "s1", slug: "clay", name: "Clay studio", access: "open", moments_this_month: 4 };
  it("maps a Space with its next event", () => {
    const s = mapSpaceRow({ ...base, corner_key: "crafts-making/pottery", neighborhood: "Gowanus", next_event_title: "Open night", next_event_at: "2026-11-05T00:00:00+00:00" });
    expect(s).toMatchObject({ id: "s1", access: "open", momentsThisMonth: 4, neighborhood: "Gowanus", nextEvent: { title: "Open night" } });
    expect(s?.nextEvent?.startsAt).toBe(Date.parse("2026-11-05T00:00:00+00:00"));
  });
  it("has no next event unless it has both a title and a time", () => {
    expect(mapSpaceRow({ ...base, next_event_title: "Open night" })?.nextEvent).toBeNull();
  });
  it("never reads a member count and floors odd counts to zero", () => {
    const s = mapSpaceRow({ ...base, moments_this_month: -3, member_count: 40 } as Parameters<typeof mapSpaceRow>[0]);
    expect(s?.momentsThisMonth).toBe(0);
    expect(Object.keys(s ?? {})).not.toContain("memberCount");
  });
  it("drops a Space with an unknown access", () => {
    expect(mapSpaceRow({ ...base, access: "secret" })).toBeNull();
  });
});

describe("fetchers", () => {
  it("pass their arguments through", async () => {
    await fetchDiscoverMoments({ corner: "a/b", cursor: "2026-11-01T10:00:00+00:00", limit: 5 });
    await fetchDiscoverCorners(3, ["a/b"]);
    await fetchDiscoverSpaces(4);
    expect(rpc.calls).toEqual([
      { fn: "discover_moments", args: { p_corner: "a/b", p_cursor: "2026-11-01T10:00:00+00:00", p_limit: 5 } },
      { fn: "discover_corners", args: { p_limit: 3, p_candidates: ["a/b"] } },
      { fn: "discover_spaces", args: { p_limit: 4 } },
    ]);
  });
  it("give an empty list on an error, a bad shape or a throw", async () => {
    rpc.result = { data: null, error: { message: "no function" } };
    expect(await fetchDiscoverMoments()).toEqual([]);
    rpc.result = { data: { not: "an array" }, error: null };
    expect(await fetchDiscoverCorners()).toEqual([]);
    rpc.throws = true;
    expect(await fetchDiscoverSpaces()).toEqual([]);
  });
});

describe("logDiscoverEvent", () => {
  it("logs with a clamped position", async () => {
    await logDiscoverEvent({ kind: "corner", refId: "a/b", cornerKey: "a/b", position: 250, action: "followed" });
    expect(rpc.calls[0]).toEqual({ fn: "log_discover_event", args: { p_kind: "corner", p_ref_id: "a/b", p_corner_key: "a/b", p_position: 99, p_action: "followed" } });
  });
  it("does nothing while logging is off", async () => {
    flag.on = false;
    await logDiscoverEvent({ kind: "idea", refId: "a/b", position: 0, action: "shown" });
    expect(rpc.calls).toEqual([]);
  });
  it("swallows a failure", async () => {
    rpc.throws = true;
    await expect(logDiscoverEvent({ kind: "idea", refId: "a/b", position: 0, action: "shown" })).resolves.toBeUndefined();
  });
});
