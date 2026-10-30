import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({ calls: [] as { fn: string; args: Record<string, unknown> }[], result: { data: [] as unknown, error: null as unknown } }));
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
      return Promise.resolve(rpc.result);
    },
  },
}));

import { suggestionLoggingEnabled } from "../config";
import { fetchHomeSuggestions, logSuggestionEvent, mapSuggestionRow, REASON_CODES } from "./homeSuggestions";

const row = {
  kind: "event",
  ref_id: "12",
  corner_key: "sports-fitness/climbing",
  starts_at: "2026-11-05T00:00:00+00:00",
  place_label: "Gowanus",
  score: 0.61,
  reasons: ["fits_window", "friend_going"],
  title: "Bouldering night",
  space_slug: "boulder-club",
  friend_name: "Priya",
  pass_kind: null,
};

beforeEach(() => {
  flag.on = true;
  rpc.calls = [];
  rpc.result = { data: [], error: null };
});

describe("home suggestions", () => {
  it("maps a row to a suggestion", () => {
    const s = mapSuggestionRow(row)!;
    expect(s).toMatchObject({ kind: "event", refId: "12", cornerKey: "sports-fitness/climbing", placeLabel: "Gowanus", title: "Bouldering night", spaceSlug: "boulder-club", friendName: "Priya", passKind: null });
    expect(s.startsAt).toBe(Date.parse("2026-11-05T00:00:00Z"));
    expect(s.reasons).toEqual(["fits_window", "friend_going"]);
  });

  it("drops unknown reason codes and keeps two at most", () => {
    const s = mapSuggestionRow({ ...row, reasons: ["price", "picked", "soon", "nearby"] })!;
    expect(s.reasons).toEqual(["picked", "soon"]);
  });

  it("shows a friend's name only when the reason is friend_going", () => {
    expect(mapSuggestionRow({ ...row, reasons: ["picked"] })!.friendName).toBeNull();
  });

  it("shows a pass kind only when the reason is pass, and only a known kind", () => {
    expect(mapSuggestionRow({ ...row, reasons: ["pass"], friend_name: null, pass_kind: "museum" })!.passKind).toBe("museum");
    expect(mapSuggestionRow({ ...row, reasons: ["pass"], pass_kind: "jetpack" })!.passKind).toBeNull();
    expect(mapSuggestionRow({ ...row, reasons: ["picked"], pass_kind: "museum" })!.passKind).toBeNull();
  });

  it("skips rows it cannot show", () => {
    expect(mapSuggestionRow({ ...row, kind: "friend_pursuit" })).toBeNull();
    expect(mapSuggestionRow({ ...row, title: "" })).toBeNull();
    expect(mapSuggestionRow({ ...row, starts_at: "soon" })).toBeNull();
    expect(mapSuggestionRow({ ...row, corner_key: null })).toBeNull();
  });

  it("lists the reason codes the database can return", () => {
    expect([...REASON_CODES].sort()).toEqual(["affinity", "fits_window", "friend_going", "nearby", "pass", "picked", "soon", "trending"]);
  });

  it("returns suggestions, and nothing when the call fails or is not deployed", async () => {
    rpc.result = { data: [row, { ...row, kind: "friend_pursuit" }], error: null };
    expect((await fetchHomeSuggestions(5)).map((s) => s.refId)).toEqual(["12"]);
    expect(rpc.calls[0]).toEqual({ fn: "home_suggestions", args: { p_limit: 5 } });
    rpc.result = { data: null, error: { code: "PGRST202", message: "no function" } };
    expect(await fetchHomeSuggestions()).toEqual([]);
  });

  it("logs with the position clamped and at most two reasons", async () => {
    await logSuggestionEvent({ kind: "at_home", refId: "x/y", cornerKey: "x/y", position: 250, reasons: ["picked", "soon", "pass"] as never, action: "shown" });
    expect(rpc.calls[0]).toEqual({
      fn: "log_suggestion_event",
      args: { p_kind: "at_home", p_ref_id: "x/y", p_corner_key: "x/y", p_position: 99, p_score: null, p_reasons: ["picked", "soon"], p_action: "shown" },
    });
  });

  it("does not log anything while the logging flag is off", async () => {
    flag.on = false;
    await logSuggestionEvent({ kind: "event", refId: "1", position: 0, action: "shown" });
    expect(rpc.calls).toEqual([]);
  });

  it("ships with the logging flag off", async () => {
    const real = await vi.importActual<typeof import("../config")>("../config");
    expect(real.suggestionLoggingEnabled).toBe(false);
    expect(typeof suggestionLoggingEnabled).toBe("boolean");
  });
});
