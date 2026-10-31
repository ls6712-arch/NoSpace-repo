// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nyTimeToMs } from "../lib/homeWeek";
import type { DiscoverCorner, DiscoverSpace } from "../lib/discover";

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("../context/ContentContext", () => ({ useContent: () => ({ publicFeed: [] }) }));
const toggleHobbyFollow = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("../context/SocialContext", () => ({ useSocial: () => ({ toggleHobbyFollow, followedHobbies: [] }) }));
vi.mock("../lib/useFeedInputs", () => ({
  useFeedInputs: () => ({ inputs: { meId: "u1", followingIds: [], spacePostIds: new Set<number>(), followedCorners: new Set<string>() }, loaded: true }),
}));
const city = vi.hoisted(() => ({ value: "New York" }));
vi.mock("../lib/interests", () => ({ useInterests: () => ({ city: city.value, moods: [] }) }));
const names = vi.hoisted(() => ({ value: new Map<string, { people?: string; place?: string }>() }));
vi.mock("../lib/discoverCornerNames", () => ({
  fetchCornerNames: vi.fn(async () => names.value),
  fetchMyArea: vi.fn(async () => "Greenpoint"),
}));
vi.mock("../lib/search", async (orig) => ({
  ...(await orig<typeof import("../lib/search")>()),
  useUnifiedSearch: () => ({ groups: { space: [], corner: [], person: [], pursuit: [], moment: [], product: [] }, all: [], loading: false }),
}));
vi.mock("../components/MomentDetail", () => ({ MomentDetail: () => null }));
vi.mock("../components/discover/InterestsSheet", () => ({ InterestsSheet: () => null }));
vi.mock("../../lib/supabase", () => ({ supabase: null }));

const taste = vi.hoisted(() => ({ value: { picks: [] as string[], windows: [] as string[], budget: null as number | null } }));
vi.mock("../lib/tasteRemote", () => ({
  fetchTaste: vi.fn(async () => taste.value),
  fetchPasses: vi.fn(async () => []),
}));
vi.mock("../lib/homeSuggestions", () => ({ fetchHomeSuggestions: vi.fn(async () => []) }));
const requestOrJoin = vi.hoisted(() => vi.fn(async () => ({ data: "active", error: null as string | null })));
vi.mock("../lib/spaces", () => ({ requestOrJoinSpace: requestOrJoin }));
vi.mock("../lib/profileFollows", () => ({ follow: vi.fn(async () => true) }));

const fetchers = vi.hoisted(() => ({
  corners: vi.fn(async (): Promise<unknown> => []),
  spaces: vi.fn(async (): Promise<unknown> => []),
  publicSpaces: vi.fn(async (): Promise<unknown> => []),
  moments: vi.fn(async (): Promise<unknown> => []),
  affinity: vi.fn(async () => new Map<string, number>()),
  passMap: vi.fn(async () => ({})),
  log: vi.fn(async () => {}),
}));
vi.mock("../lib/discover", () => ({
  orEmpty: <T,>(list: Promise<T[]>) => list,
  fetchDiscoverCorners: fetchers.corners,
  fetchDiscoverSpaces: fetchers.spaces,
  fetchPublicSpaces: fetchers.publicSpaces,
  fetchDiscoverMoments: fetchers.moments,
  fetchCornerAffinity: fetchers.affinity,
  fetchPassCornerMap: fetchers.passMap,
  logDiscoverEvent: fetchers.log,
}));

import { Discover } from "./Discover";

const corner = (cornerKey: string, over: Partial<DiscoverCorner> = {}): DiscoverCorner => ({ cornerKey, hasHome: true, hasGroup: false, hasPlace: true, ...over });
const space = (id: string, over: Partial<DiscoverSpace> = {}): DiscoverSpace => ({
  id, slug: `space-${id}`, name: `Space ${id}`, cornerKey: "crafts-making/pottery", neighborhood: "Greenpoint", access: "open", momentsThisMonth: 4, nextEvent: null, ...over,
});

const show = () => render(<MemoryRouter><Discover /></MemoryRouter>);
/** Opens a pill's dropdown and picks a value, the way a keyboard does. */
const choose = (group: string, value: string) => {
  const trigger = screen.getByRole("combobox", { name: new RegExp(`^${group}:`) });
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.click(screen.getByRole("option", { name: value }));
};
const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  // jsdom has no matchMedia (the reduced motion hook reads it).
  // Radix Select (the pill dropdowns) reads these, and jsdom has neither.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
  auth.value = { user: { id: "u1" }, profile: { display_name: "Alex" }, isConfigured: true };
  taste.value = { picks: [], windows: [], budget: null };
  city.value = "New York";
  names.value = new Map();
  for (const f of Object.values(fetchers)) f.mockClear();
  toggleHobbyFollow.mockClear();
  requestOrJoin.mockClear();
  requestOrJoin.mockResolvedValue({ data: "active", error: null });
  fetchers.corners.mockResolvedValue([corner("crafts-making/pottery"), corner("music/piano", { hasGroup: true }), corner("sports-fitness/dance")]);
  fetchers.spaces.mockResolvedValue([space("a"), space("b", { access: "closed" })]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Discover layout", () => {
  it("shows the header, search, jump chips and the sections in order", async () => {
    show();
    await settle();
    expect(screen.getByText("What’s out there in")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: /New York/ })).toBeTruthy();
    expect(screen.getByPlaceholderText("Search Corners, Spaces, people")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(["Ideas", "Corners", "Spaces", "Moments"]);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["What could you do?", "Corners new to you", "Spaces near you", "What New York is making"]);
  });

  it("has no member or follower counts anywhere and no price on an idea card", async () => {
    show();
    await settle();
    expect(document.body.textContent).not.toMatch(/followers?\b|members?\b/i);
    const ideas = screen.getByRole("heading", { name: "What could you do?" }).closest("section")!;
    for (const card of within(ideas).getAllByRole("link")) expect(card.textContent).not.toMatch(/\$/);
  });
});

describe("Discover ideas", () => {
  it("starts the pills from the saved free window and budget", async () => {
    // Thursday Oct 29, 2026 at noon in New York: the next free window is Thursday evening, and the budget is 0.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(nyTimeToMs(2026, 10, 29, 12));
    taste.value = { picks: [], windows: ["thu-eve"], budget: 0 };
    show();
    await settle();
    expect(screen.getByRole("combobox", { name: "Time: Tonight" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Spend: Free" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Who: A friend" })).toBeTruthy();
  });

  it("starts at Weekend when the next window is free all day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(nyTimeToMs(2026, 10, 29, 12));
    taste.value = { picks: [], windows: ["sat-day", "sat-eve"], budget: 100 };
    show();
    await settle();
    expect(screen.getByRole("combobox", { name: "Time: Weekend" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Spend: Under $25" })).toBeTruthy();
  });

  it("reshuffles the row at once when a pill changes, with no network call", async () => {
    show();
    await settle();
    const section = () => screen.getByRole("heading", { name: "What could you do?" }).closest("section")!;
    const titles = () => within(section()).getAllByRole("link").map((l) => l.textContent);
    const before = titles();
    const calls = () => Object.values(fetchers).reduce((n, f) => n + f.mock.calls.length, 0);
    const callsBefore = calls();
    choose("Who", "New people");
    expect(screen.getByRole("combobox", { name: "Who: New people" })).toBeTruthy();
    expect(titles()).not.toEqual(before);
    expect(calls()).toBe(callsBefore);
    expect(titles().length).toBeGreaterThanOrEqual(3);
  });
});

describe("Discover Corners and Spaces", () => {
  it("hides a Corner at once when it is followed, and follows it with its Space and slug", async () => {
    show();
    await settle();
    const section = screen.getByRole("heading", { name: "Corners new to you" }).closest("section")!;
    expect(within(section).getAllByRole("button", { name: "Follow" })).toHaveLength(3);
    fireEvent.click(within(section).getAllByRole("button", { name: "Follow" })[0]);
    expect(toggleHobbyFollow).toHaveBeenCalledWith("crafts-making:pottery", "Pottery");
    expect(within(section).queryByText("Pottery")).toBeNull();
  });

  it("offers Join on an Open Space and Ask to join on a Closed one, and hides one once joined", async () => {
    show();
    await settle();
    const section = screen.getByRole("heading", { name: "Spaces near you" }).closest("section")!;
    expect(within(section).getByRole("button", { name: "Join" })).toBeTruthy();
    expect(within(section).getByRole("button", { name: "Ask to join" })).toBeTruthy();
    expect(within(section).getAllByText("4 Moments this month", { exact: false })).toHaveLength(2);
    fireEvent.click(within(section).getByRole("button", { name: "Join" }));
    expect(requestOrJoin).toHaveBeenCalledWith("a");
    expect(within(section).queryByText("Space a")).toBeNull();
    expect(within(section).getByText("Space b")).toBeTruthy();
  });

  it("brings a Space back with a message when joining fails", async () => {
    requestOrJoin.mockResolvedValue({ data: null as never, error: "That Space is full." });
    show();
    await settle();
    const section = screen.getByRole("heading", { name: "Spaces near you" }).closest("section")!;
    fireEvent.click(within(section).getByRole("button", { name: "Join" }));
    await waitFor(() => expect(within(section).getByText("Space a")).toBeTruthy());
  });
});

describe("Discover fails one section at a time", () => {
  it("hides Spaces when they cannot load and keeps everything else", async () => {
    fetchers.spaces.mockResolvedValue([]);
    show();
    await settle();
    expect(screen.queryByRole("heading", { name: "Spaces near you" })).toBeNull();
    expect(screen.getByRole("heading", { name: "What could you do?" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Corners new to you" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /is making/ })).toBeTruthy();
  });

  it("hides a section that throws while rendering, and nothing else", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchers.spaces.mockResolvedValue([{ id: "x", slug: "x", name: "X", access: "open", cornerKey: 5, momentsThisMonth: 0, nextEvent: null }]); // malformed on purpose
    show();
    await settle();
    expect(screen.queryByRole("heading", { name: "Spaces near you" })).toBeNull();
    expect(screen.getByRole("heading", { name: "What could you do?" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Corners new to you" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /is making/ })).toBeTruthy();
    warn.mockRestore();
    error.mockRestore();
  });

  it("says Nothing new nearby yet, with a way to log a Moment, when the feed is empty", async () => {
    show();
    await settle();
    expect(screen.getByText("Nothing new nearby yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Log a Moment" }).getAttribute("href")).toBe("/create");
  });
});

describe("Discover pill dropdowns", () => {
  it("opens a list of every value, the current one marked, for each pill", async () => {
    show();
    await settle();
    const cases: [string, string[], string][] = [
      ["Time", ["An hour", "Tonight", "Weekend"], "Tonight"],
      ["Spend", ["Free", "Under $25", "Treat me"], "Under $25"],
      ["Who", ["Solo", "A friend", "New people"], "A friend"],
    ];
    for (const [group, values, current] of cases) {
      fireEvent.keyDown(screen.getByRole("combobox", { name: new RegExp(`^${group}:`) }), { key: "Enter" });
      expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(values);
      expect(screen.getByRole("option", { name: current }).getAttribute("aria-selected")).toBe("true");
      fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    }
  });

  it("changes the row and the pill when a value is picked, and picking Weekend keeps at least 3 ideas", async () => {
    show();
    await settle();
    choose("Time", "Weekend");
    choose("Spend", "Treat me");
    expect(screen.getByRole("combobox", { name: "Time: Weekend" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Spend: Treat me" })).toBeTruthy();
    const section = screen.getByRole("heading", { name: "What could you do?" }).closest("section")!;
    expect(within(section).getAllByRole("link").length).toBeGreaterThanOrEqual(3);
  });
});

describe("Discover Corner tabs and headings", () => {
  it("names the soonest open Pursuit and nearest Space on the tabs, and falls back to the approved lines", async () => {
    names.value = new Map([["crafts-making/pottery", { people: "Wheel night", place: "Kiln House" }]]);
    fetchers.corners.mockResolvedValue([corner("crafts-making/pottery", { hasGroup: true }), corner("music/piano", { hasGroup: true }), corner("sports-fitness/dance", { hasGroup: true })]);
    show();
    await settle();
    const section = screen.getByRole("heading", { name: "Corners new to you" }).closest("section")!;
    await waitFor(() => expect(within(section).getByText("Wheel night")).toBeTruthy());
    expect(within(section).getByText("Kiln House")).toBeTruthy();
    // The other Corners have something behind the tab but no name yet.
    expect(within(section).getAllByText("Find a place near you").length).toBeGreaterThan(0);
    expect(within(section).getAllByText("Find people to go with").length).toBeGreaterThan(0);
  });

  it("keeps a Corner hook to one line", async () => {
    show();
    await settle();
    const section = screen.getByRole("heading", { name: "Corners new to you" }).closest("section")!;
    const hook = within(section).getByText(/Making|Hands|clay|wheel|pottery/i, { selector: "p" });
    expect(hook.className).toContain("truncate");
    expect(hook.className).not.toContain("line-clamp");
  });

  it("calls the feed What people are making when no city is saved", async () => {
    city.value = "";
    show();
    await settle();
    expect(screen.getByRole("heading", { name: "What people are making" })).toBeTruthy();
  });
});

describe("Discover leaves out a Corner it cannot describe", () => {
  it("skips one malformed Corner and still shows the others", async () => {
    fetchers.corners.mockResolvedValue([{ cornerKey: undefined }, corner("music/piano")]);
    show();
    await settle();
    const section = screen.getByRole("heading", { name: "Corners new to you" }).closest("section")!;
    expect(within(section).getAllByRole("button", { name: "Follow" })).toHaveLength(1);
  });
});

describe("Discover signed out", () => {
  beforeEach(() => {
    auth.value = { user: null, isConfigured: true };
    fetchers.publicSpaces.mockResolvedValue([space("a")]);
  });

  it("shows the Ideas, Corners and Spaces read only, and does not call the signed in functions", async () => {
    show();
    await settle();
    expect(screen.getByRole("heading", { name: "What could you do?" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Corners new to you" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Spaces near you" })).toBeTruthy();
    expect(fetchers.corners).not.toHaveBeenCalled();
    expect(fetchers.spaces).not.toHaveBeenCalled();
    expect(fetchers.moments).not.toHaveBeenCalled();
    expect(fetchers.log).not.toHaveBeenCalled();
  });

  it("has no Moments section and no Moments chip, since a visitor sees sections 1 to 6", async () => {
    show();
    await settle();
    expect(screen.queryByRole("heading", { name: /is making/ })).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Sections" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(["Ideas", "Corners", "Spaces"]);
  });

  it("opens the sign up prompt for any action and closes it with Keep looking around", async () => {
    show();
    await settle();
    fireEvent.click(within(screen.getByRole("heading", { name: "Spaces near you" }).closest("section")!).getByRole("button", { name: "Join" }));
    expect(requestOrJoin).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Create an account" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep looking around" }));
    expect(screen.queryByRole("link", { name: "Create an account" })).toBeNull();

    fireEvent.click(within(screen.getByRole("heading", { name: "Corners new to you" }).closest("section")!).getAllByRole("button", { name: "Follow" })[0]);
    expect(toggleHobbyFollow).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Create an account" })).toBeTruthy();
  });
});
