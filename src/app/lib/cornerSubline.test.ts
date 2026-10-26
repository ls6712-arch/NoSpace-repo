import { describe, expect, it } from "vitest";
import { cornerSubline } from "./cornerSubline";
import { homeCornersIn } from "../data/homeCorners";
import type { CornerLive, LiveEvent, LiveSpace } from "./cornersLive";

const running = homeCornersIn("running-fitness").find((c) => c.slug === "running")!;
const padel = homeCornersIn("sports-martial-arts").find((c) => c.slug === "padel")!;
const space = { id: "s1" } as LiveSpace;
const soon = (hours: number): LiveEvent => ({ id: 1, spaceId: "s1", title: "t", startsAt: new Date(Date.now() + hours * 3_600_000).toISOString(), endsAt: null, timezone: "UTC", teaser: false });

describe("cornerSubline", () => {
  it("prefers events this week", () => {
    const live: CornerLive = { spaces: [space], events: [soon(5), soon(30)] };
    expect(cornerSubline(running, live)).toBe("2 events this week");
  });
  it("then Spaces", () => {
    expect(cornerSubline(running, { spaces: [space], events: [soon(24 * 20)] })).toBe("1 Space");
  });
  it("then how long and where, for a curated Corner", () => {
    expect(cornerSubline(running, { spaces: [], events: [] })).toBe("30 min · Outdoors");
    expect(cornerSubline(running, undefined)).toBe("30 min · Outdoors");
  });
  it("is empty for an uncurated Corner with no activity, never an invitation", () => {
    expect(cornerSubline(padel, { spaces: [], events: [] })).toBe("");
  });
});
