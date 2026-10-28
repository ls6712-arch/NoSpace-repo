import { describe, expect, it } from "vitest";
import { CORNER_CATEGORIES } from "../data/cornerCategories";
import { homeCornersIn } from "../data/homeCorners";
import { makeRanker, rankRows, toAffinity, unit, type AffinityRow } from "./recommend";

const universe = CORNER_CATEGORIES.flatMap((c) => homeCornersIn(c.slug));
const find = (name: string) => universe.find((c) => c.name === name)!;
const row = (name: string, mine: number, extra: Partial<AffinityRow> = {}): AffinityRow => {
  const c = find(name);
  return { hobby_slug: c.spaceSlug, corner: c.slug, mine, peers: 0, trending: 0, ...extra };
};
const opts = { userId: "u1", day: "2026-10-28" };
const group = (slug: string) => homeCornersIn(slug);

describe("toAffinity", () => {
  it("splits Corner rows from Space-level rows", () => {
    const a = toAffinity([{ hobby_slug: "crafts-making", corner: "pottery", mine: 0.5, peers: 0.1, trending: 0.2 }, { hobby_slug: "crafts-making", corner: "", mine: 0.9, peers: 0, trending: 0 }]);
    expect(a.corners.get("crafts-making/pottery")).toEqual({ mine: 0.5, peers: 0.1, trending: 0.2 });
    expect(a.hobbies.get("crafts-making")).toBe(0.9);
  });
});

describe("makeRanker without a signal", () => {
  it("is not personal and keeps the order it is given", () => {
    for (const aff of [null, toAffinity([]), toAffinity([row("Pottery", 0.01)])]) {
      const r = makeRanker(aff, universe, opts);
      expect(r.personal).toBe(false);
      const cards = group("yarn-fabric");
      expect(r.order(cards)).toEqual(cards);
    }
  });
});

describe("makeRanker with a signal", () => {
  const potter = makeRanker(toAffinity([row("Pottery", 0.9), row("Woodworking", 0.5)]), universe, opts);
  const runner = makeRanker(toAffinity([row("Running", 0.9), row("Hiking", 0.6)]), universe, opts);

  it("scores what the person does above what they never touch", () => {
    expect(potter.personal).toBe(true);
    expect(potter.score(find("Pottery"))).toBeGreaterThan(potter.score(find("Running")));
    expect(runner.score(find("Running"))).toBeGreaterThan(runner.score(find("Pottery")));
  });

  it("generalises to similar Corners they have not touched", () => {
    expect(potter.score(find("Ceramics"))).toBeGreaterThan(potter.score(find("Boxing")));
  });

  it("puts rows they care about above rows they never touch", () => {
    const making = group("crafts-diy");
    const fitness = group("running-fitness");
    if (making.length && fitness.length) {
      expect(potter.relevance(making)).toBeGreaterThan(potter.relevance(fitness));
      expect(runner.relevance(fitness)).toBeGreaterThan(runner.relevance(making));
    }
  });

  it("orders cards best first without dropping or repeating any", () => {
    const cards = universe.slice(0, 30);
    const out = potter.order(cards);
    expect(out).toHaveLength(cards.length);
    expect(new Set(out.map((c) => `${c.spaceSlug}/${c.slug}`)).size).toBe(cards.length);
    expect(out[0]).toBe(cards.reduce((b, c) => (potter.score(c) > potter.score(b) ? c : b)));
  });

  it("is steady within a day and the shuffle is small", () => {
    const again = makeRanker(toAffinity([row("Pottery", 0.9), row("Woodworking", 0.5)]), universe, opts);
    expect(again.score(find("Chess"))).toBe(potter.score(find("Chess")));
    const nextDay = makeRanker(toAffinity([row("Pottery", 0.9), row("Woodworking", 0.5)]), universe, { ...opts, day: "2026-10-29" });
    expect(Math.abs(nextDay.score(find("Chess")) - potter.score(find("Chess")))).toBeLessThan(0.05);
  });

  it("counts people like them and what is trending", () => {
    const base = makeRanker(toAffinity([row("Pottery", 0.9), row("Chess", 0, { peers: 0 })]), universe, opts);
    const boosted = makeRanker(toAffinity([row("Pottery", 0.9), row("Chess", 0, { peers: 0.9, trending: 0.9 })]), universe, opts);
    expect(boosted.score(find("Chess"))).toBeGreaterThan(base.score(find("Chess")));
  });

  it("is personal on a Space-level signal alone", () => {
    const hobbyOnly = makeRanker(toAffinity([{ hobby_slug: "crafts-making", corner: "", mine: 0.8, peers: 0, trending: 0 }]), universe, opts);
    expect(hobbyOnly.personal).toBe(true);
  });
});

describe("rankRows", () => {
  it("sorts best first, keeps ties in order, and keeps pinned rows in front", () => {
    const rows = [{ n: "a", v: 1 }, { n: "b", v: 3 }, { n: "c", v: 3 }, { n: "d", v: 0 }];
    expect(rankRows(rows, (r) => r.v).map((r) => r.n)).toEqual(["b", "c", "a", "d"]);
    expect(rankRows(rows, (r) => r.v, (r) => r.n === "d").map((r) => r.n)).toEqual(["d", "b", "c", "a"]);
  });
});

describe("unit", () => {
  it("is in [0, 1) and stable", () => {
    for (const s of ["a", "b|2026|x", ""]) {
      expect(unit(s)).toBeGreaterThanOrEqual(0);
      expect(unit(s)).toBeLessThan(1);
      expect(unit(s)).toBe(unit(s));
    }
  });
});

