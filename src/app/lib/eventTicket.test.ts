import { describe, expect, it } from "vitest";
import { eventPlace, nextEventTicket } from "./eventTicket";
import type { CornerLive, LiveEvent, LiveSpace } from "./cornersLive";

const NOW = Date.UTC(2026, 9, 27, 12);
const h = (n: number) => new Date(NOW + n * 3_600_000).toISOString();
const space = (id: string, access: "open" | "closed"): LiveSpace => ({
  id, slug: id, name: id, cover_image: "x", access, created_by: null, city: null, neighborhood: null,
});
const ev = (id: number, spaceId: string, hours: number, teaser = false): LiveEvent => ({
  id, spaceId, title: `e${id}`, startsAt: h(hours), endsAt: null, timezone: "UTC", meets: "in_person", neighborhood: null, city: null, teaser,
});

describe("nextEventTicket", () => {
  it("is null with nothing live or no events", () => {
    expect(nextEventTicket(undefined, NOW)).toBeNull();
    expect(nextEventTicket({ spaces: [space("a", "open")], events: [] }, NOW)).toBeNull();
  });
  it("takes the soonest upcoming event across Open Spaces", () => {
    const live: CornerLive = { spaces: [space("a", "open"), space("b", "open")], events: [ev(1, "a", 30), ev(2, "b", 5), ev(3, "a", 9)] };
    expect(nextEventTicket(live, NOW)?.event.id).toBe(2);
    expect(nextEventTicket(live, NOW)?.space.id).toBe("b");
  });
  it("never uses a Closed Space, a teaser or an event that has started", () => {
    const live: CornerLive = { spaces: [space("a", "open"), space("c", "closed")], events: [ev(1, "c", 2), ev(2, "a", 3, true), ev(3, "a", -1)] };
    expect(nextEventTicket(live, NOW)).toBeNull();
  });
  it("breaks a tie on the lower id", () => {
    const live: CornerLive = { spaces: [space("a", "open")], events: [ev(7, "a", 4), ev(5, "a", 4)] };
    expect(nextEventTicket(live, NOW)?.event.id).toBe(5);
  });
});

describe("eventPlace", () => {
  it("joins neighborhood and city", () => {
    expect(eventPlace({ meets: "in_person", neighborhood: "Riverside", city: "Portland" })).toBe("Riverside, Portland");
    expect(eventPlace({ meets: "in_person", neighborhood: null, city: "Portland" })).toBe("Portland");
  });
  it("says Online for an online-only event with no place", () => {
    expect(eventPlace({ meets: "online", neighborhood: null, city: null })).toBe("Online");
    expect(eventPlace({ meets: "both", neighborhood: null, city: null })).toBe("");
  });
});
