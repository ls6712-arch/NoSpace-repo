import { describe, expect, it } from "vitest";
import { hobbies } from "../data/hobbies";
import { MAX_CORNER_SUGGESTIONS, suggestCorners } from "./cornerSuggestions";

const space = hobbies.find((h) => h.subItems.length >= 5 && !h.hidden)!;
const [a, b] = space.subItems;

describe("suggestCorners", () => {
  it("never offers more than three", () => {
    expect(suggestCorners({ spaceSlug: space.slug }).length).toBeLessThanOrEqual(MAX_CORNER_SUGGESTIONS);
  });

  it("puts the Pursuit's Corner first, then tag matches, without repeats", () => {
    const out = suggestCorners({ pursuitCorner: { spaceSlug: space.slug, slug: a.slug }, tags: [b.label, a.label], spaceSlug: space.slug });
    expect(out.map((c) => c.slug).slice(0, 2)).toEqual([a.slug, b.slug]);
    expect(new Set(out.map((c) => c.slug)).size).toBe(out.length);
  });

  it("offers nothing for a Space it does not know and no hints", () => {
    expect(suggestCorners({ spaceSlug: "nope" })).toEqual([]);
  });

  it("ignores a Pursuit Corner that does not exist", () => {
    expect(suggestCorners({ pursuitCorner: { spaceSlug: space.slug, slug: "not-a-corner" } })).toEqual([]);
  });
});
