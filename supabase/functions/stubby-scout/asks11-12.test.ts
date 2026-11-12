// Stubby agent PR 6 (docs/briefs/stubby-agent.md, Part I): the fixes for live asks 11 and 12 (Nov 2, 2026).
// The candidates are the ones those asks saved as drop reasons, replayed with a fixed clock:
//   ask 11: 5 found, 0 added. A walk, a run club and two copies of a free museum afternoon were dropped
//           as "Price not listed", and the person's own Pursuit as "an idea outside their Corners".
//   ask 12: Pumpkin Smash at Pier 84 dropped as "Price not listed".
// Fixed: free by nature (C3), own Pursuits (C3), honest reasons (C7), duplicates (C7). The asks' own words
// weren't saved (never are), so these use asks that ask for a walk: an idea still fits only in a Corner
// they picked, on a Soosh page Stubby offered, or when the ask asked for it (plan §6.2).
import { describe, expect, it } from "vitest";
import { checkAskPicks, freeByNature, gapLines, sameThing, topReasons, type AskCheckContext } from "./ask.ts";
import { askSystemPrompt, askUserPrompt } from "./askPrompt.ts";
import { readIntent, searchWindow, type IntentContext } from "./intent.ts";
import { linkKey, nyLocalToMs, type RawPick } from "./picks.ts";

const NOW = nyLocalToMs("2026-11-01T17:00");
const page = (path: string) => `https://example.org${path}`;
const PURSUIT = "/pursuit/p1";

function check(ask: string, raw: RawPick[], over: Partial<IntentContext> = {}, extra: Partial<AskCheckContext> = {}) {
  const intent = readIntent(ask, { now: NOW, ...over });
  const window = searchWindow(intent, NOW);
  return {
    intent,
    window,
    result: checkAskPicks(raw, {
      now: NOW,
      intent,
      window,
      sourceLinks: new Set(raw.map((r) => linkKey(r.url)).filter((k): k is string => !!k)),
      sooshLinks: new Set(["/start/crafts/pottery", PURSUIT]),
      corners: new Map([["pottery", 7]]),
      // No Corners picked: the Pursuit has to count on its own.
      pickedCornerIds: new Set<number>(),
      askText: ask,
      latestMs: window.endMs + 7 * 86_400_000,
      ...extra,
    }),
  };
}

// Ask 11's five, in the order the model sent them.
const ASK_11: RawPick[] = [
  { kind: "event", title: "Central Park Beginner Runners, Sunday run", place: "Central Park", starts: "2026-11-07T09:00", price: null, url: page("/runners/sunday-run") },
  { kind: "event", title: "Free Thursday afternoon at Museum of the Moving Image", place: "Astoria", starts: "2026-11-05T14:00", price: null, url: page("/visit/free-thursdays") },
  { kind: "idea", title: "Pottery session on your Pursuit", place: null, starts: "2026-11-02T19:00", price: null, url: PURSUIT, corner: null },
  { kind: "event", title: "Free Thursday afternoon at the Museum of the Moving Image", place: "Astoria", starts: "2026-11-05T14:00", price: null, url: page("/visit/free-thursdays") },
  { kind: "idea", title: "Slow Sunday walk to Gapstow Bridge in Central Park", place: "Central Park", starts: "2026-11-07T10:00", price: null, url: page("/parks/central-park/gapstow-bridge"), corner: null },
];

describe("ask 11: explicit free-only and unknown prices",()=>{
  it("preserves the original free-only answer as a hard constraint",()=>{
    const {intent,result}=check("a walk or something chill this week",ASK_11,{monthlyBudget:0});
    expect(intent.budget).toEqual({max:0,free:true,from:"profile"});
    expect(result.outcome).toBe("nothing");expect(result.kept).toEqual([]);
    expect(result.dropped.every(d=>d.key==="noprice")).toBe(true);
  });
  it("does not infer free admission from a title, a park, or an owned Pursuit",()=>{
    const {result}=check("a walk or free stuff this week",ASK_11);
    expect(result.kept).toEqual([]);
    expect(result.dropped.some(d=>d.key==="budget")).toBe(false);
  });
  it("retains an unknown price when no money constraint was given, with a disclosure",()=>{
    const {result}=check("a walk or something chill this week",[ASK_11[0]]);
    expect(result.kept[0]).toMatchObject({price:null,note:"Price not listed"});
  });
  it("can recommend confirmed free activities without guessing other costs",()=>{
    const {result}=check("a walk or free stuff this week",ASK_11.map((p,i)=>i===1||i===4?{...p,price:"Free"}:p));
    expect(result.kept.map(p=>p.title)).toEqual([ASK_11[1].title,ASK_11[4].title]);
  });
});

describe("ask 12: Pumpkin Smash at Pier 84, no price on its page", () => {
  const smash: RawPick = { kind: "event", title: "Pumpkin Smash at Pier 84", place: "Hudson River Park", starts: "2026-11-07T11:00", price: null, url: page("/events/pumpkin-smash-pier-84") };

  it("a hard free can't be met by an unknown price: dropped as no price, and the reasons say so", () => {
    const { result } = check("free stuff this weekend", [smash]);
    expect(result.outcome).toBe("nothing");
    expect(result.dropped).toEqual([{ title: "Pumpkin Smash at Pier 84", reason: "Price not listed, so the budget could not be checked.", key: "noprice" }]);
    // Never "was over your budget": the reason key is its own.
    expect(topReasons(result.dropped)).toEqual([{ key: "noprice", count: 1 }]);
  });

  it("a saved free-only choice also excludes unknown price", () => {
    const { result } = check("something this weekend", [smash], { monthlyBudget: 0 });
    expect(result.kept).toEqual([]);expect(result.dropped[0].key).toBe("noprice");
  });

  it("an event in a park is not free by nature: only ideas are", () => {
    expect(freeByNature("event", "Pumpkin Smash at Pier 84", "Hudson River Park", false)).toBe(false);
    expect(freeByNature("idea", "A walk along Pier 84", "Hudson River Park", false)).toBe(true);
  });
});

describe("free by nature", () => {
  it("their own Pursuit or a start page Stubby offered, a walk, a run, a park, a library, or a title that says free", () => {
    expect(freeByNature("idea", "Pottery session on your Pursuit", null, true)).toBe(true);
    expect(freeByNature("idea", "An easy evening run by the river", null, false)).toBe(true);
    expect(freeByNature("idea", "Read at the Brooklyn Public Library", null, false)).toBe(true);
    expect(freeByNature("event", "Free Thursday afternoon at the museum", null, false)).toBe(true);
    expect(freeByNature("idea", "Sketch at a cafe", "Greenpoint", false)).toBe(false);
    expect(freeByNature("event", "Wheel throwing intro", null, false)).toBe(false);
  });

  it("never overrides a price the page states", () => {
    const paid: RawPick = { kind: "idea", title: "A walk through the botanic garden", starts: "2026-11-02T10:00", price: "$18", url: page("/garden/visit"), corner: null };
    const { result } = check("a garden walk tomorrow, free", [paid]);
    expect(result.kept).toEqual([]);
    expect(result.dropped[0]).toMatchObject({ reason: "Not free.", key: "budget" });
  });
});

describe("their own Pursuits", () => {
  it("an idea on their own Pursuit fits even with no Corners picked and nothing in the ask about it", () => {
    const { result } = check("something tomorrow on my own", [ASK_11[2]]);
    expect(result.kept.map((p) => [p.kind, p.title, p.url])).toEqual([["idea", "Pottery session on your Pursuit", PURSUIT]]);
  });

  it("but a Pursuit page Stubby didn't offer is never linked", () => {
    const other: RawPick = { ...ASK_11[2], url: "/pursuit/someone-else" };
    const { result } = check("something tomorrow on my own", [other]);
    expect(result.kept).toEqual([]);
    expect(result.dropped[0].key).toBe("nopage");
  });
});

describe("duplicates", () => {
  it("the same title give or take the little words, at the same time, is one thing", () => {
    expect(sameThing("Free Thursday afternoon at the Museum of the Moving Image")).toBe(sameThing("Free Thursday afternoon at Museum of the Moving Image"));
    expect(sameThing("Pottery & tea")).toBe(sameThing("Pottery and tea"));
    expect(sameThing("Wheel night")).not.toBe(sameThing("Wheel day"));
  });

  it("the same title at another time is a different occurrence, so both are kept", () => {
    const a: RawPick = { kind: "event", title: "Open studio", starts: "2026-11-02T18:00", price: "Free", url: page("/studio/mon") };
    const b: RawPick = { ...a, title: "The open studio", starts: "2026-11-03T18:00", url: page("/studio/tue") };
    expect(check("pottery this week", [a, b]).result.kept).toHaveLength(2);
  });

  it("a follow-up never shows again what the deck already has, even reworded", () => {
    const { result } = check("a walk or something chill this week", [ASK_11[3]], { monthlyBudget: 0 }, { exclude: ["Free Thursday afternoon at Museum of the Moving Image"] });
    expect(result.kept).toEqual([]);
    expect(result.dropped[0].reason).toBe("Already in the deck.");
  });
});

describe("what the model is told", () => {
  it("a monthly budget is a preference, a typed one a limit", () => {
    const soft = readIntent("something this week", { now: NOW, monthlyBudget: 0 });
    const hard = readIntent("free stuff this week", { now: NOW });
    const person = { corners: [], freeTimes: [], neighborhood: null, city: null, passes: [], sooshPages: [] };
    expect(askUserPrompt("something this week", soft, searchWindow(soft, NOW), person, NOW)).toContain("- Spending: they prefer free things; cheap is fine if it fits well.");
    expect(askUserPrompt("free stuff this week", hard, searchWindow(hard, NOW), person, NOW)).toContain("- Budget: free things only.");
  });

  it("free by nature is free, each thing once, and the second round hears why free things were dropped", () => {
    expect(askSystemPrompt()).toContain('has the price "free"');
    expect(askSystemPrompt()).toContain("Report each thing once, under one title.");
    expect(gapLines([], [{ title: "x", reason: "Price not listed, so the budget could not be checked.", key: "noprice" }])).toContain("1 things with no price on their page");
  });
});
