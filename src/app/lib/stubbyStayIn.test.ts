import { describe, expect, it } from "vitest";
import { CORNER_GUIDES } from "../data/cornerGuides";
import { doableAtHome } from "./homeItems";
import { saysStayIn, stayInCards, withoutStayIn } from "./stubbyStayIn";

const keys = Object.keys(CORNER_GUIDES);
const atHome = keys.filter(doableAtHome);
const notAtHome = keys.filter((k) => !doableAtHome(k));

describe("Stay in cards (hotfix, Nov 3, 2026)", () => {
  it("has Corners on both sides of the at-home rule to test with", () => {
    expect(atHome.length).toBeGreaterThan(2);
    expect(notAtHome.length).toBeGreaterThan(0);
  });

  it("lists their Pursuits first, with their own note as the next step", () => {
    const [space, slug] = atHome[0].split("/");
    const cards = stayInCards({ pursuits: [{ id: "p1", title: "Bake bread", spaceSlug: space, cornerSlug: slug, note: "Feed the starter" }], picks: [atHome[1]] });
    expect(cards[0]).toMatchObject({ kind: "pursuit", title: "Bake bread", step: "Feed the starter", to: "/pursuit/p1" });
    expect(cards[1]).toMatchObject({ kind: "corner", id: `corner:${atHome[1]}` });
  });

  it("falls back to the Corner guide's first step when the Pursuit has no note", () => {
    const [space, slug] = atHome[0].split("/");
    const [card] = stayInCards({ pursuits: [{ id: "p1", title: "Mine", spaceSlug: space, cornerSlug: slug, note: null }], picks: [] });
    expect(card.step).toBe(CORNER_GUIDES[atHome[0]].step);
    expect(card.photo).toMatch(/^https:\/\//);
  });

  it("keeps only picked Corners that work at home, each with a photo and its start page", () => {
    const cards = stayInCards({ pursuits: [], picks: [notAtHome[0], atHome[2]] });
    expect(cards.map((c) => c.id)).toEqual([`corner:${atHome[2]}`]);
    expect(cards[0].title).toMatch(/ at home$/);
    expect(cards[0].to).toMatch(/^\/start\//);
    expect(cards[0].photo).toMatch(/^https:\/\//);
    expect(cards[0].needs.length).toBeLessThanOrEqual(3);
  });

  it("never repeats a Corner a Pursuit already covers", () => {
    const [space, slug] = atHome[0].split("/");
    const cards = stayInCards({ pursuits: [{ id: "p1", title: "Mine", spaceSlug: space, cornerSlug: slug, note: null }], picks: [atHome[0]] });
    expect(cards).toHaveLength(1);
  });

  it("is empty with nothing to go on, so the empty state shows", () => {
    expect(stayInCards({ pursuits: [], picks: [] })).toEqual([]);
  });
});

describe("saysStayIn and withoutStayIn", () => {
  it("reads typed stay-in words", () => {
    expect(saysStayIn("something at home tonight")).toBe(true);
    expect(saysStayIn("a night in")).toBe(true);
    expect(saysStayIn("pottery on Saturday")).toBe(false);
    expect(saysStayIn("stay in or go out")).toBe(false);
  });

  it("drops them for Head out", () => {
    expect(withoutStayIn("something cozy at home tonight")).toBe("something cozy tonight");
    expect(withoutStayIn("stay in")).toBe("");
  });
});
