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
