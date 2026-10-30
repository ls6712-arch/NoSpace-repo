import { describe, expect, it } from "vitest";
import { affordable, buildPlans, headlineFor, parsePrice, upcomingWindows, windowOfTime, type PlanInput } from "./firstPlan";

// Wednesday, Oct 28 2026, 10:00 local.
const NOW = new Date(2026, 9, 28, 10, 0, 0).getTime();
const at = (day: number, h: number) => new Date(2026, 9, day, h, 0, 0).getTime();
const pick = (spaceSlug: string, slug: string, name: string) => ({ key: `${spaceSlug}/${slug}`, name, spaceSlug, slug });
const CLIMB = pick("sports-fitness", "climbing", "Climbing");
const SOUR = pick("food-cooking", "sourdough", "Sourdough");
const COFFEE = pick("food-cooking", "home-coffee", "Home coffee");
const base: PlanInput = { now: NOW, picks: [CLIMB, SOUR], windows: ["thu-eve", "sat-day"], budget: 50, passes: [], events: [], pursuits: [] };

describe("windows", () => {
  it("turns free windows into real times, soonest first, never in the past", () => {
    const w = upcomingWindows(["thu-eve", "wed-day", "sat-day"], NOW);
    // Wed 2pm is 4 hours away: fine. Thursday 7pm, Saturday 2pm.
    expect(w.map((x) => x.key)).toEqual(["wed-day", "thu-eve", "sat-day"]);
    expect(new Date(w[1].startsAt).getHours()).toBe(19);
    // Too soon to get ready: Wednesday 2pm is under two hours from 12:30.
    expect(upcomingWindows(["wed-day"], new Date(2026, 9, 28, 12, 30).getTime())[0].startsAt).toBe(new Date(2026, 10, 4, 14).getTime());
  });
  it("places a time in a window by its own hour", () => {
    expect(windowOfTime(at(29, 19))).toBe("thu-eve");
    expect(windowOfTime(at(31, 9))).toBe("sat-day");
    expect(windowOfTime(at(31, 3))).toBeNull();
  });
});

describe("headline", () => {
  it("follows the time", () => {
    expect(headlineFor(at(28, 19), NOW)).toBe("Tonight’s yours.");
    expect(headlineFor(at(28, 15), NOW)).toBe("Today’s yours.");
    expect(headlineFor(at(29, 19), NOW)).toBe("Tomorrow’s yours.");
    expect(headlineFor(at(31, 14), NOW)).toBe("This weekend’s yours.");
    expect(headlineFor(at(30, 14), NOW)).toBe("Here’s one for this week.");
    expect(headlineFor(null, NOW)).toBe("Here’s one for this week.");
  });
});

describe("money", () => {
  it("reads a price from the host's words", () => {
    expect(parsePrice("Free")).toBe(0);
    expect(parsePrice("$12 at the door")).toBe(12);
    expect(parsePrice("pay what you can")).toBeNull();
    expect(parsePrice(null)).toBeNull();
  });
  it("a skipped or free-only budget allows only free things and what a pass covers", () => {
    expect(affordable(null, 0, false)).toBe(true);
    expect(affordable(null, null, false)).toBe(false);
    expect(affordable(0, 12, false)).toBe(false);
    expect(affordable(null, 30, true)).toBe(true);
  });
  it("a set budget allows an unknown price or one inside it", () => {
    expect(affordable(50, null, false)).toBe(true);
    expect(affordable(50, 30, false)).toBe(true);
    expect(affordable(50, 80, false)).toBe(false);
  });
});

describe("buildPlans", () => {
  const event = (eventId: number, startsAt: number, extra = {}) => ({ cornerKey: CLIMB.key, eventId, title: "Bouldering night", startsAt, place: "Williamsburg, New York", price: "Free", online: false, ...extra });

  it("offers a listing in a free window, with a reason that says only what matched", () => {
    const [p] = buildPlans({ ...base, events: [event(1, at(29, 19))] });
    expect(p.kind).toBe("event");
    expect(p.when).toBe("Thursday, 7:00 PM");
    expect(p.reason).toBe("You said Thursday evenings work, and you picked Climbing.");
    expect(p.cost).toBe("Free");
  });
  it("leaves out a listing outside every free window, past a week, or in an unpicked Corner", () => {
    const plans = buildPlans({ ...base, events: [event(1, at(29, 12)), event(2, at(29 + 7, 19)), event(3, at(29, 19), { cornerKey: "x/y" })] });
    expect(plans.some((p) => p.kind === "event")).toBe(false);
  });
  it("puts the next 72 hours before later this week, and a friend's Pursuit first of all", () => {
    const plans = buildPlans({
      ...base,
      windows: ["thu-eve", "sat-day"],
      events: [event(2, at(31, 14)), event(1, at(29, 19))],
      invite: { pursuitId: "p1", token: "tok", title: "Sunday run", hostName: "Priya Nair", startsAt: null },
    });
    expect(plans.map((p) => p.id).slice(0, 3)).toEqual(["invite:p1", "event:1", "event:2"]);
    expect(plans[0].reason).toBe("Priya is already in.");
  });
  it("names a pass instead of claiming it makes anything free", () => {
    const [p] = buildPlans({ ...base, budget: null, passes: [{ id: "a", kind: "climbing", label: "Climbing", place: "" }], events: [event(1, at(29, 19), { price: "$30" })] });
    expect(p.reason).toContain("You have a climbing pass.");
    expect(JSON.stringify(p)).not.toMatch(/\$0|with your pass/i);
  });
  it("with a skipped budget, drops a priced listing and one with no price", () => {
    const plans = buildPlans({ ...base, budget: null, events: [event(1, at(29, 19), { price: "$30" }), event(2, at(29, 20), { price: null })] });
    expect(plans.some((p) => p.kind === "event")).toBe(false);
  });
  it("finishes with at-home plans on real times from the free windows", () => {
    const plans = buildPlans({ ...base, picks: [SOUR, COFFEE], windows: ["sat-day", "thu-eve"] });
    const home = plans.filter((p) => p.kind === "at-home");
    expect(home.map((p) => p.title)).toEqual(["Sourdough at home", "Home coffee at home"]);
    expect(home[0].when).toBe("Thursday evening");
    expect(home[1].when).toBe("Saturday afternoon");
    expect(home[0].step).toBeTruthy();
  });
  it("with a skipped budget only offers things that need nothing bought; with no windows it is the next Saturday afternoon", () => {
    const plans = buildPlans({ ...base, budget: null, picks: [SOUR], windows: [] });
    expect(plans).toEqual([]);
    const free = buildPlans({ ...base, budget: null, picks: [pick("sports-fitness", "run-clubs", "Run clubs"), pick("food-cooking", "supper-clubs", "Supper clubs")], windows: [] });
    // Guides for these are outdoors or need other people, so they are not at-home plans.
    expect(free).toEqual([]);
    const home = buildPlans({ ...base, budget: 50, picks: [SOUR], windows: [] })[0];
    expect(home.when).toBe("Saturday afternoon");
    expect(home.reason).toBe("You picked Sourdough.");
  });
});
