// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Stubby, type StubbyState } from "./Stubby";

let reduced = false;
vi.mock("motion/react", () => ({ useReducedMotion: () => reduced }));

const STATES: StubbyState[] = [
  "idle", "stamped", "unstamped", "yours", "shrug", "torn", "rejoined", "tilt",
  "arrived", "knock", "checkedIn", "done", "letGo", "sleep", "thinking", "cool",
  "ready", "hello", "eager", "excited", "peek",
];

// jsdom has no Web Animations API. Each animation is a promise the test can hold open.
let started: number;
let gate: { open: boolean; waiting: (() => void)[] };
function installAnimations() {
  started = 0;
  gate = { open: true, waiting: [] };
  const animate = function () {
    started += 1;
    const finished = new Promise<void>((resolve) => (gate.open ? resolve() : gate.waiting.push(resolve)));
    return { finished, cancel() {}, commitStyles() {}, pause() {}, play() {} };
  };
  Element.prototype.animate = animate as unknown as Element["animate"];
  Element.prototype.getAnimations = () => [];
}

const settleAll = () => act(() => vi.advanceTimersByTimeAsync(10_000));
// The grin is the mouth of the happy face (mid-reaction); a ripped body is what "torn" leaves behind.
const GRIN = 'path[d="M80 84 Q94 102 108 84 Z"]';
const RIPPED = 'path[d^="M 26 14 H 166"]';
const has = (container: HTMLElement, selector: string) => !!container.querySelector(selector);

beforeEach(() => {
  reduced = false;
  installAnimations();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Stubby", () => {
  it("rests its idle life while the tab is hidden, and wakes again", async () => {
    render(<Stubby state="idle" />);
    await settleAll();
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    const before = started;
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(started).toBe(before);
    hidden.mockReturnValue(false);
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(started).toBeGreaterThan(before);
    hidden.mockRestore();
  });

  it.each(STATES)("renders the %s state without throwing", async (state) => {
    const { container, unmount } = render(<Stubby state={state} size={160} />);
    await settleAll();
    expect(container.querySelector("svg")).not.toBeNull();
    unmount();
  });

  it("renders every state in the reduced-motion and mark sizes too", () => {
    for (const state of STATES) {
      reduced = true;
      const a = render(<Stubby state={state} />);
      a.unmount();
      reduced = false;
      const b = render(<Stubby state={state} size={28} />);
      b.unmount();
    }
  });

  it("starts no animation under reduced motion, and still shows the state's stamp", async () => {
    reduced = true;
    const { container, rerender } = render(<Stubby state="idle" />);
    expect(has(container, '[stroke-dasharray="3.5 4"]')).toBe(true);
    rerender(<Stubby state="stamped" />);
    await settleAll();
    expect(has(container, '[stroke-dasharray="3.5 4"]')).toBe(false);
    rerender(<Stubby state="torn" />);
    await settleAll();
    expect(started).toBe(0);
    expect(has(container, RIPPED)).toBe(true);
  });

  it("in the dock: under reduced motion the hello is the happy face, with no hop", async () => {
    reduced = true;
    const { container, rerender } = render(<Stubby state="ready" />);
    expect(has(container, GRIN)).toBe(true);
    rerender(<Stubby state="hello" />);
    await settleAll();
    expect(started).toBe(0);
    expect(has(container, GRIN)).toBe(true);
  });

  it("in the dock: the hello hops, then he rests smiling", async () => {
    const { container, rerender } = render(<Stubby state="ready" />);
    await settleAll();
    const before = started;
    rerender(<Stubby state="hello" />);
    await settleAll();
    expect(started).toBeGreaterThan(before);
    expect(has(container, GRIN)).toBe(true);
  });

  it("starts no animation for the mark", async () => {
    const { rerender } = render(<Stubby state="idle" size={28} />);
    rerender(<Stubby state="stamped" size={28} />);
    await settleAll();
    expect(started).toBe(0);
  });

  it("plays a second state after the first reaction, not on top of it", async () => {
    gate.open = false;
    const { container, rerender } = render(<Stubby state="idle" />);
    rerender(<Stubby state="stamped" />);
    await settleAll();
    expect(has(container, GRIN)).toBe(true);

    rerender(<Stubby state="torn" />);
    await settleAll();
    // The stamp reaction is still holding its first animation, so the tear has not started.
    expect(has(container, RIPPED)).toBe(false);
    expect(has(container, GRIN)).toBe(true);

    gate.open = true;
    for (let i = 0; i < 40; i++) {
      gate.waiting.splice(0).forEach((resolve) => resolve());
      await settleAll();
    }
    expect(has(container, RIPPED)).toBe(true);
  });

  it("is decoration unless a tap does something", () => {
    const plain = render(<Stubby />);
    expect(plain.container.querySelector("button")).toBeNull();
    expect(plain.container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    plain.unmount();
    const poke = render(<Stubby onPoke={() => {}} />);
    expect(poke.container.querySelector("button")).not.toBeNull();
  });
});
