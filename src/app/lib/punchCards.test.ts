import { describe, expect, it } from "vitest";
import { afterLog, cornerKey, pursuitPunch, readyToFinish, regularPunch, type LogProgress, type PursuitCard } from "./punchCards";

const progress = (over: Partial<LogProgress> = {}): LogProgress => ({
  month: "2026-11-01",
  today: "2026-11-02",
  corners: [
    { key: "crafts-making/pottery", days: 3, today: false, kept: false },
    { key: "food-cooking/bread", days: 6, today: true, kept: false },
    { key: "sports-fitness/running", days: 10, today: false, kept: true },
  ],
  pursuits: [],
  ...over,
});

const pursuit = (over: Partial<PursuitCard> = {}): PursuitCard => ({
  id: "p1",
  owner: true,
  target: null,
  moments: 0,
  days: 0,
  today: false,
  ...over,
});

describe("cornerKey", () => {
  it("builds the key the database builds, lower case", () => {
    expect(cornerKey("Crafts-Making", "Pottery")).toBe("crafts-making/pottery");
  });
  it("is null without a Space or a Corner, so nothing is guessed", () => {
    expect(cornerKey(null, "pottery")).toBeNull();
    expect(cornerKey("crafts-making", "")).toBeNull();
    expect(cornerKey(undefined, undefined)).toBeNull();
  });
});

describe("regularPunch", () => {
  it("a photo on a new day punches the next hole", () => {
    expect(regularPunch(progress(), "crafts-making/pottery", true)).toEqual({ done: 3, total: 10, adds: true, after: 4 });
  });
  it("a text Moment never punches, as in private.moment_counts", () => {
    expect(regularPunch(progress(), "crafts-making/pottery", false)).toEqual({ done: 3, total: 10, adds: false, after: 3 });
  });
  it("a second photo the same day does not punch twice", () => {
    expect(regularPunch(progress(), "food-cooking/bread", true)).toEqual({ done: 6, total: 10, adds: false, after: 6 });
  });
  it("a Corner with nothing yet this month starts at 0", () => {
    expect(regularPunch(progress(), "art-creative/drawing", true)).toEqual({ done: 0, total: 10, adds: true, after: 1 });
  });
  it("shows no card once this month's Regular is kept, or with no Corner", () => {
    expect(regularPunch(progress(), "sports-fitness/running", true)).toBeNull();
    expect(regularPunch(progress(), null, true)).toBeNull();
  });
  it("works with no progress at all (signed out or offline)", () => {
    expect(regularPunch(null, "crafts-making/pottery", true)).toEqual({ done: 0, total: 10, adds: true, after: 1 });
  });
});

describe("pursuitPunch", () => {
  it("with no goal, counts your days toward 3", () => {
    expect(pursuitPunch(pursuit({ days: 2 }))).toEqual({ done: 2, total: 3, adds: true, after: 3 });
  });
  it("with no goal, a second Moment today adds nothing", () => {
    expect(pursuitPunch(pursuit({ days: 2, today: true }))).toEqual({ done: 2, total: 3, adds: false, after: 2 });
  });
  it("with a goal, counts every Moment in it, a text Moment too", () => {
    expect(pursuitPunch(pursuit({ target: 5, moments: 2, today: true }))).toEqual({ done: 2, total: 5, adds: true, after: 3 });
  });
  it("never goes past full", () => {
    expect(pursuitPunch(pursuit({ target: 4, moments: 6 }))).toEqual({ done: 4, total: 4, adds: false, after: 4 });
    expect(pursuitPunch(pursuit({ days: 5 }))).toEqual({ done: 3, total: 3, adds: false, after: 3 });
  });
  it("is null with no Pursuit", () => {
    expect(pursuitPunch(undefined)).toBeNull();
  });
});

describe("readyToFinish", () => {
  it("only a Pursuit with no goal and 3 days", () => {
    expect(readyToFinish(pursuit({ days: 3 }))).toBe(true);
    expect(readyToFinish(pursuit({ days: 2 }))).toBe(false);
    expect(readyToFinish(pursuit({ target: 3, days: 3 }))).toBe(false);
    expect(readyToFinish(undefined)).toBe(false);
  });
});

describe("afterLog", () => {
  it("adds the day and marks today, once", () => {
    const next = afterLog(progress(), { key: "crafts-making/pottery", hasMedia: true });
    expect(next.corners.find((c) => c.key === "crafts-making/pottery")).toEqual({ key: "crafts-making/pottery", days: 4, today: true, kept: false });
    const again = afterLog(next, { key: "crafts-making/pottery", hasMedia: true });
    expect(again.corners.find((c) => c.key === "crafts-making/pottery")?.days).toBe(4);
  });
  it("starts a card for a new Corner, and leaves text Moments out", () => {
    expect(afterLog(progress(), { key: "art-creative/drawing", hasMedia: true }).corners.at(-1)).toEqual({ key: "art-creative/drawing", days: 1, today: true, kept: false });
    expect(afterLog(progress(), { key: "art-creative/drawing", hasMedia: false }).corners).toHaveLength(3);
  });
  it("moves the Pursuit and does not change the input", () => {
    const before = progress({ pursuits: [pursuit({ days: 1, moments: 1 })] });
    const next = afterLog(before, { key: null, pursuitId: "p1", hasMedia: false });
    expect(next.pursuits[0]).toMatchObject({ moments: 2, days: 2, today: true });
    expect(before.pursuits[0]).toMatchObject({ moments: 1, days: 1, today: false });
  });
});
