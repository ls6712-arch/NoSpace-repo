import { describe, expect, it } from "vitest";
import {
  ALL_WINDOWS,
  BUDGETS,
  PASS_KINDS,
  buildPickOptions,
  budgetLabel,
  cleanWindows,
  firstName,
  hasEnoughPicks,
  newPass,
  picksMissingLine,
  windowCountLine,
  windowLabel,
  type PickInput,
} from "./tasteModel";

const curated = Array.from({ length: 20 }, (_, i) => ({ key: `s/c${i + 1}`, name: `Corner ${i + 1}` }));
const base = (over: Partial<PickInput> = {}): PickInput => ({ curated, activity: new Map(), names: new Map(), selected: [], ...over });
const keys = (o: ReturnType<typeof buildPickOptions>) => o.map((x) => x.key);

describe("buildPickOptions", () => {
  it("offers the first 12 of the curated list when nothing is on near them", () => {
    expect(keys(buildPickOptions(base()))).toEqual(curated.slice(0, 12).map((c) => c.key));
  });

  it("puts Corners with something real near them first, most things first, then the rest of the list", () => {
    const activity = new Map([["s/c9", 1], ["s/c15", 3], ["s/c2", 3]]);
    const out = keys(buildPickOptions(base({ activity })));
    expect(out.slice(0, 3)).toEqual(["s/c15", "s/c2", "s/c9"]); // 3 things (A to Z on a tie: c15 before c2), then 1
    expect(out.slice(3, 6)).toEqual(["s/c1", "s/c3", "s/c4"]); // then the curated list in its own order
    expect(out).toHaveLength(12);
  });

  it("names an activity Corner that is not curated from the names it is given, and drops one it cannot name", () => {
    const names = new Map([["food/pasta", "Pasta"]]);
    const activity = new Map([["food/pasta", 2], ["ghost/unnamed", 5]]);
    const out = buildPickOptions(base({ activity, names }));
    expect(out[0]).toMatchObject({ key: "food/pasta", name: "Pasta" });
    expect(keys(out)).not.toContain("ghost/unnamed");
  });

  it("puts a friend's Corner first with their name under it, and does not repeat it", () => {
    const out = buildPickOptions(base({ arrival: { key: "s/c7", going: "Priya" }, activity: new Map([["s/c7", 4]]) }));
    expect(out[0]).toMatchObject({ key: "s/c7", going: "Priya" });
    expect(keys(out).filter((k) => k === "s/c7")).toHaveLength(1);
    expect(out).toHaveLength(12);
  });

  it("shows a friend's Corner that is not curated, if it can be named", () => {
    const out = buildPickOptions(base({ arrival: { key: "x/other", going: "Priya" }, names: new Map([["x/other", "Other"]]) }));
    expect(out[0]).toMatchObject({ key: "x/other", name: "Other", going: "Priya" });
  });

  it("keeps every pick visible, even one past the first 12 or found with Something else", () => {
    const out = buildPickOptions(base({ selected: ["s/c18", "x/found"], names: new Map([["x/found", "Found"]]) }));
    expect(keys(out).slice(12)).toEqual(["s/c18", "x/found"]);
  });

  it("never invents a Corner", () => {
    const out = buildPickOptions(base({ selected: ["nope/none"], activity: new Map([["nope/none2", 1]]) }));
    expect(keys(out)).not.toContain("nope/none");
    expect(keys(out)).not.toContain("nope/none2");
  });
});

describe("picks", () => {
  it("needs 3 and has no maximum", () => {
    expect(hasEnoughPicks(2)).toBe(false);
    expect(hasEnoughPicks(3)).toBe(true);
    expect(hasEnoughPicks(40)).toBe(true);
  });

  it("says how many more while short", () => {
    expect(picksMissingLine(0)).toBe("Pick 3 more");
    expect(picksMissingLine(2)).toBe("Pick 1 more");
  });
});

describe("free windows", () => {
  it("has 14: daytime and evening for seven days", () => {
    expect(ALL_WINDOWS).toHaveLength(14);
    expect(ALL_WINDOWS[0]).toBe("mon-day");
    expect(ALL_WINDOWS[13]).toBe("sun-eve");
  });

  it("reads a cell out in words", () => {
    expect(windowLabel("sat", "day")).toBe("Saturday daytime");
    expect(windowLabel("thu", "eve")).toBe("Thursday evening");
  });

  it("counts with the right plural", () => {
    expect(windowCountLine(0)).toBe("0 windows a week");
    expect(windowCountLine(1)).toBe("1 window a week");
    expect(windowCountLine(5)).toBe("5 windows a week");
  });

  it("keeps known windows once each, in week order", () => {
    expect(cleanWindows(["sat-day", "mon-eve", "sat-day", "nope", 3])).toEqual(["mon-eve", "sat-day"]);
    expect(cleanWindows(null)).toEqual([]);
  });
});

describe("budget and passes", () => {
  it("has the four amounts, with 0 as Free only", () => {
    expect([...BUDGETS]).toEqual([0, 50, 100, 200]);
    expect(budgetLabel(0)).toBe("Free only");
    expect(budgetLabel(50)).toBe("$50");
    expect(budgetLabel(200)).toBe("$200");
  });

  it("has the seven kinds, and a new pass is named for its kind with no place", () => {
    expect(PASS_KINDS.map((p) => p.kind)).toEqual(["climbing", "museum", "library", "bike", "fitness", "gear", "other"]);
    expect(newPass("climbing", "id1")).toEqual({ id: "id1", kind: "climbing", label: "Climbing", place: "" });
  });
});

describe("one chip per activity", () => {
  const names = new Map<string, string>();
  const curated = [
    { key: "sports-fitness/running", name: "Running" },
    { key: "sports-fitness/run-clubs", name: "Run clubs" },
    { key: "sports-fitness/climbing", name: "Climbing" },
    { key: "art-creative/drawing", name: "Drawing" },
    { key: "art-creative/life-drawing", name: "Life drawing" },
  ];
  it("keeps one of Running and Run clubs, the first in line", () => {
    const out = buildPickOptions({ curated, activity: new Map(), names, selected: [] });
    expect(out.map((o) => o.name)).toEqual(["Running", "Climbing", "Drawing"]);
  });
  it("lets the busier one win when it is the one with something near", () => {
    const out = buildPickOptions({ curated, activity: new Map([["sports-fitness/run-clubs", 2]]), names, selected: [] });
    expect(out.map((o) => o.name)).toEqual(["Run clubs", "Climbing", "Drawing"]);
  });
  it("still shows a pick the person already made", () => {
    const out = buildPickOptions({ curated, activity: new Map(), names, selected: ["sports-fitness/run-clubs"] });
    expect(out.map((o) => o.name)).toContain("Run clubs");
  });
  it("takes the first name only", () => {
    expect(firstName("Priya  Nair")).toBe("Priya");
    expect(firstName("Mia")).toBe("Mia");
    expect(firstName("")).toBe("");
  });
});
