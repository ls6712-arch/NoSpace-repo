import { beforeEach, describe, expect, it, vi } from "vitest";

const result = vi.hoisted(() => ({ value: { data: [] as { id: string }[] | null, error: null as unknown } }));
const calls = vi.hoisted(() => ({ ids: [] as string[][] }));
vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: (_col: string, ids: string[]) => {
            calls.ids.push(ids);
            return Promise.resolve(result.value);
          },
        }),
      }),
    }),
  },
}));

import { testAccountIds, withoutTestAccounts } from "./testAccounts";

beforeEach(() => {
  calls.ids = [];
  result.value = { data: [], error: null };
});

describe("test accounts", () => {
  it("returns the flagged ids", async () => {
    result.value = { data: [{ id: "t1" }], error: null };
    expect([...(await testAccountIds(["a", "t1", "a"]))]).toEqual(["t1"]);
    expect(calls.ids[0]).toEqual(["a", "t1"]);
  });

  it("never hides the viewer's own account", async () => {
    result.value = { data: [{ id: "t1" }], error: null };
    await testAccountIds(["a", "t1"], "t1");
    expect(calls.ids[0]).toEqual(["a"]);
  });

  it("filters a list and keeps the order", async () => {
    result.value = { data: [{ id: "t1" }], error: null };
    const out = await withoutTestAccounts([{ id: "a" }, { id: "t1" }, { id: "b" }], (x) => x.id);
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("hides nothing when the column is missing or the read fails", async () => {
    result.value = { data: null, error: { code: "42703", message: "column profiles.is_test does not exist" } };
    const out = await withoutTestAccounts([{ id: "a" }, { id: "t1" }], (x) => x.id);
    expect(out.map((x) => x.id)).toEqual(["a", "t1"]);
  });

  it("makes no request for an empty list", async () => {
    expect((await testAccountIds([])).size).toBe(0);
    expect(calls.ids).toEqual([]);
  });
});
