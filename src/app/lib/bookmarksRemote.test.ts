import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one-time sync of saves a phone already holds (see bookmarksRemote.ts):
 * synced rows are marked so they never notify, it runs once per device, and the
 * local list is only replaced after the database confirmed the write.
 */

type Row = { user_id: string; post_id: number; source?: string };

const db = {
  rows: [] as Row[],
  failUpsert: false,
  failSelect: false,
  upserts: [] as Row[][],
};

const fakeClient = {
  auth: { getSession: async () => ({ data: { session: { user: { id: "u1" } } } }) },
  from: () => ({
    upsert: async (rows: Row | Row[]) => {
      const list = Array.isArray(rows) ? rows : [rows];
      db.upserts.push(list);
      if (db.failUpsert) return { error: { message: "offline" } };
      for (const r of list) {
        if (!db.rows.some((x) => x.user_id === r.user_id && x.post_id === r.post_id)) db.rows.push({ ...r });
      }
      return { error: null };
    },
    delete: () => ({
      eq: () => ({
        eq: async () => ({ error: null }),
      }),
    }),
    select: () => ({
      eq: () => ({
        order: () => ({
          limit: async () =>
            db.failSelect
              ? { data: null, error: { message: "offline" } }
              : { data: [...db.rows].reverse().map((r) => ({ post_id: r.post_id })), error: null },
        }),
      }),
    }),
  }),
};

vi.mock("../../lib/supabase", () => ({ supabase: fakeClient }));

function installWindow() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  vi.stubGlobal("window", { localStorage, addEventListener: () => {}, removeEventListener: () => {} });
  return store;
}

async function load(localSaved: number[]) {
  vi.resetModules();
  const store = installWindow();
  store.set("sushii.journal.v1", JSON.stringify({ saved: localSaved }));
  const journal = await import("./journal");
  const remote = await import("./bookmarksRemote");
  return { store, journal, remote };
}

beforeEach(() => {
  db.rows = [];
  db.failUpsert = false;
  db.failSelect = false;
  db.upserts = [];
});

describe("reconcileSaves", () => {
  it("sends the saves a phone already holds as local_sync, then matches the database", async () => {
    const { journal, remote, store } = await load([7, 5, 3]);
    await remote.reconcileSaves("u1");
    expect(db.upserts.flat().map((r) => r.source)).toEqual(["local_sync", "local_sync", "local_sync"]);
    expect(db.rows.map((r) => r.post_id).sort()).toEqual([3, 5, 7]);
    expect(store.get("soosh.saves-synced.u1")).toBe("1");
    expect(journal.getSavedIds().slice().sort()).toEqual([3, 5, 7]);
  });

  it("runs once per device: the second open sends nothing", async () => {
    const { remote } = await load([1, 2]);
    await remote.reconcileSaves("u1");
    const sent = db.upserts.length;
    await remote.reconcileSaves("u1");
    expect(db.upserts.length).toBe(sent);
  });

  it("keeps the local saves, and tries again next time, when the write fails", async () => {
    db.failUpsert = true;
    const { journal, remote, store } = await load([4, 9]);
    await remote.reconcileSaves("u1");
    expect(journal.getSavedIds()).toEqual([4, 9]);
    expect(store.get("soosh.saves-synced.u1")).toBeUndefined();
    expect(db.rows).toEqual([]);

    db.failUpsert = false;
    await remote.reconcileSaves("u1");
    expect(db.rows.map((r) => r.post_id).sort()).toEqual([4, 9]);
    expect(store.get("soosh.saves-synced.u1")).toBe("1");
  });

  it("leaves the local list alone when the database cannot be read afterwards", async () => {
    db.failSelect = true;
    const { journal, remote } = await load([4, 9]);
    await remote.reconcileSaves("u1");
    expect(journal.getSavedIds()).toEqual([4, 9]);
  });

  it("brings in saves made on another device", async () => {
    db.rows = [{ user_id: "u1", post_id: 40, source: "live" }];
    const { journal, remote } = await load([]);
    await remote.reconcileSaves("u1");
    expect(journal.getSavedIds()).toEqual([40]);
  });

  it("never re-labels a save that was already live", async () => {
    db.rows = [{ user_id: "u1", post_id: 8, source: "live" }];
    const { remote } = await load([8]);
    await remote.reconcileSaves("u1");
    expect(db.rows.find((r) => r.post_id === 8)?.source).toBe("live");
  });
});

describe("syncBookmark", () => {
  it("sends a live save without a source, so the database default (live) applies", async () => {
    const { remote } = await load([]);
    await remote.syncBookmark(12, true);
    expect(db.upserts.flat()).toEqual([{ user_id: "u1", post_id: 12 }]);
  });

  it("remembers a save that could not be sent and sends it on the next open", async () => {
    db.failUpsert = true;
    const { journal, remote } = await load([12]);
    await remote.syncBookmark(12, true);
    db.failUpsert = false;
    db.upserts = [];
    await remote.reconcileSaves("u1");
    expect(db.rows.map((r) => r.post_id)).toContain(12);
    expect(journal.getSavedIds()).toContain(12);
  });
});
