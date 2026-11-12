import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../lib/supabase", () => ({ supabase: null }));
import {
  localWorkflow,
  measureFor,
  recordWorkflowMoment,
  removeWorkflowMoment,
  storeLocalWorkflow,
} from "./pursuitWorkflowStore";
import { emptyWorkflowData, type Workflow } from "./pursuitWorkflow";
import {
  addJoinedProject,
  getJournal,
  projectWorkflowProgress,
  pursuitStatus,
  type Project,
} from "./journal";
const w: Workflow = {
  version: 2,
  tracking: "sessions",
  target: 10,
  unit: "sessions",
  items: [],
};
const project: Project = {
  id: "moment-test",
  title: "Practice",
  startedAt: 0,
  mode: "solo",
  measure: measureFor(w),
};
beforeEach(() => {
  const map = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => map.set(k, v),
    removeItem: (k: string) => map.delete(k),
  });
  storeLocalWorkflow(project.id, emptyWorkflowData());
});
describe("Moment progress integration", () => {
  it("counts the same Moment only once across retries", async () => {
    const a = await recordWorkflowMoment(
      project,
      1,
      undefined,
      123,
      undefined,
      "Played",
    );
    const b = await recordWorkflowMoment(
      project,
      1,
      undefined,
      123,
      undefined,
      "Played",
    );
    expect(a!.id).toBe(b!.id);
    expect(localWorkflow(project.id).contributions).toHaveLength(1);
  });
  it("never copies a private Moment note into group progress", async () => {
    const row = await recordWorkflowMoment(
      { ...project, mode: "together" },
      1,
      undefined,
      undefined,
      456,
      "Private text",
    );
    expect(row!.note).toBe("");
    expect(row!.post_id).toBeNull();
  });
  it("undo removes the linked contribution", async () => {
    const row = await recordWorkflowMoment(project, 1, undefined, 123);
    await removeWorkflowMoment(project.id, row!.id, false);
    expect(localWorkflow(project.id).contributions).toHaveLength(0);
  });
  it("does not count updates-only or checklist Moments as numerical entries", async () => {
    expect(
      await recordWorkflowMoment(
        { ...project, measure: measureFor({ ...w, tracking: "updates" }) },
        1,
        undefined,
        123,
      ),
    ).toBeNull();
  });
  it("does not claim a local save when storage fails", async () => {
    localStorage.setItem = () => {
      throw Error("Storage full");
    };
    await expect(
      recordWorkflowMoment(project, 1, undefined, 123),
    ).rejects.toThrow("Storage full");
    expect(localWorkflow(project.id).contributions).toHaveLength(0);
  });
  it("keeps Shelf progress in sync without finishing the group", () => {
    addJoinedProject(project);
    projectWorkflowProgress(
      project.id,
      [{ id: "one", projectId: project.id, amount: 1, createdAt: 1 }],
      {
        pursuit_id: project.id,
        user_id: "local",
        target: 8,
        finish_by: null,
        status: "finished",
        muted: false,
      },
    );
    const p = getJournal().projects.find((p) => p.id === project.id)!;
    expect(p.measure!.target).toBe(8);
    expect(p.finishedAt).toBeUndefined();
    expect(pursuitStatus(p)).toBe("complete");
  });
});

it('does not copy a followers-only caption into group progress', async () => {
  const row = await recordWorkflowMoment({ ...project, mode: 'together' }, 1, undefined, 789, undefined, 'For followers only');
  expect(row!.note).toBe('');
});
