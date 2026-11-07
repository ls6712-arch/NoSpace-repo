// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ state: "idle" as "idle" | "loading" }));
vi.mock("react-router", () => ({ useNavigation: () => ({ state: nav.state }) }));

import { SLOW_NAVIGATION_MS, useSlowNavigation } from "./useSlowNavigation";

afterEach(() => {
  vi.useRealTimers();
  nav.state = "idle";
});

describe("useSlowNavigation", () => {
  it("stays off for a fast page change", () => {
    vi.useFakeTimers();
    nav.state = "loading";
    const { result, rerender } = renderHook(() => useSlowNavigation());
    act(() => void vi.advanceTimersByTime(SLOW_NAVIGATION_MS - 1));
    expect(result.current).toBe(false);
    nav.state = "idle";
    rerender();
    act(() => void vi.advanceTimersByTime(500));
    expect(result.current).toBe(false);
  });

  it("turns on after 150 ms of loading and off when it ends", () => {
    vi.useFakeTimers();
    nav.state = "loading";
    const { result, rerender } = renderHook(() => useSlowNavigation());
    act(() => void vi.advanceTimersByTime(SLOW_NAVIGATION_MS));
    expect(result.current).toBe(true);
    nav.state = "idle";
    rerender();
    expect(result.current).toBe(false);
  });
});
