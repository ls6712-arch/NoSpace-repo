// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, updates: [] as { table: string; patch: Row }[] }));

/** A stand-in for the query builder: reads filter by eq and in; insert returns the row; update is recorded. */
vi.mock("../../lib/supabase", () => {
  const builder = (table: string) => {
    let rows = [...(db.tables[table] ?? [])];
    let patch: Row | null = null;
    const b: Record<string, unknown> = {
      select: () => b,
      insert: (r: Row) => ((rows = [{ id: 41, ...r }]), b),
      update: (p: Row) => ((patch = p), b),
      upsert: () => b,
      eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), b),
      in: (c: string, v: unknown[]) => ((rows = rows.filter((r) => v.includes(r[c]))), b),
      is: () => b,
      order: () => b,
      single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (ok: (v: unknown) => unknown) => {
        if (patch) db.updates.push({ table, patch });
        return Promise.resolve({ data: rows, error: null }).then(ok);
      },
    };
    return b;
  };
  return { supabase: { from: builder, rpc: async () => ({ data: null, error: null }) } };
});

const remote = vi.hoisted(() => ({ mirrored: [] as string[] }));
vi.mock("./pursuitsRemote", async (orig) => ({
  ...(await orig<typeof import("./pursuitsRemote")>()),
  mirrorPursuit: async (_u: string, p: { id: string }) => void remote.mirrored.push(p.id),
  mirrorPursuitMeasure: async () => undefined,
  saveInvites: async () => null,
}));
vi.mock("./openPursuits", async (orig) => ({ ...(await orig<typeof import("./openPursuits")>()), mirrorPursuitOpen: async () => undefined }));

import { LOCAL_CLEARED_EVENT } from "./localData";
import { activePursuits } from "./pursuitTrail";
import { addJoinedProject, mergeRemoteProjects, startProject, getJournal, type Project } from "./journal";
import { createPlan } from "./planEdits";
import { restoreOwnPursuits } from "./pursuitsRemote";

const owner = { id: "u1", username: "maya", displayName: "Maya", avatarUrl: undefined };
const proj = (id: string, over: Partial<Project> = {}): Project => ({ id, title: id, startedAt: Date.now(), ...over });

beforeEach(() => {
  window.localStorage.clear();
  db.tables = {};
  db.updates = [];
  remote.mirrored = [];
  // Start every test from an empty journal.
  window.dispatchEvent(new Event(LOCAL_CLEARED_EVENT));
});

describe("one-off plans stay out of the person's Pursuit lists", () => {
  it("makes a plan without putting it in the journal, and marks its Pursuit as a plan", async () => {
    const before = getJournal().projects.length;
    const r = await createPlan({ title: "Pottery", cornerKey: "crafts-making/pottery", startsAt: Date.now() + 86_400_000 }, owner);
    expect(r.sessionId).toBe(41);
    expect(remote.mirrored).toEqual([r.pursuitId]);
    expect(getJournal().projects).toHaveLength(before);
    expect(getJournal().projects.some((p) => p.id === r.pursuitId)).toBe(false);
    expect(db.updates).toContainEqual({ table: "pursuits", patch: { is_plan: true } });
  });

  it("still starts an ordinary Pursuit in the journal", () => {
    const p = startProject({ title: "Pasta from scratch" });
    expect(getJournal().projects.map((x) => x.id)).toContain(p.id);
  });

  it("does not bring a plan in when Pursuits are restored from the database", async () => {
    db.tables.pursuits = [
      { id: "plan-1", user_id: "u1", title: "Pottery", started_at: new Date().toISOString(), is_plan: true, shared: false },
      { id: "real-1", user_id: "u1", title: "Pasta from scratch", started_at: new Date().toISOString(), is_plan: false, shared: false },
    ];
    await restoreOwnPursuits("u1");
    const ids = getJournal().projects.map((p) => p.id);
    expect(ids).toContain("real-1");
    expect(ids).not.toContain("plan-1");
  });

  it("does not bring a plan in when someone joins it, from a link or an invite", () => {
    addJoinedProject(proj("plan-2", { plan: true }));
    expect(getJournal().projects.map((p) => p.id)).not.toContain("plan-2");
    addJoinedProject(proj("real-2"));
    expect(getJournal().projects.map((p) => p.id)).toContain("real-2");
  });

  it("does not bring a plan in through a merge, and never lists it as active", () => {
    mergeRemoteProjects([proj("plan-3", { plan: true }), proj("real-3")]);
    const projects = getJournal().projects;
    expect(projects.map((p) => p.id)).toEqual(expect.arrayContaining(["real-3"]));
    expect(projects.map((p) => p.id)).not.toContain("plan-3");
    expect(activePursuits(projects, () => []).map((p) => p.id)).not.toContain("plan-3");
  });
});
