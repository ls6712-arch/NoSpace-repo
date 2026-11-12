import { describe, expect, it } from "vitest";
import { BUCKET, purgeDue, type PurgeClient } from "./purge.ts";

type Row = { message_id: number; media_paths: string[] | null };

function fake(batches: Row[][], opts: { storageError?: string; purgeError?: string } = {}) {
  const calls: string[] = [];
  const removed: string[][] = [];
  let next = 0;
  const client: PurgeClient = {
    rpc: async (fn, args) => {
      calls.push(fn);
      if (fn === "corner_removals_due") return { data: batches[next++] ?? [], error: null };
      if (opts.purgeError) return { data: null, error: { message: opts.purgeError } };
      return { data: (args.p_ids as number[]).length, error: null };
    },
    storage: {
      from: (bucket) => {
        expect(bucket).toBe(BUCKET);
        return {
          remove: async (paths) => {
            calls.push("remove");
            removed.push(paths);
            return { error: opts.storageError ? { message: opts.storageError } : null };
          },
        };
      },
    },
  };
  return { client, calls, removed };
}

describe("purgeDue", () => {
  it("does nothing when nothing is due", async () => {
    const f = fake([[]]);
    expect(await purgeDue(f.client)).toEqual({ purged: 0, files: 0 });
    expect(f.calls).toEqual(["corner_removals_due"]);
  });

  it("removes the photos first, then drops the copies", async () => {
    const f = fake([[{ message_id: 1, media_paths: ["a/u/1.jpg", "a/u/2.jpg"] }, { message_id: 2, media_paths: [] }, { message_id: 3, media_paths: null }]]);
    expect(await purgeDue(f.client)).toEqual({ purged: 3, files: 2 });
    expect(f.calls).toEqual(["corner_removals_due", "remove", "corner_removals_purged"]);
    expect(f.removed).toEqual([["a/u/1.jpg", "a/u/2.jpg"]]);
  });

  it("skips the Storage call for text only copies", async () => {
    const f = fake([[{ message_id: 1, media_paths: [] }]]);
    expect(await purgeDue(f.client)).toEqual({ purged: 1, files: 0 });
    expect(f.calls).toEqual(["corner_removals_due", "corner_removals_purged"]);
  });

  it("keeps the copies when Storage fails, so tomorrow tries again", async () => {
    const f = fake([[{ message_id: 1, media_paths: ["a/u/1.jpg"] }]], { storageError: "boom" });
    expect(await purgeDue(f.client)).toEqual({ purged: 0, files: 0, error: "boom" });
    expect(f.calls).not.toContain("corner_removals_purged");
  });

  it("reports a failed drop after the files are gone", async () => {
    const f = fake([[{ message_id: 1, media_paths: ["a/u/1.jpg"] }]], { purgeError: "nope" });
    expect(await purgeDue(f.client)).toEqual({ purged: 0, files: 1, error: "nope" });
  });

  it("keeps going while batches come back full, and stops at the cap", async () => {
    const full = (start: number): Row[] => Array.from({ length: 200 }, (_, i) => ({ message_id: start + i, media_paths: [] }));
    const f = fake([full(0), full(200), full(400), full(600), full(800), full(1000)]);
    const r = await purgeDue(f.client);
    expect(r.purged).toBe(1000);
    expect(f.calls.filter((c) => c === "corner_removals_due")).toHaveLength(5);
  });
});
