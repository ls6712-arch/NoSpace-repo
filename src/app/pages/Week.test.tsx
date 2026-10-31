// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nyTimeToMs, windowsLeft } from "../lib/homeWeek";
import type { WeekData } from "../lib/useWeekData";
import type { WeekPlanDetail } from "../lib/weekView";

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth.value }));
const hook = vi.hoisted(() => ({ value: {} as unknown }));
vi.mock("../lib/useWeekData", () => ({ useWeekData: () => hook.value }));
const bring = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock("../lib/weekActions", async (orig) => ({ ...(await orig<typeof import("../lib/weekActions")>()), bringSomeone: bring }));

import { Week } from "./Week";
import { WEEK_SIGNED_OUT, WEEK_VIEW } from "../lib/homeCopy";

const ny = (m: number, d: number, h: number) => nyTimeToMs(2026, m, d, h);
const NOW = ny(10, 30, 12);

const plan = (over: Partial<WeekPlanDetail> = {}): WeekPlanDetail => ({
  id: "event-1",
  kind: "event",
  title: "Bouldering night",
  startsAt: ny(10, 31, 19),
  place: "Brooklyn Boulders, Gowanus",
  price: "$25",
  color: "teal",
  going: { friends: [], total: 1 },
  cornerKey: "sports/climbing",
  ...over,
});

const saveBudget = vi.fn(async () => true);
const data = (over: Partial<WeekData> = {}): WeekData => {
  const windows = over.windows ?? ["fri-eve", "sat-day", "sat-eve"];
  return {
    status: "ready",
    now: NOW,
    windows,
    left: windowsLeft(windows, NOW),
    budget: 50,
    passes: [],
    plans: [],
    picks: [],
    goodHours: 0,
    reload: vi.fn(),
    saveBudget,
    ...over,
  };
};

beforeEach(() => {
  // jsdom has no matchMedia (the shared HorizontalRow reads it for reduced motion).
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
  auth.value = { user: { id: "u1" }, profile: { display_name: "Alex" }, isConfigured: true };
  hook.value = data();
  saveBudget.mockClear();
  bring.mockClear();
});
afterEach(cleanup);
const show = () => render(<MemoryRouter><Week /></MemoryRouter>);

describe("Week", () => {
  it("asks someone who is signed out to make an account", () => {
    auth.value = { user: null, isConfigured: true };
    show();
    expect(screen.getByRole("heading", { name: WEEK_SIGNED_OUT.title })).toBeTruthy();
  });

  it("has the title and the range in New York, and no back arrow on a tab page", () => {
    show();
    expect(screen.getByRole("heading", { level: 1, name: "Your week" })).toBeTruthy();
    expect(screen.getByText("Fri Oct 30 to Thu Nov 5 · New York")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Back to Home" })).toBeNull();
  });

  it("shows blocks the size of the real ones while loading", () => {
    hook.value = data({ status: "loading" });
    const { container } = show();
    expect(container.querySelector("[aria-busy='true']")).toBeTruthy();
    expect(screen.queryByText("Monthly budget")).toBeNull();
  });

  it("offers a retry when the plans cannot be read", () => {
    const reload = vi.fn();
    hook.value = data({ status: "error", reload });
    show();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalled();
  });

  it("draws the seven days as tiles with a label that says what is on", () => {
    hook.value = data({ plans: [plan()] });
    show();
    expect(screen.getAllByRole("button", { pressed: false }).length + screen.getAllByRole("button", { pressed: true }).length).toBeGreaterThanOrEqual(7);
    expect(screen.getByRole("button", { name: "Saturday 31, 1 plan, free daytime" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Monday 2, nothing on" })).toBeTruthy();
  });

  it("highlights a tapped day", () => {
    show();
    const tile = screen.getByRole("button", { name: /^Sunday 1/ });
    expect(tile.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(tile);
    expect(tile.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders a plan as a ticket with its time, place and price", () => {
    hook.value = data({ plans: [plan()] });
    show();
    const day = document.getElementById("week-day-1")!;
    expect(within(day).getByRole("heading", { name: /Tomorrow/ })).toBeTruthy();
    expect(within(day).getByText("Bouldering night")).toBeTruthy();
    expect(within(day).getByText("Brooklyn Boulders, Gowanus · $25")).toBeTruthy();
    expect(within(day).getByText("7")).toBeTruthy();
    expect(within(day).getByText("PM")).toBeTruthy();
  });

  it("names only the connections who are going, and offers Bring someone when it is just you", () => {
    hook.value = data({
      plans: [
        plan({ id: "event-1", title: "With a friend", going: { friends: [{ id: "f1", name: "Priya Shah" }], total: 2 } }),
        plan({ id: "event-2", title: "With strangers", startsAt: ny(10, 31, 21), going: { friends: [], total: 6 } }),
        plan({ id: "event-3", title: "Alone", startsAt: ny(11, 1, 15), going: { friends: [], total: 1 } }),
      ],
    });
    show();
    expect(screen.getByText("You and Priya")).toBeTruthy();
    const strangers = screen.getByText("With strangers").closest("li")!;
    expect(strangers.textContent).not.toMatch(/going/);
    expect(within(strangers).queryByRole("button", { name: "Bring someone" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Bring someone" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Bring someone" }));
    expect(bring).toHaveBeenCalledTimes(1);
    expect((bring.mock.calls[0] as unknown[])[0]).toMatchObject({ id: "event-3" });
  });

  it("names a Pursuit's session and links to the Pursuit", () => {
    hook.value = data({ plans: [plan({ kind: "session", title: "Pottery", pursuitId: "p9", session: { n: 4, total: 5 }, cornerKey: "crafts/pottery" })] });
    show();
    expect(screen.getByText("Pursuit · session 4 of 5")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Pottery" }).getAttribute("href")).toBe("/pursuit/p9");
  });

  it("names a pass instead of a price", () => {
    hook.value = data({ plans: [plan()], passes: [{ id: "x", kind: "climbing", label: "Climbing", place: "" }] });
    show();
    expect(screen.getByText("Brooklyn Boulders, Gowanus · your climbing pass")).toBeTruthy();
  });

  it("shows free windows with no plan, each with a Find something link to Discover", () => {
    show();
    const links = screen.getAllByRole("link", { name: "Find something" });
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/discover?window=fri-eve", "/discover?window=sat-day"]);
    expect(screen.getByText("Free evening")).toBeTruthy();
    expect(screen.getByText("Free all day")).toBeTruthy();
  });

  it("shrinks a day with nothing on to one row", () => {
    show();
    expect(screen.getByText("Mon 2 · Nothing on")).toBeTruthy();
  });

  it("hides the good plan hours line at 0 and shows the number when there is one", () => {
    const { unmount } = show();
    expect(screen.queryByText(/good plan hour/)).toBeNull();
    unmount();
    hook.value = data({ goodHours: 7 });
    show();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("good plan hours this week")).toBeTruthy();
  });

  it("lists the free evenings you told us, with a Change link that returns here", () => {
    show();
    expect(screen.getByText("Free evenings you told us")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Change" }).getAttribute("href")).toBe("/week/free?from=week");
    expect(screen.getByRole("link", { name: "Change when you’re free" }).getAttribute("href")).toBe("/week/free?from=week");
  });

  it("saves the budget when the slider is let go, snapped to an allowed amount", () => {
    show();
    const slider = screen.getByLabelText("Monthly budget") as HTMLInputElement;
    expect(slider.getAttribute("aria-valuetext")).toBe("$50");
    fireEvent.change(slider, { target: { value: "2" } });
    expect(saveBudget).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(saveBudget).toHaveBeenCalledWith(100);
    fireEvent.pointerUp(slider);
    expect(saveBudget).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull();
  });

  it("shows Free only at 0 and the plain line", () => {
    hook.value = data({ budget: 0 });
    show();
    expect(screen.getByLabelText("Monthly budget").getAttribute("aria-valuetext")).toBe("Free only");
    expect(screen.getByText("Only free plans and ones your pass covers")).toBeTruthy();
  });

  it("adds up what is planned this month under the slider", () => {
    hook.value = data({ budget: 100, plans: [plan({ price: "$25" }), plan({ id: "event-2", price: null, startsAt: ny(10, 31, 21), cornerKey: undefined })] });
    show();
    expect(screen.getByText("$25 planned so far · $75 left this month, plus 1 plan without a price")).toBeTruthy();
  });

  it("asks for free time instead of showing free slots when none is saved, and keeps the plans", () => {
    hook.value = data({ windows: [], plans: [plan()] });
    show();
    const card = screen.getByRole("link", { name: "Tell us when you’re usually free" });
    expect(card.getAttribute("href")).toBe("/week/free?from=week");
    expect(screen.queryByText("Free evenings you told us")).toBeNull();
    expect(screen.queryByText(/^Free (evening|daytime|all day)$/)).toBeNull();
    expect(screen.getByText("Bouldering night")).toBeTruthy();
  });

  it("with no plans and no free time, asks for free time and offers Find something", () => {
    hook.value = data({ windows: [], plans: [] });
    show();
    expect(screen.getByRole("link", { name: "Tell us when you’re usually free" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Find something" }).getAttribute("href")).toBe("/discover");
  });

  it("shows the hand-picked row with each pick's pill, and links out when there is a link", () => {
    hook.value = data({
      picks: [
        { id: 1, title: "Halloween parade", place: "Sixth Avenue", startsAt: ny(10, 31, 19), endsAt: null, price: "free", url: "https://example.com/parade", cornerKey: null, color: "orange", published: true },
        { id: 2, title: "Marathon", place: null, startsAt: ny(11, 1, 9), endsAt: null, price: null, url: null, cornerKey: null, color: "lime", published: true },
      ],
    });
    show();
    expect(screen.getByRole("heading", { name: "This week in New York" })).toBeTruthy();
    expect(screen.getByText("Picked by Soosh")).toBeTruthy();
    expect(screen.getByText("Sat 31 · 7 PM · free")).toBeTruthy();
    expect(screen.getByText("Sun 1 · 9 AM")).toBeTruthy();
    const link = screen.getByRole("link", { name: /Halloween parade/ });
    expect(link.getAttribute("href")).toBe("https://example.com/parade");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(screen.getByText("Marathon").closest("a")).toBeNull();
  });

  it("hides the whole hand-picked row when there are no picks", () => {
    show();
    expect(screen.queryByText("This week in New York")).toBeNull();
    expect(screen.queryByText("Picked by Soosh")).toBeNull();
  });

  it("has the Sunday night card", () => {
    show();
    expect(screen.getByText("Sunday night, this week flips")).toBeTruthy();
    expect(screen.getByText(WEEK_VIEW.flipBody)).toBeTruthy();
  });
});
