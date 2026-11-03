// @vitest-environment jsdom
// Never a blank result (live test, Nov 2, 2026). When nothing fits, Stubby shrugs and says so, and
// the results area says it too: the honest line, why in one short line, and three ways on. And he
// asks at most one question per ask, even when the ask is tried again.
import { MemoryRouter } from "react-router";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AskStep } from "../../lib/stubbyAsk";

type Opts = { onStep: (s: AskStep) => void; answers?: Record<string, unknown>; questions?: boolean; followUp?: unknown };
const api = vi.hoisted(() => ({
  askStubbyStream: vi.fn(),
  asksLeft: vi.fn(async () => 3),
  fetchMyPicks: vi.fn(async () => [] as unknown[]),
  removeMyPick: vi.fn(async () => ({ error: null })),
}));
vi.mock("../../lib/stubbyAsk", async (orig) => ({ ...(await orig<typeof import("../../lib/stubbyAsk")>()), ...api }));
vi.mock("motion/react", async (orig) => ({ ...(await orig<typeof import("motion/react")>()), useReducedMotion: () => false }));

import { nyTimeToMs } from "../../lib/homeWeek";
import { HELLO_KEY } from "../../lib/stubbyStage";
import { reasonLine } from "../stubby/StubbyResults";
import { StubbyStage } from "./StubbyStage";

const NOW = nyTimeToMs(2026, 11, 1, 17);
let replies: unknown[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.sessionStorage.setItem(HELLO_KEY, "1");
  replies = [];
  for (const f of Object.values(api)) f.mockReset();
  api.asksLeft.mockResolvedValue(3);
  api.fetchMyPicks.mockResolvedValue([]);
  api.askStubbyStream.mockImplementation(async () => replies.shift() ?? { found: 0, asksLeft: 2, error: null, outcome: "nothing", reasons: [] });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const show = async () => {
  render(
    <MemoryRouter>
      <StubbyStage greeting={{ now: NOW, windows: [], plans: [] }} userId="u1" />
    </MemoryRouter>,
  );
  await screen.findByLabelText("What are you in the mood for?");
  await act(async () => void (await Promise.resolve()));
};
const line = () => document.querySelector("[data-stubby-line]")?.textContent;
const state = () => document.querySelector("[data-stubby-stage] [data-stubby-state]")?.getAttribute("data-stubby-state");
const calls = () => api.askStubbyStream.mock.calls as [string, Opts][];
const askFor = async (text: string) => {
  fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
  await act(async () => void (await Promise.resolve()));
};
const NOTHING = { found: 0, asksLeft: 2, error: null, outcome: "nothing", askId: 9, when: "tonight" };

describe("golden: the one candidate was dropped", () => {
  it("Stubby shrugs and says so, and the results area says it too, with why and three ways on", async () => {
    replies.push({ ...NOTHING, reasons: [{ key: "listing", count: 1 }] });
    await show();
    await askFor("pottery tonight");
    await waitFor(() => expect(line()).toBe("Nothing fit this time. Try asking another way."));
    expect(state()).toBe("shrug");
    const empty = document.querySelector("[data-stubby-empty]") as HTMLElement;
    expect(empty).not.toBeNull();
    expect(empty.textContent).toContain("Nothing fit this time. Try asking another way.");
    expect(empty.textContent).toContain("1 was a listing page");
    expect([...empty.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["This weekend", "Surprise me", "Try different words"]);
  });

  it("with no reasons to give, still the honest line and the ways on: never a blank area", async () => {
    replies.push({ ...NOTHING, reasons: [] });
    await show();
    await askFor("pottery tonight");
    const empty = await waitFor(() => document.querySelector("[data-stubby-empty]") as HTMLElement);
    expect(empty.textContent).toContain("Nothing fit this time. Try asking another way.");
    expect(empty.querySelectorAll("button")).toHaveLength(3);
  });
});

describe("the reasons", () => {
  it("read as one short line, the founder's example word for word", () => {
    expect(reasonLine([{ key: "listing", count: 2 }, { key: "midnight", count: 1 }])).toBe("2 were listing pages, 1 was after midnight");
    expect(reasonLine([{ key: "budget", count: 1 }, { key: "nopage", count: 2 }, { key: "adult", count: 3 }])).toBe("1 was over your budget, 2 had no page of their own, 3 were bars or 21+");
    expect(reasonLine([{ key: "other", count: 4 }])).toBe("");
    // No price listed is its own reason, never "over your budget". Its words wait for approval, so it isn't named yet.
    expect(reasonLine([{ key: "noprice", count: 2 }, { key: "listing", count: 1 }])).toBe("1 was a listing page");
  });
});

describe("the ways on", () => {
  it("This weekend asks the same thing for the weekend, as answered (no question)", async () => {
    replies.push({ ...NOTHING, reasons: [] });
    await show();
    await askFor("pottery tonight");
    fireEvent.click(await screen.findByRole("button", { name: "This weekend" }));
    await waitFor(() => expect(calls()).toHaveLength(2));
    expect(calls()[1][0]).toBe("pottery tonight");
    expect(calls()[1][1].answers).toEqual({ when: "weekend" });
    expect(calls()[1][1].questions).toBe(false);
  });

  it("Surprise me asks for a surprise; Try different words puts you back in the field, the ask selected", async () => {
    replies.push({ ...NOTHING, reasons: [] });
    await show();
    await askFor("pottery tonight");
    fireEvent.click(await screen.findByRole("button", { name: "Surprise me" }));
    await waitFor(() => expect(calls()).toHaveLength(2));
    expect(calls()[1][0]).toBe("Surprise me");
    expect(calls()[1][1].answers).toEqual({ skip: true });
    await waitFor(() => screen.getByRole("button", { name: "Try different words" }));
    fireEvent.click(screen.getByRole("button", { name: "Try different words" }));
    const field = screen.getByLabelText("What are you in the mood for?") as HTMLInputElement;
    expect(document.activeElement).toBe(field);
  });

  it("the soonest after, for a time other than tonight, says then", async () => {
    replies.push({ found: 1, asksLeft: 2, error: null, outcome: "after", askId: 9, when: "weekend", reasons: [] });
    api.fetchMyPicks.mockResolvedValue([
      { id: 1, title: "Tuesday wheel night", place: null, startsAt: NOW + 2 * 86_400_000, endsAt: null, price: "Free", url: "https://example.com/1", note: null, kind: "event", why: null, after: true, askId: 9, createdAt: NOW, betterWithFriend: false, cornerKey: null },
    ]);
    await show();
    await askFor("pottery this weekend");
    await waitFor(() => expect(line()).toBe("Nothing then that fits. Here’s the soonest after."));
    expect(document.querySelector("[data-stubby-empty]")).toBeNull();
    expect(screen.getByText("Tuesday wheel night")).toBeTruthy();
  });
});

describe("at most one question per ask", () => {
  it("once answered, trying the same ask again never asks it again", async () => {
    replies.push({ found: 0, asksLeft: 3, error: null, question: "who" });
    replies.push({ found: 0, asksLeft: null, error: "The search service is busy. Try again in a few minutes." });
    replies.push({ ...NOTHING, reasons: [] });
    await show();
    await askFor("something fun");
    fireEvent.click(await screen.findByRole("button", { name: "Just me" }));
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(calls()).toHaveLength(3));
    expect(calls()[2][0]).toBe("something fun");
    expect(calls()[2][1].answers).toEqual({ who: "solo" });
    // This weekend after that: still answered.
    fireEvent.click(await screen.findByRole("button", { name: "This weekend" }));
    await waitFor(() => expect(calls()).toHaveLength(4));
    expect(calls()[3][1].answers).toEqual({ who: "solo", when: "weekend" });
    // Only the very first call let him ask.
    expect(calls().filter(([, o]) => o.questions).length).toBe(1);
  });

  it("Surprise me as the answer is remembered for that ask too", async () => {
    replies.push({ found: 0, asksLeft: 3, error: null, question: "who" });
    replies.push({ ...NOTHING, reasons: [] });
    await show();
    await askFor("something fun");
    fireEvent.click(await screen.findByRole("button", { name: "Surprise me" }));
    await waitFor(() => expect(calls()).toHaveLength(2));
    fireEvent.click(await screen.findByRole("button", { name: "This weekend" }));
    await waitFor(() => expect(calls()).toHaveLength(3));
    expect(calls()[2][1].answers).toEqual({ skip: true, when: "weekend" });
    expect(calls().filter(([, o]) => o.questions).length).toBe(1);
  });
});
