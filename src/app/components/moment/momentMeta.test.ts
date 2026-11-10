import { describe, expect, it } from "vitest";
import { isOwnMoment, isUpcomingSession, momentCorner, momentPlace, momentWhen } from "./momentMeta";
import { formatDateTime, formatWhen } from "../../lib/dates";

const NOW = Date.parse("2026-11-10T15:00:00Z");

describe("a Moment's meta line", () => {
  it("names the Corner by its own name and links to the Corner page", () => {
    expect(momentCorner({ hobbySlug: "food-cooking", corner: "pottery" })).toEqual({ name: "Pottery", to: "/corners/pottery" });
  });

  it("falls back to the older sub-hobby field, and has no Corner part without either", () => {
    expect(momentCorner({ hobbySlug: "x", subHobby: "pottery" })?.to).toBe("/corners/pottery");
    // Never the group's name.
    expect(momentCorner({ hobbySlug: "food-cooking" })).toBeNull();
  });

  it("shows the place the maker chose, else their city", () => {
    expect(momentPlace({ locationName: "12 Main St, Park Slope, Brooklyn", locationPrivacy: "city", city: "New York" })).toBe("Brooklyn");
    expect(momentPlace({ city: "Brooklyn" })).toBe("Brooklyn");
    expect(momentPlace({ locationName: "Home", locationPrivacy: "hidden" })).toBeUndefined();
  });

  it("uses the short form from dates.ts for when", () => {
    const createdAt = NOW - 3 * 60 * 60 * 1000;
    expect(momentWhen({ createdAt }, NOW)).toBe(formatWhen(createdAt, { now: NOW }));
    expect(momentWhen({ createdAt }, NOW)).toBe("3h");
  });

  it("shows a session's own day and time until it has happened", () => {
    const startsAt = NOW + 4 * 24 * 60 * 60 * 1000;
    const post = { createdAt: NOW - 1000, startsAt };
    expect(isUpcomingSession(post, NOW)).toBe(true);
    expect(momentWhen(post, NOW)).toBe(formatDateTime(startsAt, { now: NOW }));
    // Once it has happened it reads like any other Moment.
    expect(momentWhen({ createdAt: NOW - 60_000, startsAt: NOW - 1000 }, NOW)).toBe("1m");
  });

  it("knows your own Moment, and that a private-log stand-in is always yours", () => {
    expect(isOwnMoment({ userId: "me" }, "me")).toBe(true);
    expect(isOwnMoment({ userId: "them" }, "me")).toBe(false);
    expect(isOwnMoment({ userId: "them" }, undefined)).toBe(false);
    expect(isOwnMoment({ isPrivateLog: true }, undefined)).toBe(true);
  });
});
