import { describe, expect, it } from "vitest";
import { CORNER_GUIDES } from "../data/cornerGuides";
import { atHomeItems, buildHomeItems, itemFromSuggestion } from "./homeItems";
import type { HomeSuggestion } from "./homeSuggestions";
import type { WeekWindow } from "./homeWeek";

const guideKeys = Object.entries(CORNER_GUIDES);
const homeKeys = guideKeys.filter(([, g]) => g.where !== "outdoors" && g.together !== "together" && !g.adultsOnly).map(([k]) => k);
const outdoorKey = guideKeys.find(([, g]) => g.where === "outdoors")![0];
const togetherKey = guideKeys.find(([, g]) => g.together === "together" && g.where !== "outdoors")![0];
const adultsKey = guideKeys.find(([, g]) => g.adultsOnly)?.[0];

const THU_EVE: WeekWindow = { key: "thu-eve", day: "thu", slot: "eve", offset: 0, startMs: Date.parse("2026-11-05T23:00:00Z"), endMs: Date.parse("2026-11-06T05:00:00Z") };

const suggestion = (over: Partial<HomeSuggestion> = {}): HomeSuggestion => ({
  kind: "event",
  refId: "7",
  cornerKey: homeKeys[0],
  startsAt: Date.parse("2026-11-06T00:00:00Z"),
  placeLabel: "Gowanus",
  score: 0.5,
  reasons: ["fits_window", "friend_going"],
  title: "Bouldering night",
  spaceSlug: "boulder-club",
  friendName: "Priya",
  passKind: null,
  ...over,
});

describe("Home items", () => {
  it("turns a ranked suggestion into a card: the day, time and place, and the why line", () => {
    const item = itemFromSuggestion(suggestion());
    expect(item).toMatchObject({ id: "event:7", kind: "event", title: "Bouldering night", detail: "Thu, 7:00 PM · Gowanus", why: "Fits your Thursday evening · Priya’s going", spaceSlug: "boulder-club" });
  });

  it("fills with the first step of the person's picks, in the order they picked", () => {
    const picks = homeKeys.slice(0, 3);
    const items = atHomeItems({ need: 2, exclude: new Set(), picks, affinity: null, windows: [] });
    expect(items.map((i) => i.corner.key)).toEqual(picks.slice(0, 2));
    expect(items[0]).toMatchObject({ kind: "at_home", reasons: ["picked"], why: "One of your picks" });
    expect(items[0].step).toBe(CORNER_GUIDES[picks[0]].step);
    expect(items[0].detail.startsWith("At home")).toBe(true);
  });

  it("says when a pick fits a free window", () => {
    const [item] = atHomeItems({ need: 1, exclude: new Set(), picks: [homeKeys[0]], affinity: null, windows: [THU_EVE] });
    expect(item.reasons).toEqual(["picked", "fits_window"]);
    expect(item.why).toBe("One of your picks · Fits your Thursday evening");
  });

  it("skips Corners that are outdoors, need other people or are adults only", () => {
    const picks = [outdoorKey, togetherKey, ...(adultsKey ? [adultsKey] : []), homeKeys[1]];
    const items = atHomeItems({ need: 4, exclude: new Set(), picks, affinity: null, windows: [] });
    const keys = items.map((i) => i.corner.key);
    expect(keys).not.toContain(outdoorKey);
    expect(keys).not.toContain(togetherKey);
    if (adultsKey) expect(keys).not.toContain(adultsKey);
    expect(keys[0]).toBe(homeKeys[1]);
  });

  it("falls back to the person's strongest Corners, then to curated ones, so the list is never empty", () => {
    const affinity = { corners: new Map([[homeKeys[2], { mine: 0.9, peers: 0, trending: 0 }]]), hobbies: new Map() };
    const [first] = atHomeItems({ need: 1, exclude: new Set(), picks: [], affinity, windows: [] });
    expect(first.corner.key).toBe(homeKeys[2]);
    expect(first).toMatchObject({ reasons: ["affinity"], why: "You might like this" });
    const none = atHomeItems({ need: 4, exclude: new Set(), picks: [], affinity: null, windows: [] });
    expect(none).toHaveLength(4);
  });

  it("never repeats a Corner already listed", () => {
    const items = buildHomeItems([suggestion({ cornerKey: homeKeys[0] })], { picks: [homeKeys[0], homeKeys[1]], affinity: null, windows: [] });
    const keys = items.map((i) => i.corner.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(items[0].kind).toBe("event");
  });

  it("adds at-home rows only up to 4 in all", () => {
    expect(buildHomeItems([], { picks: homeKeys.slice(0, 6), affinity: null, windows: [] })).toHaveLength(4);
    const five = Array.from({ length: 5 }, (_, i) => suggestion({ refId: String(i), cornerKey: homeKeys[i] }));
    expect(buildHomeItems(five, { picks: [], affinity: null, windows: [] })).toHaveLength(5);
    expect(buildHomeItems(five, { picks: [], affinity: null, windows: [] }).every((i) => i.kind === "event")).toBe(true);
  });

  it("shows no price and no count on a card", () => {
    const shown = buildHomeItems([suggestion()], { picks: homeKeys.slice(0, 3), affinity: null, windows: [THU_EVE] }).map((i) => `${i.title} ${i.detail} ${i.why ?? ""}`).join(" ");
    expect(shown).not.toMatch(/\$|\bfree\b/i);
  });
});
