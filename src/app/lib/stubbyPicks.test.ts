import { describe, expect, it } from "vitest";
import { nyTimeToMs } from "./homeWeek";
import { NOT_THIS_MAX, nyWindowKey, stubbyPicks, type PickInput, type PickSlot } from "./stubbyPicks";

const ny = (m: number, d: number, h: number, min = 0) => nyTimeToMs(2026, m, d, h) + min * 60_000;
const NOW = ny(10, 31, 12);
const climbing = { key: "sports/climbing", name: "Climbing", spaceSlug: "sports", slug: "climbing" };
const pottery = { key: "crafts/pottery", name: "Pottery", spaceSlug: "crafts", slug: "pottery" };
const tueEve: PickSlot = { key: "2026-11-03:tue-eve", startMs: ny(11, 3, 18), endMs: ny(11, 4, 0) };
const event = (id: number, over: Partial<PickInput["events"][number]> = {}): PickInput["events"][number] => ({
  cornerKey: climbing.key, eventId: id, title: `Climbing ${id}`, startsAt: ny(11, 3, 19), endsAt: ny(11, 3, 21), place: "Gowanus, Brooklyn", price: "$25", online: false, ...over,
});
const input = (over: Partial<PickInput> = {}): PickInput => ({
  now: NOW, slots: [tueEve], picks: [climbing, pottery], events: [], pursuits: [], windows: ["tue-eve"], budget: 50, passes: [], area: "", declined: {}, taken: new Set(), ...over,
});

describe("stubbyPicks", () => {
  it("picks nothing when nothing fits: empty beats filler", () => {
    expect(stubbyPicks(input()).size).toBe(0);
    expect(stubbyPicks(input({ events: [event(1, { cornerKey: "music/jazz" })] })).size).toBe(0);
  });

  it("picks a thing in a picked Corner that falls inside the stretch, with a reason that is true", () => {
    const got = stubbyPicks(input({ events: [event(1)] })).get(tueEve.key)!;
    expect(got.id).toBe("event:1");
    expect(got.corner.name).toBe("Climbing");
    expect(got.reason).toBe("You said Tuesday evenings work, and you picked Climbing.");
    expect(got.cost).toBe("$25");
  });

  it("does not claim the usual week when the time is not in it", () => {
    const got = stubbyPicks(input({ windows: [], events: [event(1)] })).get(tueEve.key)!;
    expect(got.reason).toBe("You picked Climbing.");
  });

  it("names a pass only when the person has one for that Corner", () => {
    const got = stubbyPicks(input({ events: [event(1)], passes: [{ id: "p", kind: "climbing", label: "Climbing", place: "" }] })).get(tueEve.key)!;
    expect(got.reason).toContain("You have a climbing pass.");
    expect(got.cost).toBe("your climbing pass");
  });

  it("never picks a thing longer than the stretch, or one that starts before it or ends after it", () => {
    const short: PickSlot = { key: "2026-11-03:tue-eve", startMs: ny(11, 3, 18), endMs: ny(11, 3, 19, 30) };
    // 7 to 9 PM does not fit a stretch that ends at 7:30.
    expect(stubbyPicks(input({ slots: [short], events: [event(1)] })).size).toBe(0);
    // A thing with no end blocks 2 hours: 7 to 9 PM does not fit 7 to 8.
    const hour: PickSlot = { key: "k", startMs: ny(11, 3, 19), endMs: ny(11, 3, 20) };
    expect(stubbyPicks(input({ slots: [hour], events: [event(1, { endsAt: null })] })).size).toBe(0);
    // It fits exactly when the stretch is as long as the thing.
    const exact: PickSlot = { key: "k", startMs: ny(11, 3, 19), endMs: ny(11, 3, 21) };
    expect(stubbyPicks(input({ slots: [exact], events: [event(1)] })).get("k")?.id).toBe("event:1");
    // Starts before the stretch.
    expect(stubbyPicks(input({ slots: [{ key: "k", startMs: ny(11, 3, 19, 30), endMs: ny(11, 4, 0) }], events: [event(1)] })).size).toBe(0);
  });

  it("honours the budget: free only, a skipped budget and a pass", () => {
    expect(stubbyPicks(input({ budget: 0, events: [event(1)] })).size).toBe(0);
    expect(stubbyPicks(input({ budget: null, events: [event(1)] })).size).toBe(0);
    expect(stubbyPicks(input({ budget: 0, events: [event(1, { price: "Free" })] })).size).toBe(1);
    expect(stubbyPicks(input({ budget: 0, events: [event(1)], passes: [{ id: "p", kind: "climbing", label: "Climbing", place: "" }] })).size).toBe(1);
    expect(stubbyPicks(input({ budget: 20, events: [event(1)] })).size).toBe(0);
  });

  it("leaves out a thing that starts within 2 hours, one past the week, and one already on the calendar", () => {
    const soon: PickSlot = { key: "s", startMs: NOW, endMs: NOW + 5 * 3_600_000 };
    expect(stubbyPicks(input({ slots: [soon], events: [event(1, { startsAt: NOW + 3_600_000, endsAt: NOW + 2 * 3_600_000 })] })).size).toBe(0);
    const far: PickSlot = { key: "f", startMs: ny(11, 10, 18), endMs: ny(11, 11, 0) };
    expect(stubbyPicks(input({ slots: [far], events: [event(1, { startsAt: ny(11, 10, 19), endsAt: ny(11, 10, 21) })] })).size).toBe(0);
    expect(stubbyPicks(input({ events: [event(1)], taken: new Set(["event:1"]) })).size).toBe(0);
  });

  it("looks only at the next 7 days for stretches", () => {
    const later: PickSlot = { key: "later", startMs: NOW + 8 * 86_400_000, endMs: NOW + 8 * 86_400_000 + 6 * 3_600_000 };
    expect(stubbyPicks(input({ slots: [later], events: [event(1, { startsAt: later.startMs + 3_600_000, endsAt: later.startMs + 3 * 3_600_000 })] })).size).toBe(0);
  });

  it("picks at most one thing per stretch, and one thing only once", () => {
    const wed: PickSlot = { key: "2026-11-04:wed-eve", startMs: ny(11, 4, 18), endMs: ny(11, 5, 0) };
    const events = [event(1), event(2, { startsAt: ny(11, 3, 21), endsAt: ny(11, 3, 23) }), event(3, { startsAt: ny(11, 4, 19), endsAt: ny(11, 4, 21) })];
    const got = stubbyPicks(input({ slots: [wed, tueEve], events }));
    expect(got.get(tueEve.key)?.id).toBe("event:1");
    expect(got.get(wed.key)?.id).toBe("event:3");
    expect(got.size).toBe(2);
    expect(stubbyPicks(input({ slots: [tueEve, { ...wed, key: "other" }], events: [event(1)] })).size).toBe(1);
  });

  it("prefers a place in the person's area, then the soonest", () => {
    const events = [event(1, { place: "Harlem", startsAt: ny(11, 3, 18, 30), endsAt: ny(11, 3, 20) }), event(2, { place: "Gowanus, Brooklyn" })];
    expect(stubbyPicks(input({ events })).get(tueEve.key)?.id).toBe("event:1");
    expect(stubbyPicks(input({ events, area: "gowanus" })).get(tueEve.key)?.id).toBe("event:2");
    // The area never rules a thing out ("in or near").
    expect(stubbyPicks(input({ events: [event(3, { place: "Harlem" })], area: "gowanus" })).get(tueEve.key)?.id).toBe("event:3");
  });

  it("swaps in the next match after Not this, and never offers that thing in another stretch", () => {
    const events = [event(1), event(2, { startsAt: ny(11, 3, 20), endsAt: ny(11, 3, 22) })];
    expect(stubbyPicks(input({ events, declined: { [tueEve.key]: ["event:1"] } })).get(tueEve.key)?.id).toBe("event:2");
    const wed: PickSlot = { key: "w", startMs: ny(11, 3, 18), endMs: ny(11, 4, 0) };
    expect(stubbyPicks(input({ slots: [wed], events: [event(1)], declined: { [tueEve.key]: ["event:1"] } })).size).toBe(0);
  });

  it("goes back to nothing after three Not this on a stretch", () => {
    const events = [1, 2, 3, 4].map((n) => event(n, { startsAt: ny(11, 3, 18 + (n % 2)), endsAt: ny(11, 3, 20 + (n % 2)) }));
    const three = ["event:1", "event:2", "event:3"];
    expect(three).toHaveLength(NOT_THIS_MAX);
    expect(stubbyPicks(input({ events, declined: { [tueEve.key]: three.slice(0, 2) } })).get(tueEve.key)?.id).toBe("event:4");
    expect(stubbyPicks(input({ events, declined: { [tueEve.key]: three } })).size).toBe(0);
  });

  it("picks an open Pursuit's session, with 2 hours blocked out", () => {
    const got = stubbyPicks(input({ pursuits: [{ cornerKey: pottery.key, pursuitId: "p9", title: "Pasta from scratch", startsAt: ny(11, 3, 19), hostName: "Priya Shah" }] })).get(tueEve.key)!;
    expect(got).toMatchObject({ id: "pursuit:p9", kind: "open-pursuit", hostName: "Priya", pursuitId: "p9", endsAt: ny(11, 3, 21) });
  });

  it("carries whether the host must approve, so the button can say Ask to join", () => {
    const pursuit = (needsApproval?: boolean) => ({ cornerKey: pottery.key, pursuitId: "p9", title: "Pasta", startsAt: ny(11, 3, 19), hostName: "Priya", needsApproval });
    expect(stubbyPicks(input({ pursuits: [pursuit(true)] })).get(tueEve.key)?.needsApproval).toBe(true);
    expect(stubbyPicks(input({ pursuits: [pursuit()] })).get(tueEve.key)?.needsApproval).toBeUndefined();
    expect(stubbyPicks(input({ events: [event(1)] })).get(tueEve.key)?.needsApproval).toBeUndefined();
  });

  it("reads windows in New York time", () => {
    expect(nyWindowKey(ny(11, 3, 19))).toBe("tue-eve");
    expect(nyWindowKey(ny(11, 3, 5))).toBeNull();
    expect(nyWindowKey(ny(11, 3, 6))).toBe("tue-day");
  });
});
