// @vitest-environment jsdom
import { createRef } from "react";
import { MemoryRouter } from "react-router";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  askStubbyStream: vi.fn(),
  asksLeft: vi.fn(async () => 3),
  fetchMyPicks: vi.fn(async () => [] as unknown[]),
  removeMyPick: vi.fn(async () => ({ error: null, askId: 7 })),
}));
vi.mock("../../lib/stubbyAsk", async (orig) => ({ ...(await orig<typeof import("../../lib/stubbyAsk")>()), ...api }));
const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (orig) => ({ ...(await orig<typeof import("motion/react")>()), useReducedMotion: () => motion.reduced }));

import { nyTimeToMs } from "../../lib/homeWeek";
import { HELLO_KEY } from "../../lib/stubbyStage";
import { SETTLE_MS } from "../stubby/StubbyBuddy";
import { StubbyStage, type StubbyStageHandle } from "./StubbyStage";

// Fixed clock: Sunday Nov 1, 2026, 5:00 pm New York.
const NOW = nyTimeToMs(2026, 11, 1, 17);
const pick = { id: 9, title: "Wheel night", place: "Greenpoint, Brooklyn", startsAt: NOW + 7_200_000, endsAt: null, price: "$35", url: "https://example.com/wheel", note: null, kind: "event" as const, why: null, after: false, askId: 7, createdAt: NOW };

// IntersectionObserver, driven by hand.
let observed: ((entries: Partial<IntersectionObserverEntry>[]) => void) | null = null;
class FakeObserver {
  constructor(cb: (entries: Partial<IntersectionObserverEntry>[]) => void) {
    observed = cb;
  }
  observe() {}
  disconnect() {}
}

beforeEach(() => {
  // Date only (timers stay real): "today" is the fixed clock's day, never a midnight straddle.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = FakeObserver;
  observed = null;
  motion.reduced = false;
  window.sessionStorage.setItem(HELLO_KEY, "1");
  for (const f of Object.values(api)) f.mockClear();
  api.asksLeft.mockResolvedValue(3);
  api.fetchMyPicks.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.sessionStorage.clear();
});

const stage = (over: Partial<Parameters<typeof StubbyStage>[0]> = {}, ref = createRef<StubbyStageHandle>()) => {
  render(
    <MemoryRouter>
      <StubbyStage ref={ref} greeting={{ now: NOW, windows: ["sun-eve"], plans: [] }} {...over} />
    </MemoryRouter>,
  );
  return ref;
};
const line = () => document.querySelector("[data-stubby-line]")?.textContent;
const state = () => document.querySelector("[data-stubby-stage] [data-stubby-state]")?.getAttribute("data-stubby-state");

describe("the Stubby stage", () => {
  it("greets with a line about your week, read out as text, with Stubby himself hidden", async () => {
    stage();
    await waitFor(() => expect(line()).toBe("You’re free tonight from 6. Want ideas?"));
    expect(document.querySelector("[data-stubby-line]")!.getAttribute("aria-live")).toBe("polite");
    expect(document.querySelector("[data-stubby-state]")!.getAttribute("aria-hidden")).toBe("true");
    expect(state()).toBe("ready");
  });

  it("thinks while Calendar loads and tilts when it couldn't", () => {
    stage({ loading: true });
    expect(state()).toBe("thinking");
    cleanup();
    stage({ failed: true });
    expect(state()).toBe("tilt");
  });

  it("an ask: he says he's on it and thinks, then stamps, and the results land inline under the stage", async () => {
    let finish: (v: unknown) => void = () => {};
    api.askStubbyStream.mockReturnValue(new Promise((r) => (finish = r)));
    stage();
    await screen.findByText("3 asks left today");
    fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: "pottery" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    expect(line()).toBe("On it. Checking a few places.");
    expect(state()).toBe("thinking");
    api.fetchMyPicks.mockResolvedValue([pick]);
    await act(async () => finish({ found: 1, asksLeft: 2, error: null, askId: 7 }));
    await screen.findByText("Wheel night");
    expect(line()).toBe("Here’s what I’d pick for you.");
    expect(state()).toBe("stamped");
    expect(screen.queryByRole("dialog")).toBeNull();
    const results = document.querySelector("[data-stubby-results]")!;
    expect(results.contains(screen.getByText("Wheel night"))).toBe(true);
    const stageEl = document.querySelector("[data-stubby-stage]")!;
    expect(stageEl.contains(results)).toBe(false);
    expect(stageEl.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("nothing fits: he shrugs and says so honestly", async () => {
    api.askStubbyStream.mockResolvedValue({ found: 0, asksLeft: 2, error: null, askId: 7 });
    stage();
    await screen.findByText("3 asks left today");
    fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: "underwater chess" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    await waitFor(() => expect(line()).toBe("Nothing fit this time. Try asking another way."));
    expect(state()).toBe("shrug");
  });

  it("an error: he tilts and gives his error line", async () => {
    api.askStubbyStream.mockResolvedValue({ found: 0, asksLeft: null, error: "The scout is switched off." });
    stage();
    await screen.findByText("3 asks left today");
    fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: "running" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    await waitFor(() => expect(line()).toBe("Something went wrong on my end. Try again?"));
    expect(screen.getByRole("alert").textContent).toBe("The scout is switched off.");
    expect(state()).toBe("tilt");
  });

  it("at 0 asks left he says so, and the field is off", async () => {
    api.asksLeft.mockResolvedValue(0);
    stage();
    await waitFor(() => expect(line()).toBe("That’s 3 for today. I’ll look again tomorrow."));
    expect((screen.getByLabelText("What are you in the mood for?") as HTMLInputElement).disabled).toBe(true);
  });

  it("plays what the page asks for (Keep, Not this, a torn tab, an error), then settles back to smiling", () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.setSystemTime(NOW);
    const ref = stage();
    for (const r of ["stamped", "shrug", "torn", "tilt"] as const) {
      act(() => ref.current!.react(r));
      expect(state()).toBe(r);
      act(() => void vi.advanceTimersByTime(SETTLE_MS + 10));
      expect(state()).toBe("ready");
    }
  });
});

describe("the sticky bar", () => {
  const scrollPast = (past: boolean) => act(() => observed?.([{ isIntersecting: !past, boundingClientRect: { bottom: past ? -10 : 200 } as DOMRect }]));

  it("appears once the stage scrolls out of view, and brings you back to the field", async () => {
    stage();
    await screen.findByText("3 asks left today");
    expect(document.querySelector("[data-stubby-sticky]")).toBeNull();
    scrollPast(true);
    const bar = screen.getByRole("button", { name: "Ask Stubby…" });
    fireEvent.click(bar);
    expect(document.activeElement).toBe(screen.getByLabelText("What are you in the mood for?"));
    scrollPast(false);
    expect(document.querySelector("[data-stubby-sticky]")).toBeNull();
  });

  it("steps aside while a sheet is open", () => {
    stage({ sheetOpen: true });
    scrollPast(true);
    expect(document.querySelector("[data-stubby-sticky]")).toBeNull();
  });
});

describe("hello", () => {
  it("hops once a session", () => {
    window.sessionStorage.clear();
    stage();
    expect(state()).toBe("hello");
    cleanup();
    stage();
    expect(state()).toBe("ready");
  });

  it("under reduced motion: no ring", () => {
    window.sessionStorage.clear();
    motion.reduced = true;
    stage();
    expect(document.querySelector("[data-stubby-stage] .border-accent")).toBeNull();
  });
});

describe("smarter picks on the stage", () => {
  const ask = async (text = "something fun with my girlfriend tonight") => {
    await screen.findByText("3 asks left today");
    fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
  };

  it("nothing fit tonight: he shrugs and says so, and the soonest after are shown with no count", async () => {
    api.askStubbyStream.mockResolvedValue({ found: 1, asksLeft: 2, error: null, outcome: "after", askId: 7, when: "tonight" });
    api.fetchMyPicks.mockResolvedValue([{ ...pick, kind: "event", why: "A class for two, near you.", after: true }]);
    stage();
    await ask();
    await waitFor(() => expect(line()).toBe("Nothing tonight that fits. Here’s the soonest after."));
    expect(state()).toBe("shrug");
    expect(screen.queryByText(/^Found \d/)).toBeNull();
    expect(screen.getByText("A class for two, near you.")).toBeTruthy();
  });

  it("an idea is labelled An idea, shows no date, and its Soosh page opens in the app", async () => {
    api.askStubbyStream.mockResolvedValue({ found: 2, asksLeft: 2, error: null, outcome: "found", askId: 7 });
    api.fetchMyPicks.mockResolvedValue([
      { ...pick, kind: "event", why: "Coming alone is normal here.", after: false },
      { id: 10, title: "An easy evening run", place: "Hudson River Park", startsAt: NOW + 3_600_000, endsAt: null, price: null, url: "/start/sports-fitness/running", note: null, kind: "idea", why: "A short loop, no booking.", after: false, askId: 7, createdAt: NOW },
    ]);
    stage();
    await ask("something to do tonight on my own");
    // The deck shows one card at a time: the event first, then the idea after Not now.
    const event = (await screen.findByText("Wheel night")).closest("[data-pick-kind]")!;
    expect(event.textContent).toContain("Stubby’s pick");
    expect(event.textContent).not.toContain("Found for you");
    expect(event.textContent).toContain("Coming alone is normal here.");
    expect(event.querySelector("a")!.getAttribute("target")).toBe("_blank");
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    const idea = (await screen.findByText("An easy evening run")).closest("[data-pick-kind]")!;
    expect(idea.getAttribute("data-pick-kind")).toBe("idea");
    expect(idea.textContent).toContain("An idea");
    expect(idea.textContent).toContain("Hudson River Park");
    expect(idea.textContent).not.toMatch(/PM|AM/);
    const open = idea.querySelector("a")!;
    expect(open.getAttribute("href")).toBe("/start/sports-fitness/running");
    expect(open.getAttribute("target")).toBeNull();
  });
});

describe("the ask on a phone", () => {
  it("shows asks left beside the field, inside the form", async () => {
    stage();
    const left = await screen.findByText("3 asks left today");
    expect(left.closest("form")).not.toBeNull();
  });

  it("puts the quick ideas on one row that scrolls sideways (wrapping from 744px)", async () => {
    stage();
    const row = await screen.findByRole("group", { name: "Quick ideas" });
    expect(row.className).toContain("overflow-x-auto");
    expect(row.className).toContain("tab:flex-wrap");
    expect(row.className).not.toMatch(/(^| )flex-wrap/);
  });

  it("doesn't repeat \"What are you in the mood for?\" as the label when his line already asks it", async () => {
    render(
      <MemoryRouter>
        <StubbyStage greeting={{ now: NOW, windows: [], plans: [] }} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(line()).toBe("What are you in the mood for?"));
    const label = document.querySelector("label")!;
    expect(label.className).toContain("sr-only");
    // Still the field's name for screen readers.
    expect(screen.getByLabelText("What are you in the mood for?")).toBeTruthy();
  });

  it("shows the label when his line says something else", async () => {
    stage();
    await waitFor(() => expect(line()).toBe("You’re free tonight from 6. Want ideas?"));
    expect(document.querySelector("label")!.className).not.toContain("sr-only");
  });
});

