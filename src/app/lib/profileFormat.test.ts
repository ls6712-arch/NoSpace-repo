import { describe, expect, it } from "vitest";
import {
  availabilitySummary,
  budgetSummary,
  hoursSummary,
  ownerMomentMeta,
  pursuitStatus,
  sharedMomentMeta,
  slotDay,
  stubBlock,
  visibleAtLabel,
} from "./profileFormat";
import type { PursuitItem } from "./profileApi";

const NOW = new Date(2026, 9, 30, 12).getTime();
const pursuit = (over: Partial<PursuitItem>): PursuitItem => ({
  id: "p", category: "Climbing", goal: "Send my first V4", target: 5, momentCount: 2, stubCount: 2,
  finished: false, lastMomentDate: null, finishedAt: null, sharedWithYou: false, ...over,
});

describe("moment meta (date coarsening)", () => {
  it("shows the owner the date and time", () => {
    const m = { id: 1, photoUrl: null, caption: null, category: "Climbing", placeName: "Gym", neighborhood: null, visibleAt: null, occurredAt: new Date(2026, 9, 24, 19, 0).toISOString() };
    expect(ownerMomentMeta(m, NOW)).toBe("Oct 24 · 7:00 pm");
  });
  it("shows everyone else the day and neighborhood, with no time", () => {
    const m = { id: 1, photoUrl: null, caption: null, category: null, date: "2026-10-24", neighborhood: "Gowanus" };
    expect(sharedMomentMeta(m, NOW)).toBe("Oct 24 · Gowanus");
    expect(sharedMomentMeta({ ...m, neighborhood: null }, NOW)).toBe("Oct 24");
  });
  it("labels a Moment inside its delay", () => {
    expect(visibleAtLabel(new Date(2026, 9, 30, 19, 42).toISOString())).toBe("Visible to others at 7:42 pm");
  });
  it("splits a Stub into a month and a day", () => {
    expect(stubBlock({ date: null, day: "2026-10-24" })).toEqual({ month: "Oct", day: "24" });
  });
});

describe("pursuitStatus", () => {
  it("owner, active with a target", () => {
    const p = pursuit({ lastMomentDate: new Date(2026, 9, 24, 12).toISOString() });
    expect(pursuitStatus(p, "owner", NOW)).toBe("2 of 5 Moments · last Oct 24");
  });
  it("others see progress only", () => {
    expect(pursuitStatus(pursuit({}), "other", NOW)).toBe("2 of 5 Moments");
  });
  it("ongoing", () => {
    expect(pursuitStatus(pursuit({ target: null, momentCount: 1 }), "owner", NOW)).toBe("Ongoing · 1 Moment");
  });
  it("finished: full date for the owner, month only for others", () => {
    const p = pursuit({ finished: true, stubCount: 1, finishedAt: "2026-10-12" });
    expect(pursuitStatus(p, "owner", NOW)).toBe("Finished Oct 12 · 1 Stub");
    expect(pursuitStatus({ ...p, finishedAt: "2026-10" }, "other", NOW)).toBe("Finished in October");
  });
});

describe("planning summaries", () => {
  it("joins availability naturally and folds a full weekend", () => {
    expect(availabilitySummary([{ day: "thu", part: "evening" }, { day: "sat", part: "morning" }, { day: "sun", part: "morning" }])).toBe("Weekends · Thu evenings");
    expect(availabilitySummary([{ day: "mon", part: "morning" }, { day: "mon", part: "evening" }])).toBe("Mon mornings and evenings");
    expect(availabilitySummary([])).toBe("");
  });
  it("formats hours and budget", () => {
    expect(hoursSummary(9)).toBe("9 hrs a week");
    expect(hoursSummary(1)).toBe("1 hr a week");
    expect(budgetSummary(10000)).toBe("$100 a month");
    expect(budgetSummary(null)).toBe("");
  });
  it("formats a plan slot", () => {
    expect(slotDay({ date: "2026-11-07", part: "afternoon" }, NOW)).toBe("Sat, Nov 7");
  });
});

import { mutualFriendsLine } from "./profileFormat";
describe("mutualFriendsLine", () => {
  it("names one, two, or one plus a count", () => {
    expect(mutualFriendsLine(["Sam R."], 1)).toBe("Friends with Sam R.");
    expect(mutualFriendsLine(["Sam R.", "Jo K."], 2)).toBe("Friends with Sam R. and Jo K.");
    expect(mutualFriendsLine(["Sam R.", "Jo K."], 3)).toBe("Friends with Sam R. and 2 others you know");
    expect(mutualFriendsLine([], 0)).toBe("");
  });
});
