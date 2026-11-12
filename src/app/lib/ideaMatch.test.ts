import { activityCost } from "./activityFit";
import { describe, expect, it } from "vitest";
import { CORNER_IDEAS } from "../data/cornerIdeas";
import { fitsPills, ideasFor, MAX_PER_CATEGORY, ROW_SIZE, SPEND_ORDER, TIME_ORDER, type IdeaPills } from "./ideaMatch";

const WHOS = ["solo", "friend", "new"] as const;

describe("idea pills are ceilings", () => {
  const combos: IdeaPills[] = TIME_ORDER.flatMap((time) => SPEND_ORDER.flatMap((spend) => WHOS.map((who) => ({ time, spend, who }))));

  it("keeps category caps without filling constrained rows with unknown cost", () => {
    expect(combos).toHaveLength(27);
    for (const pills of combos) {
      const row=ideasFor(pills);
      expect(row.length).toBeLessThanOrEqual(ROW_SIZE);
      if(pills.spend!=="treat")expect(row.every(m=>activityCost(m.key,[])!==null)).toBe(true);
    }
  });

  it("shows at most 2 ideas from the same internal category in the row of 6", () => {
    const categoryCounts = (keys: string[]) => {
      const counts = new Map<string, number>();
      for (const k of keys) counts.set(k.split("/")[0], (counts.get(k.split("/")[0]) ?? 0) + 1);
      return counts;
    };
    // With no picks, and with picks and affinity all piled into one category.
    const sports = Object.keys(CORNER_IDEAS).filter((k) => k.startsWith("sports-fitness/"));
    const piled = { picks: sports, affinity: new Map(sports.map((k) => [k, 1])) };
    for (const pills of combos) {
      for (const opts of [{}, piled]) {
        const row = ideasFor(pills, opts);
        expect(row.length, JSON.stringify(pills)).toBeLessThanOrEqual(ROW_SIZE);
        for (const [category, n] of categoryCounts(row.map((m) => m.key))) {
          expect(n, `${category} in ${JSON.stringify(pills)}`).toBeLessThanOrEqual(MAX_PER_CATEGORY);
        }
      }
    }
  });

  it("can show fewer results when an explicit cost constraint cannot be checked",()=>{
    expect(ideasFor({time:"hour",spend:"free",who:"solo"}).length).toBeLessThan(ROW_SIZE);
  });

  it("only ever widens as a pill loosens: An hour in Tonight in Weekend, Free in Under $25 in Treat me", () => {
    for (const who of WHOS) {
      for (const spend of SPEND_ORDER) {
        const counts = TIME_ORDER.map((time) => ideasFor({ time, spend, who }, { limit: 1000 }).length);
        expect(counts, `${spend}/${who}`).toEqual([...counts].sort((a, b) => a - b));
      }
      for (const time of TIME_ORDER) {
        const counts = SPEND_ORDER.map((spend) => ideasFor({ time, spend, who }, { limit: 1000 }).length);
        expect(counts, `${time}/${who}`).toEqual([...counts].sort((a, b) => a - b));
      }
    }
  });

  it("matches when the idea's smallest time and smallest spend are within the pill", () => {
    const idea = { time: "tonight", spend: "under25", who: ["friend"], ideaTitle: "x", how: "y." } as const;
    expect(fitsPills(idea, { time: "tonight", spend: "under25", who: "friend" })).toBe(true);
    expect(fitsPills(idea, { time: "weekend", spend: "treat", who: "friend" })).toBe(true);
    expect(fitsPills(idea, { time: "hour", spend: "treat", who: "friend" })).toBe(false);
    expect(fitsPills(idea, { time: "weekend", spend: "free", who: "friend" })).toBe(false);
    expect(fitsPills(idea, { time: "weekend", spend: "treat", who: "solo" })).toBe(false);
  });

  it("puts picks first, then affinity, and caps the row", () => {
    const pills: IdeaPills = { time: "weekend", spend: "treat", who: "solo" };
    const picked = ideasFor(pills, { picks: ["music/piano"], affinity: new Map([["art-creative/drawing", 0.9]]) });
    expect(picked[0].key).toBe("music/piano");
    expect(picked[1].key).toBe("art-creative/drawing");
    expect(picked).toHaveLength(ROW_SIZE);
  });

  it("never offers an adults-only idea", () => {
    const keys = ideasFor({ time: "weekend", spend: "treat", who: "solo" }, { limit: 1000 }).map((m) => m.key);
    expect(keys).not.toContain("food-cooking/home-brewing");
    expect(keys).not.toContain("food-cooking/cocktail-making");
  });
});
