import { describe, expect, it } from "vitest";
import { cardsFromRows, chainsFromRows, clipTitle, seedFromCard, startedBecauseLine, startedBecauseOfLine, type PassedRow, type WallRow } from "./cornerWalls";

const row = (over: Partial<WallRow> = {}): WallRow => ({
  wall: "making",
  post_id: 7,
  author_id: "u1",
  author_first_name: "Maya",
  author_avatar_url: null,
  is_mine: false,
  pursuit_id: "p1",
  pursuit_title: "Jacket",
  media_type: "photo",
  media_url: null,
  media_urls: null,
  media_paths: ["a/b.jpg"],
  caption: "First row done. More to come.",
  posted_at: "2026-11-01T10:00:00Z",
  finished_at: null,
  has_finisher_stub: false,
  inspired_by_post_id: null,
  inspired_by_first_name: null,
  started_because: [],
  ...over,
});

describe("startedBecauseLine", () => {
  it("names one, two, or two and others, never a number", () => {
    expect(startedBecauseLine([])).toBe("");
    expect(startedBecauseLine(["Priya"])).toBe("Priya started because of this");
    expect(startedBecauseLine(["Priya", "Sam"])).toBe("Priya and Sam started because of this");
    expect(startedBecauseLine(["Priya", "Sam", "Lee"])).toBe("Priya, Sam and others started because of this");
    expect(startedBecauseLine(["Priya", "Sam", "Lee", "Kai"])).not.toMatch(/\d/);
  });
  it("cuts a long name to 60 characters", () => {
    expect(startedBecauseLine(["x".repeat(100)])).toBe(`${"x".repeat(60)} started because of this`);
  });
});

describe("cardsFromRows", () => {
  it("uses the signed photo for a private-storage Moment and the plain URL for a legacy one", () => {
    const [a, b] = cardsFromRows([row(), row({ post_id: 8, media_paths: null, media_urls: ["https://x/y.jpg"] })], new Map([["a/b.jpg", "https://signed/a"]]));
    expect(a.photo).toBe("https://signed/a");
    expect(b.photo).toBe("https://x/y.jpg");
  });
  it("shows no photo for a path that could not be signed, or for a written Moment", () => {
    const [a, b] = cardsFromRows([row(), row({ media_type: "written", media_paths: null, media_url: "https://x" })]);
    expect(a.photo).toBeUndefined();
    expect(b.photo).toBeUndefined();
  });
  it("only names a source when the row carries one", () => {
    const [a, b] = cardsFromRows([row(), row({ inspired_by_post_id: 3, inspired_by_first_name: "Priya" })]);
    expect(startedBecauseOfLine(a)).toBe("");
    expect(startedBecauseOfLine(b)).toBe("Started because of Priya");
  });
  it("falls back to Someone for a blank name and keeps at most 3 names", () => {
    const [c] = cardsFromRows([row({ author_first_name: " ", started_because: ["A", "B", "C", "D"] })]);
    expect(c.authorName).toBe("Someone");
    expect(c.startedBecause).toEqual(["A", "B", "C"]);
  });
});

describe("chainsFromRows", () => {
  const p = (chain_no: number, pos: number, id: string, name: string, title: string | null = null, last = pos): PassedRow => ({
    chain_no, pos, author_id: id, author_first_name: name, pursuit_id: `pu-${id}`, pursuit_title: title, last_post_id: last,
  });
  it("builds the source chip with its title, then first names, and ends at the newest Moment", () => {
    const [c] = chainsFromRows([p(1, 2, "b", "Priya", null, 22), p(1, 1, "a", "Maya", "Embroider a jacket for the", 11)], "z");
    expect(c.chips).toEqual(["Maya’s Embroider a jacket for…", "Priya"]);
    expect(c.lastPostId).toBe(22);
    expect(c.mine).toBe(false);
  });
  it("marks a chain the viewer is in, keeps chain order, and drops a chain of one", () => {
    const out = chainsFromRows([p(2, 1, "a", "A", "T"), p(2, 2, "me", "Me"), p(1, 1, "c", "C", "U"), p(1, 2, "d", "D"), p(3, 1, "e", "E", "V")], "me");
    expect(out.map((c) => c.chips[0])).toEqual(["C’s U", "A’s T"]);
    expect(out[1].mine).toBe(true);
  });
});

describe("seedFromCard", () => {
  it("carries what Make your version needs: the id, caption, Corner and maker", () => {
    const [card] = cardsFromRows([row()]);
    const seed = seedFromCard(card, { spaceSlug: "crafts-making", slug: "embroidery" });
    expect(seed).toMatchObject({ id: 7, hobbySlug: "crafts-making", subHobby: "embroidery", userId: "u1", creator: "Maya" });
    expect(seed.caption.split(".")[0]).toBe("First row done");
  });
});

describe("clipTitle", () => {
  it("leaves a short title alone", () => {
    expect(clipTitle("Jacket")).toBe("Jacket");
    expect(clipTitle("A title of 23 chars ok")).toBe("A title of 23 chars ok");
  });
  it("cuts a long title at a word boundary, adds …, and never goes past 24 characters", () => {
    for (const t of ["Embroider a jacket for the whole winter", "Embroider a jacket for t", "Sourdough with a long rise time", "Learn to play the saxophone properly"]) {
      const out = clipTitle(t);
      expect(out.length).toBeLessThanOrEqual(24);
      expect(out.endsWith("…")).toBe(true);
      // Never mid-word: what is left is whole words from the start of the title.
      const kept = out.slice(0, -1);
      expect(t.startsWith(kept)).toBe(true);
      expect(t[kept.length] === " " || t[kept.length] === undefined).toBe(true);
    }
    expect(clipTitle("Embroider a jacket for the whole winter")).toBe("Embroider a jacket for…");
  });
  it("drops punctuation left dangling before the …", () => {
    expect(clipTitle("Jacket, scarf, hat and gloves, mittens")).toBe("Jacket, scarf, hat and…");
  });
  it("cuts a single very long word where it is, within the limit", () => {
    const out = clipTitle("Supercalifragilisticexpialidocious");
    expect(out.length).toBeLessThanOrEqual(24);
    expect(out.endsWith("…")).toBe(true);
  });
});
