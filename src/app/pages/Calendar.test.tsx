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
const extra = vi.hoisted(() => ({ value: { plans: [], stubs: [], failed: false } as unknown }));
vi.mock("../lib/useCalendarData", () => ({ useCalendarData: () => extra.value }));
const bring = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock("../lib/weekActions", async (orig) => ({ ...(await orig<typeof import("../lib/weekActions")>()), bringSomeone: bring }));

import { Calendar } from "./Calendar";
import { CALENDAR_SIGNED_OUT, WEEK_VIEW } from "../lib/homeCopy";

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
  extra.value = { plans: [], stubs: [], failed: false };
  saveBudget.mockClear();
  bring.mockClear();
});
afterEach(cleanup);
const show = (url = "/calendar?view=week") => render(<MemoryRouter initialEntries={[url]}><Calendar /></MemoryRouter>);

describe("Calendar, Week view on a phone", () => {
  it("asks someone who is signed out to make an account", () => {
    auth.value = { user: null, isConfigured: true };
    show();
    expect(screen.getByRole("heading", { name: CALENDAR_SIGNED_OUT.title })).toBeTruthy();
  });

  it("has the title and the range in New York, and no back arrow on a tab page", () => {
    show();
    expect(screen.getByRole("heading", { level: 1, name: "Oct 30 to Nov 5" })).toBeTruthy();
    expect(screen.getByText("Next 7 days · New York")).toBeTruthy();
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
    expect(screen.getByRole("button", { name: "Saturday 31, 1 plan, free all day" })).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: "Pursuit session, 7 PM, Pottery" }));
    expect(screen.getByRole("link", { name: "Open Pursuit" }).getAttribute("href")).toBe("/pursuit/p9");
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

// ---------------------------------------------------------------------------
// The other views, the Show filters and the URL.
// ---------------------------------------------------------------------------

import { MemoryRouter as Router, useLocation } from "react-router";
import { FILTERS_KEY } from "../lib/calendarView";
import type { StubCard } from "../lib/stubs";

const stub = (over: Partial<StubCard> = {}): StubCard => ({ id: 1, kind: "session", serial: 1, title: "Pottery #2", meta: "", issuedAt: ny(10, 3, 15), corner: { spaceSlug: "crafts", slug: "pottery" }, ...over });
const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide && (query.includes("744") || query.includes("1128")), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
};
const Where = () => {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
};
const at = (url: string) => render(<Router initialEntries={[url]}><Calendar /><Where /></Router>);
const where = () => screen.getByTestId("where").textContent;

describe("Calendar, the four views", () => {
  beforeEach(() => {
    window.localStorage.clear();
    extra.value = { plans: [], stubs: [stub()], failed: false };
  });

  it("opens on Month with the month's title and its Stub and plan counts", () => {
    hook.value = data({ plans: [plan()] });
    at("/calendar");
    expect(screen.getByRole("heading", { level: 1, name: "October 2026" })).toBeTruthy();
    expect(screen.getByText("1 Stub · 1 plan to go · New York")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Month", pressed: true })).toBeTruthy();
  });

  it("reads the view and the date from the URL", () => {
    at("/calendar?view=day&date=2026-11-03");
    expect(screen.getByRole("heading", { level: 1, name: "Tue Nov 3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Day", pressed: true })).toBeTruthy();
  });

  it("falls back to Month and today for nonsense in the URL", () => {
    at("/calendar?view=year&date=not-a-date");
    expect(screen.getByRole("heading", { level: 1, name: "October 2026" })).toBeTruthy();
  });

  it("switches views and writes the choice to the URL, so Back works", () => {
    at("/calendar");
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    expect(where()).toBe("/calendar?view=list");
    expect(screen.getByRole("heading", { level: 1, name: "Oct 30 to Nov 28" })).toBeTruthy();
  });

  it("names the arrows for the period and pages by it", () => {
    at("/calendar");
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(where()).toBe("/calendar?view=month&date=2026-11-01");
    expect(screen.getByRole("heading", { level: 1, name: "November 2026" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(where()).toBe("/calendar?view=month");
    expect(screen.getByRole("heading", { level: 1, name: "October 2026" })).toBeTruthy();
  });

  it("pages Week by 7 days and Day by 1", () => {
    at("/calendar?view=week");
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByRole("heading", { level: 1, name: "Nov 6 to Nov 12" })).toBeTruthy();
    expect(screen.getByText("7 days · New York")).toBeTruthy();
  });

  it("stops paging back at the month the person joined and 3 months ahead", () => {
    auth.value = { user: { id: "u1", created_at: new Date(ny(9, 14, 9)).toISOString() }, profile: { display_name: "Alex" }, isConfigured: true };
    at("/calendar");
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("heading", { level: 1, name: "September 2026" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous month" }) as HTMLButtonElement).disabled).toBe(true);
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("heading", { level: 1, name: "January 2027" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next month" }) as HTMLButtonElement).disabled).toBe(true);
  });

  describe("on a wide screen", () => {
    beforeEach(() => setWide(true));
    afterEach(() => setWide(false));

    it("draws Month as Sunday first cells with chips and the coral Make a plan in the header", () => {
      hook.value = data({ plans: [plan()] });
      at("/calendar");
      expect(screen.getByRole("button", { name: "Make a plan" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Plan, 7 PM, Bouldering night" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Stub, Pottery #2" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Show" })).toBeNull();
    });

    it("shows up to 3 chips in a cell and then how many more", () => {
      hook.value = data({
        windows: [],
        plans: [1, 2, 3, 4].map((n) => plan({ id: `event-${n}`, title: `Thing ${n}`, startsAt: ny(10, 31, 8 + n), endsAt: ny(10, 31, 9 + n) })),
      });
      at("/calendar");
      expect(screen.getAllByRole("button", { name: /^Plan, / })).toHaveLength(2);
      const more = screen.getByRole("button", { name: "2 more" });
      fireEvent.click(more);
      expect(where()).toBe("/calendar?view=day&date=2026-10-31");
    });

    it("draws Week as a time grid with a block for the plan and free time, with no Find something link in the grid", () => {
      hook.value = data({ plans: [plan()] });
      at("/calendar?view=week");
      expect(screen.getByRole("button", { name: "Plan, 7 PM, Bouldering night" })).toBeTruthy();
      expect(screen.getAllByRole("button", { name: /^Free / }).length).toBeGreaterThan(0);
      expect(screen.queryAllByRole("link", { name: "Find something" })).toHaveLength(0);
      expect(screen.getByText("7 PM")).toBeTruthy();
    });

    it("keeps the glance card and city picks on the week that starts today, and not on a later week", () => {
      hook.value = data({ goodHours: 5 });
      const { unmount } = at("/calendar?view=week");
      expect(screen.getByText("good plan hours this week")).toBeTruthy();
      unmount();
      at("/calendar?view=week&date=2026-11-06");
      expect(screen.queryByText("good plan hours this week")).toBeNull();
      expect(screen.queryByText("Sunday night, this week flips")).toBeNull();
    });

    it("draws Day as a 7 day strip and one column", () => {
      hook.value = data({ plans: [plan()] });
      at("/calendar?view=day&date=2026-10-31");
      expect(screen.getAllByRole("button", { name: /^(Today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) \d/ })).toHaveLength(7);
      expect(screen.getByRole("button", { name: "Plan, 7 PM, Bouldering night" })).toBeTruthy();
    });

    it("marks Show checkboxes and remembers them per view", () => {
      at("/calendar");
      const stubs = screen.getByRole("checkbox", { name: /Stubs you collected/ }) as HTMLInputElement;
      expect(stubs.checked).toBe(true);
      fireEvent.click(stubs);
      expect(screen.queryByRole("button", { name: "Stub, Pottery #2" })).toBeNull();
      expect(JSON.parse(window.localStorage.getItem(FILTERS_KEY) ?? "{}").month.stubs).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: "Week" }));
      expect((screen.getByRole("checkbox", { name: /Stubs you collected/ }) as HTMLInputElement).checked).toBe(true);
    });

    it("only lists the kinds that exist today", () => {
      at("/calendar");
      expect(screen.getAllByRole("checkbox").map((c) => c.closest("label")?.textContent)).toEqual(["Plans", "Pursuit sessions", "Stubby’s picksIdeas for your free time", "Free time", "Stubs you collected", "Your blocks"]);
    });

    it("hides free time when it is turned off", () => {
      at("/calendar?view=week");
      expect(screen.getAllByRole("button", { name: /^Free / }).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole("checkbox", { name: /Free time/ }));
      expect(screen.queryAllByRole("button", { name: /^Free / })).toHaveLength(0);
    });
  });

  describe("on a phone", () => {
    it("fills a Stub day, dots a plan day and lists a tapped day under the grid", () => {
      hook.value = data({ plans: [plan()] });
      at("/calendar");
      const stubDay = screen.getByRole("button", { name: /^Saturday Oct 3, 1 Stub/ });
      expect(stubDay.className).toContain("bg-[var(--cat)]");
      fireEvent.click(screen.getByRole("button", { name: /^Saturday Oct 31, 1 plan/ }));
      const list = document.querySelector("[aria-live='polite']") as HTMLElement;
      expect(within(list).getByText("Bouldering night")).toBeTruthy();
      expect(within(list).getByRole("button", { name: "Make a plan for tomorrow" })).toBeTruthy();
    });

    it("lists a day's Stubs when it is tapped", () => {
      at("/calendar");
      fireEvent.click(screen.getByRole("button", { name: /^Saturday Oct 3,/ }));
      const list = document.querySelector("[aria-live='polite']") as HTMLElement;
      expect(within(list).getByText("Pottery #2")).toBeTruthy();
    });

    it("opens a Show sheet instead of a side panel, and has Make a plan in the header", () => {
      at("/calendar");
      expect(screen.getByRole("button", { name: "Make a plan" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Show" }));
      expect(screen.getByRole("checkbox", { name: /Plans/ })).toBeTruthy();
    });

    it("lists the next 30 days, leaving out days with nothing", () => {
      hook.value = data({ plans: [plan()], windows: [] });
      at("/calendar?view=list");
      const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
      expect(headings).toEqual(["TomorrowOct 31"]);
    });

    it("says what is empty and offers one action when there is nothing in the list", () => {
      hook.value = data({ plans: [], windows: [] });
      extra.value = { plans: [], stubs: [], failed: false };
      at("/calendar?view=list");
      expect(screen.getByText("Nothing planned in the next 30 days.")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Find something" }).getAttribute("href")).toBe("/discover");
    });

    it("plans from another range come in alongside the Week view's own", () => {
      hook.value = data({ plans: [plan()] });
      extra.value = { plans: [plan({ id: "event-77", title: "Next month thing", startsAt: ny(11, 20, 19), endsAt: ny(11, 20, 21) })], stubs: [], failed: false };
      at("/calendar?view=list&date=2026-11-18");
      expect(screen.getByText("Next month thing")).toBeTruthy();
    });

    it("offers a retry when the range's plans cannot be read", () => {
      extra.value = { plans: [], stubs: [], failed: true };
      at("/calendar");
      expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    });
  });
});

describe("Calendar, a tablet", () => {
  beforeEach(() => {
    window.localStorage.clear();
    extra.value = { plans: [], stubs: [], failed: false };
    // 744px and up, but under 1128px.
    window.matchMedia = ((query: string) => ({ matches: query.includes("744"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
  });
  afterEach(() => setWide(false));

  it("has Make a plan in the header and Show as a sheet, not a panel", () => {
    at("/calendar");
    expect(screen.getByRole("button", { name: "Make a plan" })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByRole("checkbox", { name: /Plans/ })).toBeTruthy();
  });
});
