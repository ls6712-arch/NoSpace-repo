import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ tear: [] as unknown[][] }));
vi.mock("./firstPlanRemote", () => ({
  tearOffHalf: async (...args: unknown[]) => {
    calls.tear.push(args);
    return { half: { url: "https://x/#/join/t", title: "x", when: null, startsAt: null }, ownPursuitId: "p" };
  },
}));
vi.mock("./homeActions", () => ({ shareUrl: async () => ({ ok: true }) }));

import { bringSomeone, canBring } from "./weekActions";
import type { WeekPlanDetail } from "./weekView";

const owner = { id: "u1", username: "maya", displayName: "Maya" };
const listing: WeekPlanDetail = { id: "event-12", kind: "event", title: "Bouldering night", startsAt: Date.now(), color: "teal", cornerKey: "sports/climbing", going: { friends: [], total: 1 } };

describe("bringSomeone", () => {
  it("makes the plan for a listing a one-off plan, so it stays out of Your Pursuits", async () => {
    const r = await bringSomeone(listing, owner);
    expect(r.ok).toBe(true);
    expect(calls.tear[0][3]).toEqual({ asPlan: true });
    // A listing has no Pursuit of the person's own to reuse.
    expect(calls.tear[0][2]).toBeUndefined();
  });

  it("reuses the person's own Pursuit when the plan is one of its sessions", async () => {
    calls.tear.length = 0;
    await bringSomeone({ ...listing, id: "session-3", kind: "session", mine: true, pursuitId: "p9" }, owner);
    expect(calls.tear[0][2]).toBe("p9");
  });

  it("cannot bring someone to a plan with no Corner and no Pursuit of their own", async () => {
    const bare = { ...listing, cornerKey: undefined };
    expect(canBring(bare)).toBe(false);
    expect((await bringSomeone(bare, owner)).ok).toBe(false);
  });
});
