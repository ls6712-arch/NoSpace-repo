import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake PostgREST chain for personal_picks: the first select can fail (the new columns aren't live yet).
const calls = vi.hoisted(() => ({ selects: [] as string[], orders: [] as string[], failNew: false, rows: [] as Record<string, unknown>[] }));
vi.mock("../../lib/supabase", () => {
  const chain = (columns: string) => {
    const q = {
      gte: () => q,
      order: (col: string) => (calls.orders.push(col), q),
      limit: async () =>
        calls.failNew && columns.includes("kind") ? { data: null, error: { message: "column personal_picks.kind does not exist" } } : { data: calls.rows, error: null },
    };
    return q;
  };
  return { supabase: { from: () => ({ select: (c: string) => (calls.selects.push(c), chain(c)) }) } };
});

import { fetchMyPicks } from "./stubbyAsk";

const NOW = Date.UTC(2026, 10, 1, 22);
const row = (over: Record<string, unknown> = {}) => ({ id: 1, title: "Wheel night", place: null, starts_at: new Date(NOW + 3_600_000).toISOString(), ends_at: null, price: "$10", url: "https://example.com/w", note: null, ...over });

beforeEach(() => {
  calls.selects.length = 0;
  calls.orders.length = 0;
  calls.failNew = false;
  calls.rows = [];
});

describe("fetchMyPicks", () => {
  it("reads kind, why and soonest-after, the latest ask first and best fit first", async () => {
    calls.rows = [row({ kind: "idea", why: "No booking.", soonest_after: true, rank: 0, ask_id: 9 })];
    const [p] = await fetchMyPicks(NOW);
    expect(p).toMatchObject({ kind: "idea", why: "No booking.", after: true });
    expect(calls.orders).toEqual(["ask_id", "rank", "starts_at"]);
  });

  it("before the migration is live, falls back to the old columns, soonest first, as events", async () => {
    calls.failNew = true;
    calls.rows = [row()];
    const [p] = await fetchMyPicks(NOW);
    expect(calls.selects).toHaveLength(2);
    expect(calls.selects[1]).not.toContain("kind");
    expect(p).toMatchObject({ kind: "event", why: null, after: false });
  });
});
