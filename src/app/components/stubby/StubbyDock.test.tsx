// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth.value }));

const api = vi.hoisted(() => ({
  askStubby: vi.fn(),
  asksLeft: vi.fn(async () => 3),
  fetchMyPicks: vi.fn(async () => [] as unknown[]),
  removeMyPick: vi.fn(async () => ({ error: null })),
}));
vi.mock("../../lib/stubbyAsk", async (orig) => ({ ...(await orig<typeof import("../../lib/stubbyAsk")>()), ...api }));

vi.mock("motion/react", async (orig) => ({ ...(await orig<typeof import("motion/react")>()), useReducedMotion: () => screenSize.reduced }));

import { StubbyDock } from "./StubbyDock";
import { StubbyDockProvider, useStubbyDock } from "./StubbyDockContext";
import { HELLO_KEY, NUDGE_DELAY_MS, NUDGE_KEY, NUDGE_SHOW_MS, nyDayKey } from "../../lib/stubbyDock";

const screenSize = vi.hoisted(() => ({ width: 390, reduced: false }));
function installMatchMedia() {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const matches = query.includes("prefers-reduced-motion") ? screenSize.reduced : min ? screenSize.width >= Number(min[1]) : false;
    return { matches, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null };
  }) as typeof window.matchMedia;
}

let opener: (() => void) | null = null;
function OpenFromPage() {
  opener = useStubbyDock().openStubby;
  return null;
}

const show = (path = "/my-space") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <StubbyDockProvider>
        <OpenFromPage />
        <StubbyDock />
      </StubbyDockProvider>
    </MemoryRouter>,
  );

const dockState = () => document.querySelector("[data-stubby-dock] [data-stubby-state]")?.getAttribute("data-stubby-state");
const dockButton = () => screen.getByRole("button", { name: "Ask Stubby", expanded: false });

beforeEach(() => {
  screenSize.width = 390;
  screenSize.reduced = false;
  installMatchMedia();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.sessionStorage.setItem(HELLO_KEY, "1");
  auth.value = { user: { id: "u1" }, profile: { display_name: "Alex" }, isConfigured: true };
  for (const f of Object.values(api)) f.mockClear();
  api.asksLeft.mockResolvedValue(3);
  api.fetchMyPicks.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("StubbyDock", () => {
  it("is a real button, with Stubby hidden from screen readers and smiling", () => {
    show();
    const b = dockButton();
    expect(b.getAttribute("aria-haspopup")).toBe("dialog");
    expect(b.getAttribute("aria-expanded")).toBe("false");
    expect(b.querySelector("[data-stubby-state]")!.getAttribute("aria-hidden")).toBe("true");
    expect(dockState()).toBe("ready");
  });

  it("is absent when signed out and on pages without the dock", () => {
    auth.value = { user: null, profile: null, isConfigured: true };
    const a = show("/my-space");
    expect(screen.queryByRole("button", { name: "Ask Stubby" })).toBeNull();
    a.unmount();
    auth.value = { user: { id: "u1" }, isConfigured: true };
    show("/settings");
    expect(screen.queryByRole("button", { name: "Ask Stubby" })).toBeNull();
  });

  it("on a phone opens the sheet, Escape closes it, and focus goes back to Stubby", async () => {
    show();
    const b = dockButton();
    b.focus();
    fireEvent.click(b);
    const dialog = await screen.findByRole("dialog", { name: "Something different?" });
    expect(b.getAttribute("aria-expanded")).toBe("true");
    // The sheet itself takes focus, not the field, so the keyboard doesn't jump up over the quick ideas.
    expect(document.activeElement).not.toBe(screen.getByLabelText("What are you after?"));
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(b));
  });

  it("on a desktop opens a side panel with the field focused; Escape returns focus to Stubby", async () => {
    screenSize.width = 1280;
    installMatchMedia();
    show();
    const b = dockButton();
    b.focus();
    fireEvent.click(b);
    const dialog = await screen.findByRole("dialog", { name: "Something different?" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("What are you after?")));
    expect(screen.getByRole("group", { name: "Quick ideas" })).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(b));
  });

  it("another screen can open the panel", async () => {
    show("/calendar");
    act(() => opener!());
    expect(await screen.findByRole("dialog", { name: "Something different?" })).toBeTruthy();
  });

  it.each([
    [{ found: 2, asksLeft: 2, error: null }, "stamped"],
    [{ found: 0, asksLeft: 2, error: null }, "shrug"],
    [{ found: 0, asksLeft: null, error: "Stubby couldn’t look just now. Try again in a bit." }, "tilt"],
  ])("after an ask (%o) the dock's Stubby shows %s", async (result, expected) => {
    let finish: (r: unknown) => void = () => {};
    api.askStubby.mockImplementation(() => new Promise((r) => (finish = r)));
    show();
    fireEvent.click(dockButton());
    fireEvent.click(await screen.findByRole("button", { name: "Free tonight" }));
    await waitFor(() => expect(dockState()).toBe("thinking"));
    await act(async () => finish(result));
    await waitFor(() => expect(dockState()).toBe(expected));
  });

  it("settles back to smiling after a reaction", async () => {
    api.askStubby.mockResolvedValue({ found: 0, asksLeft: 2, error: null });
    show();
    fireEvent.click(dockButton());
    fireEvent.click(await screen.findByRole("button", { name: "Something outdoors" }));
    await waitFor(() => expect(dockState()).toBe("shrug"));
    await waitFor(() => expect(dockState()).toBe("ready"), { timeout: 4000 });
  });

  it("says hello once a session", async () => {
    window.sessionStorage.clear();
    const a = show();
    expect(dockState()).toBe("hello");
    expect(document.querySelector("[data-stubby-dock] .border-accent")).not.toBeNull();
    a.unmount();
    show();
    expect(dockState()).toBe("ready");
    expect(document.querySelector("[data-stubby-dock] .border-accent")).toBeNull();
  });

  it("under reduced motion the hello has no ring", () => {
    screenSize.reduced = true;
    installMatchMedia();
    window.sessionStorage.clear();
    show();
    expect(document.querySelector("[data-stubby-dock] .border-accent")).toBeNull();
  });
});

describe("the daily nudge", () => {
  const nudge = () => screen.queryByRole("button", { name: "Free tonight? Ask Stubby." });
  // First let the asks-left count land (React commits it when an act ends), then wait out the 4 seconds.
  const wait4s = async () => {
    await act(() => vi.advanceTimersByTimeAsync(0));
    await act(() => vi.advanceTimersByTimeAsync(NUDGE_DELAY_MS + 10));
  };

  beforeEach(() => {
    screenSize.width = 1280;
    installMatchMedia();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-11-03T22:00:00Z"));
  });

  it("appears after 4 seconds on Home, once a New York day, and fades by itself", async () => {
    show("/my-space");
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(nudge()).toBeNull();
    await wait4s();
    expect(nudge()).not.toBeNull();
    expect(dockState()).toBe("peek");
    expect(window.localStorage.getItem(NUDGE_KEY)).toBe(nyDayKey(Date.now()));
    await act(() => vi.advanceTimersByTimeAsync(NUDGE_SHOW_MS + 1000));
    // The fade out runs on animation frames, which these fake timers don't drive.
    vi.useRealTimers();
    await waitFor(() => expect(nudge()).toBeNull());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(new Date("2026-11-03T23:00:00Z"));
    cleanup();
    show("/calendar");
    await wait4s();
    expect(nudge()).toBeNull();
  });

  it("tapping it opens the panel", async () => {
    show("/calendar");
    await wait4s();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeTruthy();
    fireEvent.click(nudge()!);
    expect(screen.getByRole("dialog", { name: "Something different?" })).toBeTruthy();
  });

  it("X dismisses it", async () => {
    show("/my-space");
    await wait4s();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    vi.useRealTimers();
    await waitFor(() => expect(nudge()).toBeNull());
  });

  it("never at 0 asks left", async () => {
    api.asksLeft.mockResolvedValue(0);
    show("/my-space");
    await wait4s();
    expect(nudge()).toBeNull();
  });

  it("never while the panel is open", async () => {
    show("/my-space");
    await act(() => vi.advanceTimersByTimeAsync(0));
    fireEvent.click(dockButton());
    await wait4s();
    expect(nudge()).toBeNull();
    expect(window.localStorage.getItem(NUDGE_KEY)).toBeNull();
  });

  it("never on a phone, where it would sit over the page, nor on other pages", async () => {
    screenSize.width = 390;
    installMatchMedia();
    const a = show("/my-space");
    await wait4s();
    expect(nudge()).toBeNull();
    a.unmount();
    screenSize.width = 1280;
    installMatchMedia();
    show("/discover");
    await wait4s();
    expect(nudge()).toBeNull();
  });
});
