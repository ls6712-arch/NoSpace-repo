import { describe, expect, it } from "vitest";
import {
  canChangeTracking,
  progressFor,
  validateContribution,
  validateWorkflow,
  weeklyOccurrences,
  shiftOccurrence,
  type Contribution,
  type Workflow,
} from "./pursuitWorkflow";
const workflow = (patch: Partial<Workflow> = {}): Workflow => ({
  version: 2,
  tracking: "sessions",
  target: 10,
  unit: "sessions",
  items: [],
  ...patch,
});
const entry = (patch: Partial<Contribution> = {}): Contribution => ({
  id: "a",
  pursuit_id: "p",
  user_id: "one",
  amount: 1,
  occurred_at: "2026-11-05T12:00:00Z",
  created_at: "2026-11-05T12:00:00Z",
  note: "",
  ...patch,
});
describe("Pursuit workflow calculations", () => {
  it("counts separate sessions on the same day", () => {
    expect(progressFor(workflow(), [entry(), entry({ id: "b" })]).current).toBe(
      2,
    );
  });
  it("keeps actual progress above the target while clamping only the bar", () => {
    const s = progressFor(workflow({ target: 1 }), [
      entry(),
      entry({ id: "b" }),
    ]);
    expect(s).toMatchObject({
      current: 2,
      target: 1,
      fraction: 1,
      reached: true,
    });
  });
  it("does not treat finishing below target as reaching it", () => {
    expect(progressFor(workflow(), [entry()])).toMatchObject({
      current: 1,
      target: 10,
      reached: false,
    });
  });
  it("separates individual contributions and targets", () => {
    const rows = [entry(), entry({ id: "b", user_id: "two" })];
    expect(progressFor(workflow(), rows, "one", 6)).toMatchObject({
      current: 1,
      target: 6,
    });
    expect(progressFor(workflow(), rows).current).toBe(2);
  });
  it("supports explicitly clearing a personal target", () => {
    expect(
      progressFor(workflow(), [entry()], "one", null).target,
    ).toBeUndefined();
  });
  it("sums quantities, including decimals", () => {
    expect(
      progressFor(workflow({ tracking: "total", unit: "hours" }), [
        entry({ amount: 1.5 }),
        entry({ amount: 0.5 }),
      ]).current,
    ).toBe(2);
  });
  it("counts checklist identities instead of amounts, excluding archived items", () => {
    const w = workflow({
      tracking: "checklist",
      items: [
        { id: "x", title: "First" },
        { id: "y", title: "Old", archived: true },
      ],
    });
    expect(
      progressFor(w, [
        entry({ item_id: "x" }),
        entry({ id: "b", item_id: "x" }),
        entry({ id: "c", item_id: "y" }),
      ]),
    ).toMatchObject({ current: 1, target: 1 });
  });
  it("does not invent a denominator for ongoing updates", () => {
    expect(progressFor(workflow({ tracking: "updates" }), [])).toMatchObject({
      target: undefined,
      reached: false,
    });
  });
  it("locks tracking and units after progress, but allows target edits", () => {
    const w = workflow();
    expect(canChangeTracking(w, { ...w, target: 8 }, [entry()])).toBe(true);
    expect(canChangeTracking(w, { ...w, tracking: "total" }, [entry()])).toBe(
      false,
    );
    expect(canChangeTracking(w, { ...w, unit: "hours" }, [entry()])).toBe(
      false,
    );
  });
});
describe("Pursuit workflow input", () => {
  it.each([NaN, Infinity, -1, 0, 1.5])(
    "rejects invalid session target %s",
    (target) => {
      expect(validateWorkflow(workflow({ target }))).not.toBeNull();
    },
  );
  it("requires a unit for totals and an item for checklists", () => {
    expect(
      validateWorkflow(workflow({ tracking: "total", unit: "" })),
    ).not.toBeNull();
    expect(
      validateWorkflow(workflow({ tracking: "checklist" })),
    ).not.toBeNull();
  });
  it("rejects impossible calendar dates", () => {
    expect(
      validateWorkflow(workflow({ finishBy: "2026-02-30" })),
    ).not.toBeNull();
  });
  it("rejects non-finite amounts and invalid checklist references", () => {
    expect(() =>
      validateContribution(workflow(), entry({ amount: NaN })),
    ).toThrow();
    expect(() =>
      validateContribution(
        workflow({ tracking: "checklist" }),
        entry({ item_id: "missing" }),
      ),
    ).toThrow();
  });
  it("does not force a date or target", () => {
    expect(validateWorkflow(workflow({ target: undefined }))).toBeNull();
  });
  it("preserves a weekly wall-clock schedule across DST", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const rows = weeklyOccurrences("2026-10-25T15:00", "2026-11-08");
      expect(rows).toEqual([
        "2026-10-25T19:00:00.000Z",
        "2026-11-01T20:00:00.000Z",
        "2026-11-08T20:00:00.000Z",
      ]);
    } finally {
      process.env.TZ = previous;
    }
  });
  it("rejects an invalid repeat range", () => {
    expect(() => weeklyOccurrences("2026-11-05T15:00", "2026-11-01")).toThrow();
  });
});

describe("weekly series edits", () => {
  it("moves future wall times correctly when an occurrence crosses DST", () => {
    expect(
      shiftOccurrence(
        "2026-10-25T19:00:00Z",
        "2026-10-25T19:00:00Z",
        "2026-10-26T19:00:00Z",
        "America/New_York",
      ),
    ).toBe("2026-10-26T19:00:00.000Z");
    expect(
      shiftOccurrence(
        "2026-11-01T20:00:00Z",
        "2026-10-25T19:00:00Z",
        "2026-10-26T19:00:00Z",
        "America/New_York",
      ),
    ).toBe("2026-11-02T20:00:00.000Z");
  });
  it("rejects a nonexistent local time rather than silently shifting the series", () => {
    expect(() =>
      shiftOccurrence(
        "2026-03-08T07:30:00Z",
        "2026-03-01T07:30:00Z",
        "2026-03-01T07:30:00Z",
        "America/New_York",
      ),
    ).toThrow();
  });
});
