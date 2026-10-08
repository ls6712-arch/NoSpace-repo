import { describe, expect, it } from "vitest";
import { freshSpaces } from "./freshSpaces";

const DAY = 86_400_000;
const now = Date.parse("2026-10-07T12:00:00Z");
const row = (id: string, daysAgo: number, status: "active" | "read_only" | "deleted" = "active") => ({
  id,
  status,
  created_at: new Date(now - daysAgo * DAY).toISOString(),
});

describe("freshSpaces", () => {
  it("drops Spaces opened more than 7 days ago", () => {
    const out = freshSpaces([row("old", 21), row("new", 2), row("edge", 8)], now, 3);
    expect(out.map((s) => s.id)).toEqual(["new"]);
  });
  it("orders newest first and respects the limit", () => {
    const out = freshSpaces([row("a", 5), row("b", 1), row("c", 3), row("d", 2)], now, 3);
    expect(out.map((s) => s.id)).toEqual(["b", "d", "c"]);
  });
  it("ignores Spaces that are not active", () => {
    expect(freshSpaces([row("x", 1, "deleted")], now, 3)).toEqual([]);
  });
});
