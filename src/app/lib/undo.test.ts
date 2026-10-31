// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toasts = vi.hoisted(() => ({ calls: [] as { message: string; opts: { duration?: number; action?: { label: string; onClick: () => void } } }[] }));
vi.mock("sonner", () => ({ toast: (message: string, opts: never) => void toasts.calls.push({ message, opts }) }));

import { announceChange, flushPendingChanges, UNDO_MS } from "./undo";

beforeEach(() => {
  vi.useFakeTimers();
  toasts.calls = [];
});
afterEach(() => {
  flushPendingChanges();
  vi.useRealTimers();
});

describe("announceChange", () => {
  it("offers Undo for 6 seconds and sends only when they are up", () => {
    const commit = vi.fn();
    announceChange("Plan cancelled", { undo: vi.fn(), commit });
    expect(toasts.calls[0].opts.duration).toBe(UNDO_MS);
    expect(toasts.calls[0].opts.action?.label).toBe("Undo");
    vi.advanceTimersByTime(5999);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("never sends after Undo", () => {
    const commit = vi.fn();
    const undo = vi.fn();
    announceChange("Plan cancelled", { undo, commit });
    toasts.calls[0].opts.action?.onClick();
    vi.advanceTimersByTime(10_000);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
  });

  it("sends what is waiting when the tab is closed (pagehide)", () => {
    const commit = vi.fn();
    announceChange("Plan cancelled", { undo: vi.fn(), commit });
    window.dispatchEvent(new Event("pagehide"));
    expect(commit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10_000);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("sends what is waiting when the page is hidden, as a phone does when it puts a tab away", () => {
    const commit = vi.fn();
    announceChange("Block removed", { undo: vi.fn(), commit });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(commit).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("does not send what is waiting when the page only becomes visible", () => {
    const commit = vi.fn();
    announceChange("Block removed", { undo: vi.fn(), commit });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(commit).not.toHaveBeenCalled();
  });

  it("has nothing to send for a change that is already made", () => {
    const undo = vi.fn();
    announceChange("Free time added", { undo });
    expect(() => flushPendingChanges()).not.toThrow();
    expect(undo).not.toHaveBeenCalled();
  });
});

import { PENDING_KEY, readQueue, resumePendingChanges, type PersistedChange } from "./undo";

describe("the waiting queue in storage", () => {
  const change = (over: Partial<PersistedChange> = {}): PersistedChange => ({ type: "cancelPlan", userId: "u1", payload: { sessionId: 5 }, ...over });
  beforeEach(() => window.localStorage.clear());

  it("keeps a change that waits, and drops it when it has been sent", async () => {
    const commit = vi.fn(async () => undefined);
    announceChange("Plan cancelled", { undo: vi.fn(), commit, persist: change() });
    expect(readQueue()).toHaveLength(1);
    expect(readQueue()[0]).toMatchObject({ type: "cancelPlan", userId: "u1", payload: { sessionId: 5 } });
    expect(readQueue()[0].dueAt).toBeGreaterThanOrEqual(Date.now() + UNDO_MS - 50);
    await vi.advanceTimersByTimeAsync(UNDO_MS + 10);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(readQueue()).toEqual([]);
  });

  it("takes it out of storage on Undo", () => {
    announceChange("Plan cancelled", { undo: vi.fn(), commit: vi.fn(), persist: change() });
    toasts.calls[0].opts.action?.onClick();
    expect(readQueue()).toEqual([]);
  });

  it("leaves it in storage when the page is left, so a send cut short is repeated on the next load", () => {
    const commit = vi.fn(async () => undefined);
    announceChange("Plan cancelled", { undo: vi.fn(), commit, persist: change() });
    window.dispatchEvent(new Event("pagehide"));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(readQueue()).toHaveLength(1);
  });

  it("keeps a change that failed to send out of the queue once it has been reported", async () => {
    announceChange("Plan cancelled", { undo: vi.fn(), commit: async () => { throw new Error("offline"); }, persist: change() });
    await vi.advanceTimersByTimeAsync(UNDO_MS + 10);
    expect(readQueue()).toEqual([]);
  });

  it("does not queue a change that is already made (nothing to send)", () => {
    announceChange("Free time added", { undo: vi.fn(), persist: change() });
    expect(readQueue()).toEqual([]);
  });

  it("sends, on the next load, what is past its 6 seconds, and nothing else", async () => {
    const now = Date.now();
    window.localStorage.setItem(
      PENDING_KEY,
      JSON.stringify([
        { ...change({ payload: { sessionId: 1 } }), key: "old", dueAt: now - 1 },
        { ...change({ payload: { sessionId: 2 } }), key: "soon", dueAt: now + 4000 },
        { ...change({ userId: "someone-else", payload: { sessionId: 3 } }), key: "theirs", dueAt: now - 1000 },
      ]),
    );
    const run = vi.fn(async (_c: PersistedChange) => null);
    resumePendingChanges("u1", run, now);
    await vi.advanceTimersByTimeAsync(0);
    expect(run.mock.calls.map((c) => c[0].payload.sessionId)).toEqual([1]);
    // Not before its 6 seconds are up.
    await vi.advanceTimersByTimeAsync(3900);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(run.mock.calls.map((c) => c[0].payload.sessionId)).toEqual([1, 2]);
    // Another person's change is left for them.
    expect(readQueue().map((e) => e.key)).toEqual(["theirs"]);
  });

  it("sends a change only once however many times the page asks", async () => {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify([{ ...change(), key: "once", dueAt: Date.now() - 1 }]));
    const run = vi.fn(async (_c: PersistedChange) => null);
    resumePendingChanges("u1", run);
    resumePendingChanges("u1", run);
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not send what this very page is still holding", async () => {
    const commit = vi.fn(async () => undefined);
    announceChange("Plan cancelled", { undo: vi.fn(), commit, persist: change() });
    const run = vi.fn(async (_c: PersistedChange) => null);
    resumePendingChanges("u1", run, Date.now() + 60_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(run).not.toHaveBeenCalled();
  });

  it("works when storage is blocked or holds rubbish", () => {
    window.localStorage.setItem(PENDING_KEY, "{nope");
    expect(readQueue()).toEqual([]);
    window.localStorage.setItem(PENDING_KEY, JSON.stringify([{ nope: 1 }, "x"]));
    expect(readQueue()).toEqual([]);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    const commit = vi.fn(async () => undefined);
    expect(() => announceChange("Plan cancelled", { undo: vi.fn(), commit, persist: change() })).not.toThrow();
    spy.mockRestore();
  });
});
