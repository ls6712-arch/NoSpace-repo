// @vitest-environment jsdom
// Stubby plan §7: Stubby feels alive while he looks. Steps stream in, he says when he's still
// looking, Stop works, errors offer Try again, picks come in one by one, and only this ask's
// picks are shown (today's earlier ones fold away).
import { MemoryRouter } from "react-router";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AskStep, MyPick } from "../../lib/stubbyAsk";

type Call = { text: string; signal?: AbortSignal; onStep: (s: AskStep) => void; finish: (r: unknown) => void };
const calls: Call[] = [];
const api = vi.hoisted(() => ({
  askStubbyStream: vi.fn(),
  asksLeft: vi.fn(async () => 3),
  fetchMyPicks: vi.fn(async () => [] as unknown[]),
  removeMyPick: vi.fn(async () => ({ error: null })),
}));
vi.mock("../../lib/stubbyAsk", async (orig) => ({ ...(await orig<typeof import("../../lib/stubbyAsk")>()), ...api }));
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (orig) => ({ ...(await orig<typeof import("motion/react")>()), useReducedMotion: () => motion.reduced }));

import { nyTimeToMs } from "../../lib/homeWeek";
import { HELLO_KEY } from "../../lib/stubbyStage";
import { REVEAL_MS, STALL_MS } from "../stubby/AskStubby";
import { StubbyStage } from "./StubbyStage";

// A fixed clock, Date included, so "today" never straddles midnight: Sunday Nov 1, 2026, 5:00 pm New York.
const NOW = nyTimeToMs(2026, 11, 1, 17);
const DAY = 86_400_000;
const pick = (id: number, askId: number | null, over: Partial<MyPick> = {}): MyPick => ({
  id, title: `Pick ${id}`, place: "Brooklyn", startsAt: NOW + 3 * 3_600_000, endsAt: null, price: "Free", url: `https://example.com/${id}`, note: null,
  kind: "event", why: null, after: false, askId, createdAt: NOW - 60_000, ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
  window.sessionStorage.setItem(HELLO_KEY, "1");
  motion.reduced = false;
  calls.length = 0;
  for (const f of Object.values(api)) f.mockClear();
  api.asksLeft.mockResolvedValue(3);
  api.fetchMyPicks.mockResolvedValue([]);
  api.askStubbyStream.mockImplementation((text: string, o: { signal?: AbortSignal; onStep: (s: AskStep) => void }) =>
    new Promise((resolve, reject) => {
      calls.push({ text, signal: o.signal, onStep: o.onStep, finish: resolve });
      o.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.sessionStorage.clear();
});

const flush = () => act(async () => void (await Promise.resolve()));
const show = async () => {
  render(
    <MemoryRouter>
      <StubbyStage greeting={{ now: NOW, windows: [], plans: [] }} />
    </MemoryRouter>,
  );
  await flush();
  await flush();
};
const line = () => document.querySelector("[data-stubby-line]")?.textContent;
const state = () => document.querySelector("[data-stubby-stage] [data-stubby-state]")?.getAttribute("data-stubby-state");
const ask = (text = "something fun with my girlfriend tonight") => {
  fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
};
const step = (s: AskStep) => act(() => calls[calls.length - 1].onStep(s));
const steps = () => [...document.querySelectorAll("[data-stubby-steps] li")].map((li) => [li.textContent, li.hasAttribute("data-step-done")]);

describe("while he looks", () => {
  it("changes at once: his line and his face, before anything comes back", async () => {
    await show();
    ask();
    expect(line()).toBe("On it. Checking a few places.");
    expect(state()).toBe("thinking");
    expect(screen.getByRole("button", { name: "Stop" })).toBeTruthy();
  });

  it("shows what he understood as chips, then each step, ticking the one before", async () => {
    await show();
    ask();
    step({ type: "understood", understood: { when: "tonight", who: "partner", budget: null, free: false } });
    const chips = [...document.querySelectorAll("[data-stubby-understood] li")].map((li) => li.textContent);
    expect(chips).toEqual(["Tonight", "With my partner"]);
    step({ type: "search", query: "couples pottery tonight" });
    expect(steps()).toEqual([["Looking for: couples pottery tonight", false]]);
    step({ type: "pages", count: 4 });
    step({ type: "pages", count: 9 });
    step({ type: "search", query: "date night class brooklyn" });
    step({ type: "picking" });
    expect(steps()).toEqual([
      ["Looking for: couples pottery tonight", true],
      ["Checking 9 pages", true],
      ["Looking for: date night class brooklyn", true],
      ["Picking the best for you", false],
    ]);
    expect(document.querySelector("[data-stubby-steps]")!.getAttribute("aria-live")).toBe("polite");
  });

  it("says he's still looking after 12 seconds with no new step, and a new step puts it back", async () => {
    await show();
    ask();
    act(() => void vi.advanceTimersByTime(STALL_MS - 100));
    expect(line()).toBe("On it. Checking a few places.");
    act(() => void vi.advanceTimersByTime(200));
    expect(line()).toBe("Still looking. Good finds take a moment.");
    step({ type: "search", query: "pottery" });
    expect(line()).toBe("On it. Checking a few places.");
  });

  it("Stop stops listening, puts him back, and the ask still counts", async () => {
    await show();
    expect(screen.getByText("3 asks left today")).toBeTruthy();
    ask();
    step({ type: "search", query: "pottery" });
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    await flush();
    expect(calls[0].signal!.aborted).toBe(true);
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
    expect(document.querySelector("[data-stubby-steps]")).toBeNull();
    expect(state()).toBe("ready");
    expect(screen.getByText("2 asks left today")).toBeTruthy();
  });

  it("an error: he tilts, says so, and Try again asks the same thing", async () => {
    await show();
    ask("pottery tonight");
    await act(async () => calls[0].finish({ found: 0, asksLeft: null, error: "The search service is busy. Try again in a few minutes." }));
    expect(line()).toBe("Something went wrong on my end. Try again?");
    expect(state()).toBe("tilt");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(calls).toHaveLength(2);
    expect(calls[1].text).toBe("pottery tonight");
  });
});

describe("what he found", () => {
  it("comes in one by one, Stubby stamping on the first, and the count matches what's shown", async () => {
    await show();
    ask("pottery tonight");
    api.fetchMyPicks.mockResolvedValue([pick(1, 8), pick(2, 8), pick(3, 8)]);
    await act(async () => calls[0].finish({ found: 3, asksLeft: 2, error: null, outcome: "found", askId: 8 }));
    await flush();
    const shown = () => screen.queryAllByText(/^Pick \d$/).map((e) => e.textContent);
    expect(shown()).toEqual(["Pick 1"]);
    expect(state()).toBe("stamped");
    expect(screen.getByText("Found 3 things.")).toBeTruthy();
    act(() => void vi.advanceTimersByTime(REVEAL_MS));
    expect(shown()).toEqual(["Pick 1", "Pick 2"]);
    act(() => void vi.advanceTimersByTime(REVEAL_MS));
    expect(shown()).toEqual(["Pick 1", "Pick 2", "Pick 3"]);
  });

  it("under reduced motion, everything appears at once", async () => {
    motion.reduced = true;
    await show();
    ask("pottery tonight");
    api.fetchMyPicks.mockResolvedValue([pick(1, 8), pick(2, 8), pick(3, 8)]);
    await act(async () => calls[0].finish({ found: 3, asksLeft: 2, error: null, outcome: "found", askId: 8 }));
    await flush();
    expect(screen.queryAllByText(/^Pick \d$/)).toHaveLength(3);
  });

  it("shows only this ask's picks; today's earlier ones fold under Earlier today, and older ones aren't shown", async () => {
    await show();
    ask("pottery tonight");
    api.fetchMyPicks.mockResolvedValue([pick(5, 9), pick(6, 9), pick(1, 4), pick(2, 4), pick(3, 2, { createdAt: NOW - 2 * DAY, title: "From two days ago" })]);
    await act(async () => calls[0].finish({ found: 2, asksLeft: 1, error: null, outcome: "found", askId: 9 }));
    await flush();
    act(() => void vi.advanceTimersByTime(REVEAL_MS * 3));
    const current = screen.getByRole("list", { name: "Found for you" });
    expect(within(current).getAllByRole("listitem").map((li) => li.querySelector(".text-body")?.textContent)).toEqual(["Pick 5", "Pick 6"]);
    expect(screen.getByText("Found 2 things.")).toBeTruthy();
    const earlier = screen.getByRole("button", { name: "Earlier today" });
    expect(earlier.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Pick 1")).toBeNull();
    fireEvent.click(earlier);
    expect(earlier.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Pick 1")).toBeTruthy();
    expect(screen.getByText("Pick 2")).toBeTruthy();
    expect(screen.queryByText("From two days ago")).toBeNull();
  });

  it("on opening Calendar, the latest ask of today is shown and the rest of today folds away", async () => {
    api.fetchMyPicks.mockResolvedValue([pick(5, 9), pick(1, 4)]);
    await show();
    expect(screen.getByText("Pick 5")).toBeTruthy();
    expect(screen.queryByText("Pick 1")).toBeNull();
    expect(screen.getByRole("button", { name: "Earlier today" })).toBeTruthy();
  });
});
