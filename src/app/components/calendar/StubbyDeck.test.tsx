// @vitest-environment jsdom
// Stubby plan PR 3: the conversation and the deck. His one question (answered with a tap, by
// typing, or Pick a day), who you're going with remembered as a chip, the deck of cards with
// Keep, Not now, Bring it back, swipes and keys, the deck running out, Your selection and Make it
// a plan, follow-ups that add to the back, and the bring-a-friend nudge.
import { MemoryRouter } from "react-router";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AskStep, MyPick } from "../../lib/stubbyAsk";

type Opts = { signal?: AbortSignal; onStep: (s: AskStep) => void; answers?: unknown; questions?: boolean; followUp?: unknown };
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
import { StubbyStage } from "./StubbyStage";

// jsdom has no PointerEvent: a mouse event that also carries a pointer id is enough.
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "touch";
  }
}
(window as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent;

const NOW = nyTimeToMs(2026, 11, 1, 17);
const pick = (id: number, askId: number, over: Partial<MyPick> = {}): MyPick => ({
  id, title: `Pick ${id}`, place: "Brooklyn", startsAt: NOW + 3 * 3_600_000, endsAt: null, price: "Free", url: `https://example.com/${id}`, note: null,
  kind: "event", why: null, after: false, askId, createdAt: NOW - 60_000, betterWithFriend: false, cornerKey: "crafts/pottery", ...over,
});

let replies: unknown[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.sessionStorage.setItem(HELLO_KEY, "1");
  motion.reduced = false;
  replies = [];
  for (const f of Object.values(api)) f.mockReset();
  api.asksLeft.mockResolvedValue(3);
  api.fetchMyPicks.mockResolvedValue([]);
  api.removeMyPick.mockResolvedValue({ error: null });
  api.askStubbyStream.mockImplementation(async () => replies.shift() ?? { found: 0, asksLeft: 2, error: null, outcome: "nothing" });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const show = async (props: Partial<Parameters<typeof StubbyStage>[0]> = {}) => {
  render(
    <MemoryRouter>
      <StubbyStage greeting={{ now: NOW, windows: [], plans: [] }} userId="u1" {...props} />
    </MemoryRouter>,
  );
  await screen.findByLabelText("What are you in the mood for?");
  await act(async () => void (await Promise.resolve()));
};
const line = () => document.querySelector("[data-stubby-line]")?.textContent;
const state = () => document.querySelector("[data-stubby-stage] [data-stubby-state]")?.getAttribute("data-stubby-state");
const front = () => document.querySelector("[data-stubby-deck-front] .text-lead")?.textContent ?? null;
const lastOpts = () => api.askStubbyStream.mock.calls[api.askStubbyStream.mock.calls.length - 1] as [string, Opts];
const askFor = async (text: string) => {
  fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
  await act(async () => void (await Promise.resolve()));
};
/** An ask that deals a deck of these picks. */
const dealt = async (picks: MyPick[], askId = 8, text = "pottery tonight") => {
  replies.push({ found: picks.length, asksLeft: 2, error: null, outcome: "found", askId });
  api.fetchMyPicks.mockResolvedValue(picks);
  await askFor(text);
  await waitFor(() => expect(front()).toBe(picks[0].title));
};

describe("Stubby's one question", () => {
  it("asks who first, with tap answers and Surprise me; no search, no ask used", async () => {
    replies.push({ found: 0, asksLeft: 3, error: null, question: "who" });
    await show();
    await askFor("something fun");
    await waitFor(() => expect(line()).toBe("Going solo or with someone?"));
    expect(lastOpts()[1].questions).toBe(true);
    const group = screen.getByRole("group", { name: "Going solo or with someone?" });
    expect([...group.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Just me", "With my partner", "With friends", "With family", "Surprise me"]);
    expect(screen.queryByRole("group", { name: "Quick ideas" })).toBeNull();
  });

  it("a tap answers it, and who you're going with is remembered as a chip you can remove", async () => {
    replies.push({ found: 0, asksLeft: 3, error: null, question: "who" });
    await show();
    await askFor("something fun");
    await waitFor(() => screen.getByRole("button", { name: "Just me" }));
    fireEvent.click(screen.getByRole("button", { name: "Just me" }));
    await waitFor(() => expect(api.askStubbyStream).toHaveBeenCalledTimes(2));
    expect(lastOpts()[0]).toBe("something fun");
    expect(lastOpts()[1].answers).toEqual({ who: "solo" });
    expect(lastOpts()[1].questions).toBe(false);
    await waitFor(() => expect(document.querySelector("[data-stubby-who]")?.textContent).toContain("Just me"));
    // The next ask carries it.
    await askFor("pottery tonight");
    expect(lastOpts()[1].answers).toEqual({ who: "solo" });
    fireEvent.click(screen.getByRole("button", { name: "Remove: Just me" }));
    expect(document.querySelector("[data-stubby-who]")).toBeNull();
    await askFor("pottery tonight");
    expect(lastOpts()[1].answers).toBeUndefined();
  });

  it("typing an answer works too", async () => {
    replies.push({ found: 0, asksLeft: 3, error: null, question: "who" });
    await show();
    await askFor("something fun");
    await waitFor(() => screen.getByRole("group", { name: "Going solo or with someone?" }));
    await askFor("with my sister");
    expect(lastOpts()[0]).toBe("something fun, with my sister");
    expect(lastOpts()[1].answers).toEqual({ skip: true });
  });

  it("when: the chips and Pick a day", async () => {
    replies.push({ found: 0, asksLeft: 3, error: null, question: "when" });
    await show();
    await askFor("something fun with friends");
    await waitFor(() => expect(line()).toBe("When are you free?"));
    fireEvent.click(screen.getByRole("button", { name: "Pick a day" }));
    fireEvent.change(screen.getByLabelText("Pick a day"), { target: { value: "2026-11-07" } });
    await waitFor(() => expect(api.askStubbyStream).toHaveBeenCalledTimes(2));
    expect(lastOpts()[1].answers).toEqual({ when: "2026-11-07" });
  });
});

describe("the deck", () => {
  it("Keep, Not now and Bring it back, with buttons and with the arrow keys", async () => {
    await show();
    await dealt([pick(1, 8), pick(2, 8), pick(3, 8)]);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(front()).toBe("Pick 2");
    expect(state()).toBe("shrug");
    fireEvent.click(screen.getByRole("button", { name: "Bring it back" }));
    expect(front()).toBe("Pick 1");
    const card = document.querySelector("[data-stubby-deck-front]") as HTMLElement;
    fireEvent.keyDown(card, { key: "ArrowLeft" });
    expect(front()).toBe("Pick 2");
    fireEvent.keyDown(card, { key: "Backspace" });
    expect(front()).toBe("Pick 1");
    fireEvent.keyDown(card, { key: "ArrowRight" });
    expect(front()).toBe("Pick 2");
    expect(state()).toBe("stamped");
    expect(screen.getByRole("button", { name: /Pick 1/, pressed: false })).toBeTruthy();
  });

  it("shows the next cards as a stack: two behind the front one, each lower and smaller, hidden from screen readers", async () => {
    await show();
    await dealt([pick(1, 8), pick(2, 8), pick(3, 8), pick(4, 8)]);
    const behind = () => [...document.querySelectorAll<HTMLElement>("[data-stubby-deck-behind]")];
    expect(behind()).toHaveLength(2);
    expect(behind().map((b) => b.style.transform)).toEqual(["translateY(10px) scale(0.95)", "translateY(20px) scale(0.9)"]);
    expect(behind().every((b) => b.getAttribute("aria-hidden") === "true")).toBe(true);
    // Fewer cards left, a smaller stack.
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(behind()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(behind()).toHaveLength(0);
  });

  it("swipe right to keep and left for not now, the card tilting as you drag", async () => {
    await show();
    await dealt([pick(1, 8), pick(2, 8), pick(3, 8)]);
    const card = () => document.querySelector("[data-stubby-deck-front] [data-pick-kind]")!.parentElement as HTMLElement;
    fireEvent.pointerDown(card(), { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(card(), { clientX: 160, pointerId: 1 });
    expect(card().style.transform).toContain("rotate(");
    fireEvent.pointerMove(card(), { clientX: 260, pointerId: 1 });
    fireEvent.pointerUp(card(), { clientX: 260, pointerId: 1 });
    expect(front()).toBe("Pick 2");
    fireEvent.pointerDown(card(), { clientX: 300, pointerId: 1 });
    fireEvent.pointerMove(card(), { clientX: 150, pointerId: 1 });
    fireEvent.pointerUp(card(), { clientX: 150, pointerId: 1 });
    expect(front()).toBe("Pick 3");
  });

  it("runs out: Stubby says so, and See the ones you skipped refills it", async () => {
    await show();
    await dealt([pick(1, 8), pick(2, 8)]);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(front()).toBeNull();
    expect(line()).toBe("That’s all I found. Want more?");
    expect(screen.getByRole("button", { name: "Ask again" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to your selection" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "See the ones you skipped" }));
    expect(front()).toBe("Pick 2");
  });

  it("Your selection: choose some, then Make it a plan; removing one puts it back in the deck", async () => {
    const onMakePlans = vi.fn(async (picks: MyPick[]) => picks.map((p) => p.id));
    await show({ onMakePlans });
    await dealt([pick(1, 8), pick(2, 8), pick(3, 8)]);
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    const make = screen.getByRole("button", { name: "Make it a plan" }) as HTMLButtonElement;
    expect(make.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Pick 1/, pressed: false }));
    fireEvent.click(screen.getByRole("button", { name: /Pick 3/, pressed: false }));
    fireEvent.click(make);
    await waitFor(() => expect(onMakePlans).toHaveBeenCalledTimes(1));
    expect(onMakePlans.mock.calls[0][0].map((p: MyPick) => p.id)).toEqual([1, 3]);
    await waitFor(() => expect(screen.queryByRole("button", { name: /Pick 1/ })).toBeNull());
    expect(screen.getByRole("button", { name: /Pick 2/, pressed: false })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove: Pick 2" }));
    expect(screen.queryByRole("heading", { name: "Your selection" })).toBeNull();
    expect(front()).toBe("Pick 2");
  });

  it("Keep stops at 5 in Your selection", async () => {
    await show();
    await dealt([1, 2, 3, 4, 5, 6].map((i) => pick(i, 8)));
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(front()).toBe("Pick 6");
    expect((screen.getByRole("button", { name: "Keep" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("a follow-up adds cards to the back, with what was shown, and never replaces the deck", async () => {
    await show();
    await dealt([pick(1, 8), pick(2, 8)]);
    replies.push({ found: 1, asksLeft: 2, error: null, outcome: "found", askId: 8, free: true });
    api.fetchMyPicks.mockResolvedValue([pick(1, 8), pick(2, 8), pick(7, 8)]);
    fireEvent.click(screen.getByRole("button", { name: "Cheaper" }));
    await waitFor(() => expect(screen.getByText("1 of 3")).toBeTruthy());
    expect(lastOpts()[0]).toBe("pottery tonight");
    expect(lastOpts()[1].followUp).toEqual({ of: 8, kind: "cheaper", titles: ["Pick 1", "Pick 2"] });
    expect(front()).toBe("Pick 1");
    expect(["Cheaper", "Closer", "Later", "Something different", "More like this"].every((n) => screen.getByRole("button", { name: n }))).toBe(true);
  });

  it("is kept in this browser: opening Calendar again shows the same deck and selection", async () => {
    await show();
    await dealt([pick(1, 8), pick(2, 8), pick(3, 8)]);
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    cleanup();
    api.fetchMyPicks.mockResolvedValue([pick(1, 8), pick(2, 8), pick(3, 8)]);
    await show();
    await waitFor(() => expect(front()).toBe("Pick 3"));
    expect(screen.getByRole("button", { name: /Pick 1/, pressed: false })).toBeTruthy();
  });
});

describe("the bring-a-friend nudge", () => {
  it("on the card that's better with a friend: Stubby's line and Bring someone", async () => {
    const onBring = vi.fn();
    await show({ onBring });
    await dealt([pick(1, 8, { betterWithFriend: true }), pick(2, 8)]);
    expect(line()).toBe("This one’s better with a friend. Bring someone?");
    fireEvent.click(screen.getByRole("button", { name: "Bring someone" }));
    expect(onBring.mock.calls[0][0].id).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("button", { name: "Bring someone" })).toBeNull();
  });

  it("never twice in a row in one session", async () => {
    await show({ onBring: vi.fn() });
    await dealt([pick(1, 8, { betterWithFriend: true })], 8);
    expect(screen.getByRole("button", { name: "Bring someone" })).toBeTruthy();
    await dealt([pick(4, 9, { betterWithFriend: true })], 9, "climbing tonight");
    expect(screen.queryByRole("button", { name: "Bring someone" })).toBeNull();
    await dealt([pick(5, 10, { betterWithFriend: true })], 10, "running tonight");
    expect(screen.getByRole("button", { name: "Bring someone" })).toBeTruthy();
  });
});
