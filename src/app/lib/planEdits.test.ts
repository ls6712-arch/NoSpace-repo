import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, deleted: [] as { table: string; id: unknown }[], failDelete: "" }));
const journal = vi.hoisted(() => ({ dropped: [] as string[] }));
vi.mock("./journal", async (orig) => ({ ...(await orig<typeof import("./journal")>()), dropProject: (id: string) => void journal.dropped.push(id) }));

/** A stand-in for the query builder: eq, neq, head counts and delete. */
vi.mock("../../lib/supabase", () => {
  const builder = (table: string) => {
    let rows = [...(db.tables[table] ?? [])];
    let del = false;
    let head = false;
    const b: Record<string, unknown> = {
      select: (_c?: string, o?: { head?: boolean }) => ((head = !!o?.head), b),
      delete: () => ((del = true), b),
      eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), b),
      neq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] !== v)), b),
      then: (ok: (v: unknown) => unknown) => {
        if (del) {
          if (db.failDelete === table) return Promise.resolve({ error: { message: "no" } }).then(ok);
          for (const r of rows) db.deleted.push({ table, id: r.id });
          db.tables[table] = (db.tables[table] ?? []).filter((r) => !rows.includes(r));
          return Promise.resolve({ error: null }).then(ok);
        }
        return Promise.resolve(head ? { count: rows.length, error: null } : { data: rows, error: null }).then(ok);
      },
    };
    return b;
  };
  return { supabase: { from: builder } };
});

import { cancelOwnPlan } from "./planEdits";

beforeEach(() => {
  db.deleted = [];
  db.failDelete = "";
  journal.dropped = [];
  db.tables = {
    pursuit_sessions: [{ id: 5, pursuit_id: "p1" }],
    pursuit_members: [{ pursuit_id: "p1", user_id: "me", role: "owner", status: "joined" }],
    pursuit_progress: [],
    stubs: [],
    posts: [],
    pursuits: [{ id: "p1" }],
  };
});

describe("cancelOwnPlan", () => {
  it("removes the session and the one-session Pursuit when nobody else is in it", async () => {
    expect(await cancelOwnPlan(5, "p1")).toBeNull();
    expect(db.deleted).toEqual([{ table: "pursuit_sessions", id: 5 }, { table: "pursuits", id: "p1" }]);
    expect(journal.dropped).toEqual(["p1"]);
  });

  it("keeps the Pursuit when another session is left in it", async () => {
    db.tables.pursuit_sessions.push({ id: 6, pursuit_id: "p1" });
    expect(await cancelOwnPlan(5, "p1")).toBeNull();
    expect(db.deleted).toEqual([{ table: "pursuit_sessions", id: 5 }]);
    expect(journal.dropped).toEqual([]);
  });

  it("keeps the Pursuit when someone else is in it, invited or asking", async () => {
    for (const status of ["joined", "invited", "requested"]) {
      db.deleted = [];
      db.tables.pursuit_sessions = [{ id: 5, pursuit_id: "p1" }];
      db.tables.pursuit_members = [{ pursuit_id: "p1", user_id: "me", role: "owner", status: "joined" }, { pursuit_id: "p1", user_id: "f", role: "member", status }];
      await cancelOwnPlan(5, "p1");
      expect(db.deleted.map((d) => d.table)).toEqual(["pursuit_sessions"]);
    }
  });

  it("still removes it when the only other member declined", async () => {
    db.tables.pursuit_members.push({ pursuit_id: "p1", user_id: "f", role: "member", status: "declined" });
    await cancelOwnPlan(5, "p1");
    expect(db.deleted.map((d) => d.table)).toEqual(["pursuit_sessions", "pursuits"]);
  });

  it("keeps the Pursuit when something was logged to it or a Stub was issued", async () => {
    for (const table of ["pursuit_progress", "stubs", "posts"]) {
      db.deleted = [];
      db.tables.pursuit_sessions = [{ id: 5, pursuit_id: "p1" }];
      db.tables[table] = [{ id: 1, pursuit_id: "p1" }];
      await cancelOwnPlan(5, "p1");
      expect(db.deleted.map((d) => d.table)).toEqual(["pursuit_sessions"]);
      db.tables[table] = [];
    }
    expect(journal.dropped).toEqual([]);
  });

  it("only skips the session when there is no Pursuit to look at", async () => {
    expect(await cancelOwnPlan(5, undefined)).toBeNull();
    expect(db.deleted.map((d) => d.table)).toEqual(["pursuit_sessions"]);
  });

  it("reports a session that could not be removed and leaves the Pursuit alone", async () => {
    db.failDelete = "pursuit_sessions";
    expect(await cancelOwnPlan(5, "p1")).toBeTruthy();
    expect(db.deleted).toEqual([]);
  });

  it("counts the plan as cancelled when the Pursuit itself cannot be removed, and keeps it in the journal", async () => {
    db.failDelete = "pursuits";
    expect(await cancelOwnPlan(5, "p1")).toBeNull();
    expect(journal.dropped).toEqual([]);
  });
});
