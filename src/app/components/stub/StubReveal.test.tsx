// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StubFace } from "../../lib/stubFace";

const motionPref = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (orig) => ({ ...(await orig<typeof import("motion/react")>()), useReducedMotion: () => motionPref.reduce }));
import { StubReveal, TEAR_HINT, TEAR_LABEL } from "./StubReveal";

const face: StubFace = { kind: "event", title: "Clay open night", eventTitle: "Clay open night", cornerName: "Pottery", color: "var(--cat-orange)", day: "Nov 8" };

beforeEach(() => {
  vi.useFakeTimers();
  motionPref.reduce = false;
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Stub reveal", () => {
  it("waits for the person to tear the Stub off, then lands it", () => {
    render(<StubReveal face={face} onDone={() => undefined}/>);
    act(() => { vi.advanceTimersByTime(1400); });
    const handle = screen.getByRole("button", { name: TEAR_LABEL });
    expect(screen.getByText(TEAR_HINT)).toBeTruthy();
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(screen.getByRole("button", { name: TEAR_LABEL })).toBeTruthy();
    fireEvent.keyDown(handle, { key: "Enter" });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.queryByRole("button", { name: TEAR_LABEL })).toBeNull();
    expect(screen.getByRole("heading", { name: "You kept a Stub" })).toBeTruthy();
  });
  it("skips to the end on a tap outside the ticket, never on the ticket itself", () => {
    render(<StubReveal face={face} onDone={() => undefined}/>);
    act(() => { vi.advanceTimersByTime(1400); });
    fireEvent.click(screen.getByText(TEAR_HINT));
    expect(screen.queryByRole("heading", { name: "You kept a Stub" })).toBeNull();
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.getByRole("heading", { name: "You kept a Stub" })).toBeTruthy();
  });
  it("opens at rest under reduced motion, with no tearing asked", () => {
    motionPref.reduce = true;
    render(<StubReveal face={face} onDone={() => undefined}/>);
    expect(screen.getByRole("heading", { name: "You kept a Stub" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: TEAR_LABEL })).toBeNull();
  });
});
