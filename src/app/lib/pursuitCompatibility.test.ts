import { describe, expect, it } from "vitest";
import {
  compatibleProject,
  legacyContribution,
  mergeLegacyContributions,
} from "./pursuitCompatibility";
import {
  emptyWorkflowData,
  progressFor,
  validateContribution,
} from "./pursuitWorkflow";
import { measureFor } from "./pursuitWorkflowStore";
import { defaultMeasure } from "./pursuitProgress";
import type { Project, Goal, ProgressEntry } from "./journal";
const project = (patch: Partial<Project> = {}): Project => ({
  id: "old",
  ownerId: "owner",
  title: "Make ten paintings",
  startedAt: 1700000000000,
  ...patch,
});
const goal = (patch: Partial<Goal> = {}): Goal => ({
  id: "g",
  shape: "number",
  label: "Finish ten",
  targetNumber: 10,
  current: 4,
  createdAt: 1700000000000,
  ...patch,
});
const entry: ProgressEntry = {
  id: "original-text-id",
  projectId: "old",
  amount: 2,
  userId: "owner",
  createdAt: 1700000000000,
  note: "First painting",
  image: "original.jpg",
  postId: 123,
};
describe("existing Pursuits in the workflow", () => {
  it.each(["count", "quantity", "time", "custom", "milestones"] as const)(
    "keeps %s amounts, original units and starting progress",
    (kind) => {
      const measure = {
        ...defaultMeasure(kind),
        target: 10,
        unit: "paintings",
        startingAmount: 3,
        milestones: ["Sketch", "Paint"],
        whatCounts: "One finished painting",
      };
      const source = project({ measure });
      const before = JSON.stringify(source);
      const adapted = compatibleProject(source);
      const w = adapted.measure!.workflow!;
      expect(w).toMatchObject({
        tracking: "total",
        unit: "paintings",
        target: 10,
        startingAmount: 3,
        items: [],
        legacy: { kind: "measure" },
      });
      expect(
        progressFor(w, [legacyContribution(entry, "owner")], "owner").current,
      ).toBe(5);
      expect(measureFor(w)).toMatchObject({ ...measure, workflow: w });
      expect(JSON.stringify(source)).toBe(before);
    },
  );
  it("keeps the owner baseline out of friends individual progress", () => {
    const w = compatibleProject(
      project({
        ownerId: "owner",
        mode: "together",
        measure: { ...defaultMeasure("count"), startingAmount: 3 },
      }),
    ).measure!.workflow!;
    expect(progressFor(w, [], "owner").current).toBe(3);
    expect(progressFor(w, [], "friend").current).toBe(0);
    expect(progressFor(w, []).current).toBe(3);
  });
  it("retains an undated numeric baseline without inventing sessions", () => {
    const adapted = compatibleProject(project({ goal: goal() }));
    const w = adapted.measure!.workflow!;
    expect(w).toMatchObject({
      tracking: "total",
      unit: "",
      target: 10,
      startingAmount: 4,
    });
    expect(progressFor(w, []).current).toBe(4);
    expect(compatibleProject(adapted).measure!.workflow!.startingAmount).toBe(
      4,
    );
  });
  it.each(["feeling", "date"] as const)(
    "keeps %s goals as updates with their original description",
    (shape) => {
      const source = project({
        goal: goal({ shape, targetNumber: undefined, current: undefined }),
      });
      const adapted = compatibleProject(source);
      expect(adapted.measure!.workflow).toMatchObject({
        tracking: "updates",
        legacy: { kind: "updates" },
      });
      expect(adapted.goal).toEqual(source.goal);
    },
  );
  it("uses Moments for the original profile target and never calls them sessions", () => {
    expect(
      compatibleProject(project({ targetMoments: 10 })).measure!.workflow,
    ).toMatchObject({
      tracking: "total",
      unit: "Moments",
      target: 10,
      startingAmount: 0,
      legacy: { kind: "moments" },
    });
  });
  it("leaves new workflows and calendar plans untouched", () => {
    const p = project({
      measure: {
        ...defaultMeasure("count"),
        workflow: {
          version: 2,
          tracking: "sessions",
          target: 10,
          unit: "sessions",
          items: [],
        },
      },
    });
    expect(compatibleProject(p)).toBe(p);
    const plan = project({ plan: true });
    expect(compatibleProject(plan)).toBe(plan);
  });
  it("retains original identity, date, author and Moment link, even for zero amounts", () => {
    expect(legacyContribution({ ...entry, amount: 0 }, "viewer")).toMatchObject(
      {
        id: "legacy:original-text-id",
        legacy_id: entry.id,
        user_id: "owner",
        amount: 0,
        post_id: 123,
        occurred_at: new Date(entry.createdAt).toISOString(),
      },
    );
    expect(entry.image).toBe("original.jpg");
  });
  it("does not duplicate original entries on refresh", () => {
    const first = mergeLegacyContributions(
      emptyWorkflowData(),
      [entry],
      "owner",
    );
    expect(
      mergeLegacyContributions(first, [entry], "owner").contributions,
    ).toHaveLength(1);
  });
  it("keeps whole-amount rules for old measured goals", () => {
    const w = compatibleProject(
      project({
        measure: { ...defaultMeasure("count"), allowDecimals: false },
      }),
    ).measure!.workflow!;
    expect(() =>
      validateContribution(w, {
        ...legacyContribution(entry, "owner"),
        amount: 1.5,
      }),
    ).toThrow();
  });
});
