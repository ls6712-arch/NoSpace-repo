// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SETTLE_MS, StubbyBuddy, type StubbyBuddyHandle } from "./StubbyBuddy";

vi.mock("motion/react", () => ({ useReducedMotion: () => true }));

const state = (c: HTMLElement) => c.querySelector("[data-stubby-state]")?.getAttribute("data-stubby-state");

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("StubbyBuddy", () => {
  it("rests, thinks while waiting, and tilts when upset", () => {
    const { container, rerender } = render(<StubbyBuddy />);
    expect(state(container)).toBe("idle");
    rerender(<StubbyBuddy waiting />);
    expect(state(container)).toBe("thinking");
    rerender(<StubbyBuddy waiting upset />);
    expect(state(container)).toBe("tilt");
  });

  it("plays a reaction, then settles back to resting", () => {
    const ref = createRef<StubbyBuddyHandle>();
    const { container } = render(<StubbyBuddy ref={ref} />);
    act(() => ref.current!.react("stamped"));
    expect(state(container)).toBe("stamped");
    act(() => void vi.advanceTimersByTime(SETTLE_MS - 1));
    expect(state(container)).toBe("stamped");
    act(() => void vi.advanceTimersByTime(1));
    expect(state(container)).toBe("idle");
  });

  it("a new reaction replaces the last and restarts the clock", () => {
    const ref = createRef<StubbyBuddyHandle>();
    const { container } = render(<StubbyBuddy ref={ref} />);
    act(() => ref.current!.react("stamped"));
    act(() => void vi.advanceTimersByTime(SETTLE_MS - 100));
    act(() => ref.current!.react("shrug"));
    act(() => void vi.advanceTimersByTime(200));
    expect(state(container)).toBe("shrug");
  });

  it("is hidden from screen readers: he never talks", () => {
    const { container } = render(<StubbyBuddy />);
    expect(container.querySelector("[data-stubby-state]")!.getAttribute("aria-hidden")).toBe("true");
  });
});
