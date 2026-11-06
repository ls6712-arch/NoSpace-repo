import { describe, expect, it } from "vitest";
import { BLANK_SLOT, SLOT_CITY, clockLabel, filterSlots, isFresh, slotProblem, slotWhen, toInput, toSlot, weekdayName, type StandingSlot } from "./standingSlots";

const DAY = 86_400_000;
const slot = (o: Partial<StandingSlot> = {}): StandingSlot => ({
  id: 1, cornerSlug: "trivia", title: "Pub trivia", placeName: "The Pub", area: "Greenpoint", city: "new-york-ny",
  weekday: 4, startTime: "19:00", endTime: null, tz: "America/New_York", spend: "free", mode: "do",
  sourceUrl: null, spaceId: null, active: true, lastVerifiedAt: new Date(0).toISOString(), ...o,
});

describe("standing slot wording", () => {
  it("names the weekday from 0 = Sunday", () => {
    expect([0, 1, 4, 6].map(weekdayName)).toEqual(["Sunday", "Monday", "Thursday", "Saturday"]);
  });

  it("writes a clock time and ignores seconds", () => {
    expect(clockLabel("19:00")).toBe("7:00 PM");
    expect(clockLabel("07:30:00")).toBe("7:30 AM");
    expect(clockLabel("25:00")).toBe("");
    expect(clockLabel("")).toBe("");
  });

  it("says when a slot happens", () => {
    expect(slotWhen({ weekday: 4, startTime: "19:00" })).toBe("Every Thursday, 7:00 PM");
  });
});

describe("staleness", () => {
  const now = 100 * DAY;
  it("is fresh through day 60 and stale after", () => {
    expect(isFresh(slot({ lastVerifiedAt: new Date(now - 60 * DAY).toISOString() }), now)).toBe(true);
    expect(isFresh(slot({ lastVerifiedAt: new Date(now - 61 * DAY).toISOString() }), now)).toBe(false);
  });
  it("uses the configured number of days", () => {
    expect(isFresh(slot({ lastVerifiedAt: new Date(now - 20 * DAY).toISOString() }), now, 14)).toBe(false);
  });
  it("is never fresh when turned off or the date is bad", () => {
    expect(isFresh(slot({ active: false, lastVerifiedAt: new Date(now).toISOString() }), now)).toBe(false);
    expect(isFresh(slot({ lastVerifiedAt: "nope" }), now)).toBe(false);
  });
});

describe("city key", () => {
  it("is a key from the fixed list, not the old new-york", () => {
    expect(SLOT_CITY).toBe("new-york-ny");
    expect(SLOT_CITY).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*-[a-z]{2}$/);
  });
});

describe("slotProblem", () => {
  const ok = { ...BLANK_SLOT, cornerSlug: "trivia", title: "Pub trivia", placeName: "The Pub", area: "Greenpoint" };
  it("accepts a complete slot", () => expect(slotProblem(ok)).toBeNull());
  it("asks for each missing part", () => {
    expect(slotProblem({ ...ok, cornerSlug: "" })).toMatch(/Corner/);
    expect(slotProblem({ ...ok, title: " " })).toMatch(/title/);
    expect(slotProblem({ ...ok, placeName: "" })).toMatch(/place/);
    expect(slotProblem({ ...ok, area: "" })).toMatch(/neighborhood/);
    expect(slotProblem({ ...ok, startTime: "" })).toMatch(/start time/);
  });
  it("rejects a bad day, end time and link", () => {
    expect(slotProblem({ ...ok, weekday: 7 })).toMatch(/day/);
    expect(slotProblem({ ...ok, endTime: "99:99" })).toMatch(/end time/);
    expect(slotProblem({ ...ok, sourceUrl: "http://x.com" })).toMatch(/https/);
    expect(slotProblem({ ...ok, sourceUrl: "https://x.com/a" })).toBeNull();
  });
});

describe("rows", () => {
  it("round-trips a database row through the form", () => {
    const s = toSlot({ id: 3, corner_slug: "climbing", title: "Open climb", place_name: "Gym", area: "Gowanus", city: "new-york-ny", weekday: 2, start_time: "18:30:00", end_time: "20:00:00", tz: "America/New_York", spend: "under25", mode: "do", source_url: null, space_id: null, active: true, last_verified_at: "2026-11-01T00:00:00Z" });
    expect(s.startTime).toBe("18:30");
    expect(toInput(s)).toMatchObject({ startTime: "18:30", endTime: "20:00", sourceUrl: "", spend: "under25" });
  });
  it("filters by Corner and by neighborhood text", () => {
    const list = [slot({ id: 1 }), slot({ id: 2, cornerSlug: "climbing", area: "Gowanus" })];
    expect(filterSlots(list, { corner: "climbing" }).map((s) => s.id)).toEqual([2]);
    expect(filterSlots(list, { area: "green" }).map((s) => s.id)).toEqual([1]);
    expect(filterSlots(list, {})).toHaveLength(2);
  });
});
