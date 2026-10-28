import { describe, expect, it } from "vitest";
import { quietPursuits } from "./needsYou";
import type { Project } from "./journal";

const DAY = 86400000;
const now = Date.UTC(2026, 9, 28);
const proj = (id: string, startedAt: number, over: Partial<Project> = {}): Project => ({ id, title: `P ${id}`, startedAt, ...over }) as Project;

describe("quietPursuits", () => {
  it("lists an active Pursuit quiet for 5 weeks or more, in whole weeks", () => {
    const out = quietPursuits([proj("a", now - 40 * DAY)], () => [], now);
    expect(out).toEqual([{ id: "a", title: "P a", weeks: 5 }]);
  });
  it("uses the latest Moment, not the start", () => {
    expect(quietPursuits([proj("a", now - 90 * DAY)], () => [{ createdAt: now - 3 * DAY }], now)).toEqual([]);
  });
  it("leaves out a Pursuit quiet for less than 5 weeks, resting ones and finished ones", () => {
    const list = [proj("a", now - 34 * DAY), proj("b", now - 60 * DAY, { pausedAt: now - 50 * DAY }), proj("c", now - 60 * DAY, { finishedAt: now - 10 * DAY })];
    expect(quietPursuits(list, () => [], now)).toEqual([]);
  });
});
