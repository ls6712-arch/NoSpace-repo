// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_TOASTS, dismissToast, getToasts, resetToasts, showToast } from "../../lib/toasts";
import { TOAST_MS } from "../../lib/motionTokens";
import { Toaster, notify, notifyError } from "./toaster";

// jsdom has no Web Animations; the fuse is a plain timer here.
type FakeAnim = { onfinish: (() => void) | null; playState: string; pause: () => void; play: () => void; cancel: () => void };
const fuses: { duration: number; easing: string; anim: FakeAnim }[] = [];
beforeEach(() => {
  resetToasts();
  fuses.length = 0;
  vi.useFakeTimers();
  HTMLElement.prototype.animate = vi.fn(function (_k: Keyframe[], opts: KeyframeAnimationOptions) {
    const anim: FakeAnim = { onfinish: null, playState: "running", pause() { this.playState = "paused"; }, play() { this.playState = "running"; }, cancel() { this.playState = "idle"; } };
    fuses.push({ duration: Number(opts.duration), easing: String(opts.easing), anim });
    return anim as unknown as Animation;
  }) as unknown as typeof HTMLElement.prototype.animate;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("toast queue", () => {
  it("keeps two open at a time: a third closes the oldest", () => {
    showToast("One"); showToast("Two"); showToast("Three");
    expect(getToasts().filter(t => t.open).map(t => t.message)).toEqual(["Two", "Three"]);
    expect(MAX_TOASTS).toBe(2);
  });
  it("defaults to TOAST_MS and closes on dismiss", () => {
    const id = showToast("Saved");
    expect(getToasts()[0].duration).toBe(TOAST_MS);
    dismissToast(id);
    expect(getToasts()[0].open).toBe(false);
  });
  it("marks errors and gives them a retry action", () => {
    const retry = vi.fn();
    notifyError("Something went wrong. Try again.", retry);
    expect(getToasts()[0]).toMatchObject({ tone: "error", action: { label: "Try again" } });
  });
});

describe("swipe toast", () => {
  it("burns a linear fuse over its time, pauses it while focused, and closes when it runs out", () => {
    render(<Toaster/>);
    act(() => notify("Link copied"));
    expect(screen.getByRole("status").textContent).toContain("Link copied");
    expect(fuses[0]).toMatchObject({ duration: TOAST_MS, easing: "linear" });
    fireEvent.focus(screen.getByRole("status"));
    expect(fuses[0].anim.playState).toBe("paused");
    fireEvent.blur(screen.getByRole("status"));
    expect(fuses[0].anim.playState).toBe("running");
    act(() => { fuses[0].anim.onfinish?.(); vi.advanceTimersByTime(1000); });
    expect(getToasts()).toHaveLength(0);
  });
  it("runs the action once and closes", () => {
    const undo = vi.fn();
    render(<Toaster/>);
    act(() => { showToast("Plan cancelled", { duration: 6000, action: { label: "Undo", onClick: undo } }); });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(getToasts()).toHaveLength(0);
  });
  it("goes away on Escape", () => {
    render(<Toaster/>);
    act(() => notify("Changes saved"));
    fireEvent.keyDown(screen.getByRole("status"), { key: "Escape" });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(getToasts()).toHaveLength(0);
  });
});
