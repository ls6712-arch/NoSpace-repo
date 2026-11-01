// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { nyTimeToMs } from "./homeWeek";
import { HELLO_KEY, NUDGE_KEY, canNudge, markFullSheetOpen, nudgePage, nyDayKey, readNudgeDay, showStubbyDock, takeHello, useFullSheetOpen, writeNudgeDay } from "./stubbyDock";

describe("showStubbyDock", () => {
  const shown = ["/my-space", "/discover", "/calendar", "/you", "/you/work/pottery", "/space/clay-club", "/corners/pottery", "/people", "/calendar/"];
  const hidden = [
    "/",
    "/onboarding",
    "/welcome",
    "/i/abc123",
    "/create",
    "/log",
    "/settings",
    "/settings/appearance",
    "/profile",
    "/account",
    "/privacy",
    "/notifications",
    "/data",
    "/pause-or-leave",
    "/admin/categories",
    "/admin/city-picks",
    "/space/clay-club/edit",
    "/login",
    "/messages",
    "/inbox",
  ];

  it.each(shown)("shows on %s when signed in", (path) => {
    expect(showStubbyDock(path, true)).toBe(true);
  });

  it.each(hidden)("hides on %s", (path) => {
    expect(showStubbyDock(path, true)).toBe(false);
  });

  it.each(shown)("hides on %s when signed out (the landing page has its own Stubby)", (path) => {
    expect(showStubbyDock(path, false)).toBe(false);
  });
});

describe("the daily nudge", () => {
  afterEach(() => window.localStorage.clear());

  it("only on Home and Calendar", () => {
    expect(nudgePage("/my-space")).toBe(true);
    expect(nudgePage("/calendar")).toBe(true);
    expect(nudgePage("/discover")).toBe(false);
  });

  it("uses the New York date, not the browser's", () => {
    // 11:30pm in New York on Nov 3 is already Nov 4 in UTC.
    expect(nyDayKey(nyTimeToMs(2026, 11, 3, 23) + 30 * 60_000)).toBe("2026-11-03");
    expect(nyDayKey(nyTimeToMs(2026, 11, 4, 0))).toBe("2026-11-04");
  });

  it("shows at most once a New York day", () => {
    const now = nyTimeToMs(2026, 11, 3, 18);
    expect(canNudge({ lastShown: null, now, asksLeft: 3, panelOpen: false })).toBe(true);
    writeNudgeDay(now);
    expect(window.localStorage.getItem(NUDGE_KEY)).toBe("2026-11-03");
    expect(canNudge({ lastShown: readNudgeDay(), now: now + 3 * 3_600_000, asksLeft: 3, panelOpen: false })).toBe(false);
    expect(canNudge({ lastShown: readNudgeDay(), now: nyTimeToMs(2026, 11, 4, 9), asksLeft: 3, panelOpen: false })).toBe(true);
  });

  it("never at 0 asks left, before the count is known, or while the panel is open", () => {
    const now = nyTimeToMs(2026, 11, 3, 18);
    expect(canNudge({ lastShown: null, now, asksLeft: 0, panelOpen: false })).toBe(false);
    expect(canNudge({ lastShown: null, now, asksLeft: null, panelOpen: false })).toBe(false);
    expect(canNudge({ lastShown: null, now, asksLeft: 2, panelOpen: true })).toBe(false);
  });
});

describe("the hello", () => {
  afterEach(() => window.sessionStorage.clear());

  it("plays once a session", () => {
    expect(takeHello()).toBe(true);
    expect(takeHello()).toBe(false);
    expect(window.sessionStorage.getItem(HELLO_KEY)).toBe("1");
  });
});

describe("full-screen sheets", () => {
  it("is open while any is open, and closing one twice does not undercount", () => {
    const { result } = renderHook(() => useFullSheetOpen());
    expect(result.current).toBe(false);
    let a = () => {};
    let b = () => {};
    act(() => {
      a = markFullSheetOpen();
      b = markFullSheetOpen();
    });
    expect(result.current).toBe(true);
    act(() => {
      a();
      a();
    });
    expect(result.current).toBe(true);
    act(() => b());
    expect(result.current).toBe(false);
  });
});
