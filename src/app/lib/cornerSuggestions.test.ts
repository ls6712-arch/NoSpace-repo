import { describe, expect, it } from "vitest";
import { allSubHobbies, isBrowsableCorner } from "../data/hobbies";
import { MAX_CORNER_SUGGESTIONS, cornersPostedIn, followedCornerKeys, rankCornerSuggestions, topCityCorners } from "./cornerSuggestions";

const real = allSubHobbies.filter((s) => isBrowsableCorner(s.hobbySlug, s.slug));
const key = (i: number) => `${real[i].hobbySlug}/${real[i].slug}`;
const post = (i: number, createdAt: number) => ({ hobbySlug: real[i].hobbySlug, corner: real[i].slug, subHobby: undefined, createdAt });

describe("cornersPostedIn", () => {
  it("lists each Corner once, most recent Moment first", () => {
    expect(cornersPostedIn([post(0, 1), post(1, 5), post(0, 9), post(2, 3)])).toEqual([key(0), key(1), key(2)]);
  });
  it("skips Moments with no Corner", () => {
    expect(cornersPostedIn([{ hobbySlug: real[0].hobbySlug, createdAt: 1 }])).toEqual([]);
  });
});

describe("topCityCorners", () => {
  it("orders by most Moments, ties by key, never by name alone", () => {
    const m = new Map([[key(3), 2], [key(1), 9], [key(2), 2]]);
    const out = topCityCorners(m);
    expect(out[0]).toBe(key(1));
    expect(out.slice(1)).toEqual([key(2), key(3)].sort());
  });
});

describe("rankCornerSuggestions", () => {
  it("uses Corners posted in first, in the order given", () => {
    const out = rankCornerSuggestions({ postedIn: [key(4), key(2)], followed: [key(0)], inCity: [key(1)] });
    expect(out.map((c) => `${c.spaceSlug}/${c.slug}`)).toEqual([key(4), key(2), key(0)]);
  });

  it("falls back to followed Corners when nothing was posted", () => {
    const out = rankCornerSuggestions({ postedIn: [], followed: [key(6), key(5)], inCity: [key(1)] });
    expect(out.map((c) => `${c.spaceSlug}/${c.slug}`)).toEqual([key(6), key(5), key(1)]);
  });

  it("falls back to the city's most-posted Corners last", () => {
    const out = rankCornerSuggestions({ postedIn: [], followed: [], inCity: [key(7), key(8), key(9), key(10)] });
    expect(out.map((c) => `${c.spaceSlug}/${c.slug}`)).toEqual([key(7), key(8), key(9)]);
  });

  it("offers nothing when there is no history, no follows and no city data", () => {
    expect(rankCornerSuggestions({ postedIn: [], followed: [], inCity: [] })).toEqual([]);
  });

  it("never offers more than three or the same Corner twice, and drops unknown keys", () => {
    const out = rankCornerSuggestions({ postedIn: [key(0), "nope/none", key(0)], followed: [key(0), key(1)], inCity: [key(1), key(2), key(3)] });
    expect(out.length).toBe(MAX_CORNER_SUGGESTIONS);
    expect(new Set(out.map((c) => c.slug)).size).toBe(out.length);
    expect(out.map((c) => `${c.spaceSlug}/${c.slug}`)).toEqual([key(0), key(1), key(2)]);
  });
});

describe("followedCornerKeys", () => {
  it("maps followed Corner slugs to keys and ignores unknown ones", () => {
    expect(followedCornerKeys([real[3].slug, "no-such-corner"])).toEqual([`${real[3].hobbySlug}/${real[3].slug}`]);
  });
});
