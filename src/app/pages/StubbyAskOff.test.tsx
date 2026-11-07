// @vitest-environment jsdom
import { act, cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Ask Stubby off, as on the live site (config.ts, founder, Nov 6, 2026).
vi.mock("../config", async (orig) => ({ ...(await orig<typeof import("../config")>()), stubbyAskEnabled: false }));

const api = vi.hoisted(() => ({
  askStubbyStream: vi.fn(),
  asksLeft: vi.fn(async () => 3),
  fetchMyPicks: vi.fn(async () => [] as unknown[]),
}));
vi.mock("../lib/stubbyAsk", async (orig) => ({ ...(await orig<typeof import("../lib/stubbyAsk")>()), ...api }));
const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth.value }));
const hook = vi.hoisted(() => ({ value: {} as unknown }));
vi.mock("../lib/useWeekData", () => ({ useWeekData: () => hook.value }));
vi.mock("../lib/useCalendarData", () => ({ useCalendarData: () => ({ plans: [], stubs: [], failed: false }) }));
vi.mock("../lib/calendarEntries", async (orig) => ({ ...(await orig<typeof import("../lib/calendarEntries")>()), fetchEntries: vi.fn(async () => []) }));
vi.mock("motion/mini", () => ({ animate: vi.fn(() => ({ cancel: vi.fn() })) }));

import { nyTimeToMs, windowsLeft } from "../lib/homeWeek";
import { Calendar } from "./Calendar";
import { Landing } from "../landing/Landing";
import { LANDING_COPY } from "../landing/copy";

const NOW = nyTimeToMs(2026, 10, 30, 12);
const windows = ["fri-eve"];

beforeEach(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  auth.value = { user: { id: "u1" }, profile: { display_name: "Alex" }, isConfigured: true };
  hook.value = { status: "ready", now: NOW, windows, left: windowsLeft(windows, NOW), budget: 50, passes: [], plans: [], picks: [], goodHours: 0, reload: vi.fn(), saveBudget: vi.fn() };
  api.askStubbyStream.mockClear();
});
afterEach(cleanup);

const at = async (url: string) => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/onboarding" element={<p>Onboarding</p>} />
        </Routes>
      </MemoryRouter>,
    );
  });
};

describe("with Ask Stubby off", () => {
  it("keeps Stubby on the calendar, with no field, no line, no sticky bar and no search", async () => {
    await at("/calendar?view=week");
    const stage = document.querySelector("[data-stubby-stage]");
    expect(stage).toBeTruthy();
    expect(stage?.querySelector("[data-stubby-state]")).toBeTruthy();
    expect(screen.queryByLabelText("What are you in the mood for?")).toBeNull();
    expect(document.querySelector("[data-stubby-line]")).toBeNull();
    expect(document.querySelector("[data-stubby-sticky]")).toBeNull();
    expect(api.askStubbyStream).not.toHaveBeenCalled();
    // The calendar itself is still there.
    expect(screen.getByRole("button", { name: "Today" })).toBeTruthy();
  });

  it("sends someone who is signed out to sign-up instead of guest Stubby", async () => {
    auth.value = { user: null, isConfigured: true };
    await at("/calendar");
    expect(screen.getByText("Onboarding")).toBeTruthy();
  });

  it("points the landing page's main button at sign-up, with no line about asking Stubby", async () => {
    await at("/");
    expect(document.querySelector(".lp")?.textContent).not.toMatch(/Ask Stubby|asking Stubby|Start with Stubby/);
    fireEvent.click(screen.getAllByRole("link", { name: LANDING_COPY.heroCta })[0]);
    expect(screen.getByText("Onboarding")).toBeTruthy();
  });
});
