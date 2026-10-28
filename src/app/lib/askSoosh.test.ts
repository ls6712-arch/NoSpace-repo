import { describe, expect, it } from "vitest";
import { askPlans, looksLikeAsk, understoodChips } from "./askSoosh";

describe("looksLikeAsk", () => {
  it("is true for 5 or more words", () => expect(looksLikeAsk("something calm to do on my own")).toBe(true));
  it("is true for with, under and this weekend", () => {
    expect(looksLikeAsk("pottery with friends")).toBe(true);
    expect(looksLikeAsk("walks under 2 hours")).toBe(true);
    expect(looksLikeAsk("music this weekend")).toBe(true);
  });
  it("is false for a plain word or two", () => {
    expect(looksLikeAsk("pottery")).toBe(false);
    expect(looksLikeAsk("run club")).toBe(false);
    expect(looksLikeAsk("   ")).toBe(false);
  });
});

describe("understoodChips", () => {
  it("reads the filters out of a sentence", () => {
    expect(understoodChips("pottery with friends under 2 hours this weekend")).toEqual(["This week", "Up to 2 hr", "With people"]);
  });
  it("finds nothing in a plain query", () => expect(understoodChips("pottery")).toEqual([]));
});

describe("askPlans", () => {
  it("makes at most three plans", () => {
    const c = (n: string) => ({ name: n, line: "1 hr · At home", to: `/corners/${n}` });
    expect(askPlans([c("a"), c("b"), c("c"), c("d")])).toHaveLength(3);
    expect(askPlans([])).toEqual([]);
  });
});
