import { describe, expect, it } from "vitest";
import { CORNER_IDEAS } from "../data/cornerIdeas";
import { fitsPills, ideasFor, SPEND_ORDER, TIME_ORDER, type IdeaPills } from "./ideaMatch";

const WHOS = ["solo", "friend", "new"] as const;

describe("idea pills are ceilings", () => {
  const combos: IdeaPills[] = TIME_ORDER.flatMap((time) => SPEND_ORDER.flatMap((spend) => WHOS.map((who) => ({ time, spend, who }))));

  it("returns at least 3 ideas for every pill combination, with no picks", () => {
    expect(combos).toHaveLength(27);
    for (const pills of combos) {
      expect(ideasFor(pills, { limit: 100 }).length, JSON.stringify(pills)).toBeGreaterThanOrEqual(3);
    }
  });

  it("fills the row (6) for every combination but the tightest ones", () => {
    const short = combos.filter((p) => ideasFor(p).length < 6);
    expect(short.map((p) => `${p.time}/${p.spend}/${p.who}`)).toEqual([]);
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
    expect(picked).toHaveLength(6);
  });

  it("never offers an adults-only idea", () => {
    const keys = ideasFor({ time: "weekend", spend: "treat", who: "solo" }, { limit: 1000 }).map((m) => m.key);
    expect(keys).not.toContain("food-cooking/home-brewing");
    expect(keys).not.toContain("food-cooking/cocktail-making");
  });
});
