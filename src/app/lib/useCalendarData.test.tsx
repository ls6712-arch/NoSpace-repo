// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useCalendarData } from "./useCalendarData";
const fetch = vi.hoisted(() => vi.fn());
vi.mock("./weekPlans", () => ({
  fetchWeekDetail: (...args: unknown[]) => fetch(...args),
}));
vi.mock("./stubs", () => ({ fetchMyStubs: async () => [] }));
const plan = {
  id: "meeting-1",
  title: "Practice",
  startsAt: 1,
  kind: "session",
  color: "orange",
  going: { friends: [], total: 1 },
};
beforeEach(() => {
  fetch.mockReset().mockResolvedValue([plan]);
  Object.defineProperty(document, "hidden", {
    value: false,
    configurable: true,
  });
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("live Calendar range reads", () => {
  it("accepts an empty refreshed answer instead of retaining a cancelled plan", async () => {
    const { result } = renderHook(() => useCalendarData("me", 0, 100));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.loaded).toBe(true);
    fetch.mockResolvedValue([]);
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(result.current.plans).toEqual([]);
    expect(result.current.loaded).toBe(true);
  });
  it("keeps the last trusted answer with an error when refresh fails", async () => {
    const { result } = renderHook(() => useCalendarData("me", 0, 100));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.loaded).toBe(true);
    fetch.mockRejectedValue(new Error("Offline"));
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(result.current.failed).toBe(true);
    expect(result.current.plans).toHaveLength(1);
  });
  it("does not let an older request resurrect a cancelled plan", async () => {
    let old!: (rows: unknown[]) => void;
    fetch.mockImplementationOnce(
      () =>
        new Promise((r) => {
          old = r;
        }),
    );
    const { result } = renderHook(() => useCalendarData("me", 0, 100));
    fetch.mockResolvedValue([]);
    await act(async () => window.dispatchEvent(new Event("focus")));
    await act(async () => old([plan]));
    expect(result.current.plans).toEqual([]);
  });
  it("polls only while visible and refreshes on return", async () => {
    const { result } = renderHook(() => useCalendarData("me", 0, 100));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.loaded).toBe(true);
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    await act(async () => vi.advanceTimersByTime(15000));
    expect(fetch).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "hidden", {
      value: false,
      configurable: true,
    });
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
