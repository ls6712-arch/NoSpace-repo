// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nyTimeToMs, windowsLeft } from "../lib/homeWeek";
import type { StubCard } from "../lib/stubs";
import type { WeekData } from "../lib/useWeekData";
import type { WeekPlanDetail } from "../lib/weekView";

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth.value }));
const hook = vi.hoisted(() => ({ value: {} as unknown }));
vi.mock("../lib/useWeekData", () => ({ useWeekData: () => hook.value }));
const extra = vi.hoisted(() => ({ value: { plans: [], stubs: [], failed: false } as unknown }));
vi.mock("../lib/useCalendarData", () => ({ useCalendarData: () => extra.value }));

const toasts = vi.hoisted(() => ({ calls: [] as { message: string; undo: () => void }[] }));
vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: Object.assign(
    (message: string, opts?: { action?: { onClick: () => void } }) => void toasts.calls.push({ message, undo: () => opts?.action?.onClick() }),
    { error: vi.fn() },
  ),
}));

const remote = vi.hoisted(() => ({
  createPlan: vi.fn(async (_plan: unknown, _owner: unknown) => ({ sessionId: 41, pursuitId: "p-new" })),
  deleteSession: vi.fn(async () => null as string | null),
  cancelOwnPlan: vi.fn(async (_sessionId: number, _pursuitId: string | undefined) => null as string | null),
  moveSession: vi.fn(async () => null as string | null),
  leavePlan: vi.fn(async () => null as string | null),
  fetchConnections: vi.fn(async () => [] as { id: string; name: string }[]),
  addEntry: vi.fn(async (e: { kind: string; startsAt: number; endsAt: number; repeat?: string; note?: string }) => ({ entry: { id: 7, kind: e.kind, startsAt: e.startsAt, endsAt: e.endsAt, repeat: e.repeat ?? "none", note: e.note } })),
  removeEntry: vi.fn(async () => null as string | null),
  updateEntry: vi.fn(async () => null as string | null),
  fetchEntries: vi.fn(async () => [] as unknown[]),
  savePrivate: vi.fn(async () => ({ error: null as string | null })),
}));
vi.mock("../lib/planEdits", async (orig) => ({ ...(await orig<typeof import("../lib/planEdits")>()), createPlan: remote.createPlan, deleteSession: remote.deleteSession, cancelOwnPlan: remote.cancelOwnPlan, moveSession: remote.moveSession, leavePlan: remote.leavePlan, fetchConnections: remote.fetchConnections }));
vi.mock("../lib/calendarEntries", async (orig) => ({ ...(await orig<typeof import("../lib/calendarEntries")>()), addEntry: remote.addEntry, removeEntry: remote.removeEntry, updateEntry: remote.updateEntry, fetchEntries: remote.fetchEntries }));
vi.mock("../lib/onboardingRemote", async (orig) => ({ ...(await orig<typeof import("../lib/onboardingRemote")>()), savePrivate: remote.savePrivate }));
vi.mock("../lib/tasteRemote", async (orig) => ({ ...(await orig<typeof import("../lib/tasteRemote")>()), fetchTaste: async () => ({ picks: ["crafts/pottery"], windows: [], budget: null }) }));

const picks = vi.hoisted(() => ({
  keepPick: vi.fn(async (_pick: unknown, _owner: unknown) => ({}) as { error?: string; requested?: boolean }),
  undoKeep: vi.fn(async (_pick: unknown, _userId: string) => null as string | null),
}));
vi.mock("../lib/pickActions", () => picks);

import { Calendar } from "./Calendar";
import type { LiveEventInput } from "../lib/firstPlan";

const ny = (m: number, d: number, h: number) => nyTimeToMs(2026, m, d, h);
const NOW = ny(10, 30, 12);
const plan = (over: Partial<WeekPlanDetail> = {}): WeekPlanDetail => ({
  id: "session-5", kind: "session", title: "Bouldering night", startsAt: ny(10, 31, 19), color: "teal", mine: true, pursuitId: "p1", going: { friends: [], total: 1 }, cornerKey: "sports/climbing", ...over,
});
const stub: StubCard = { id: 1, kind: "regular", serial: 3, title: "Pottery #2", meta: "Oct 3", issuedAt: ny(10, 3, 15), corner: { spaceSlug: "crafts", slug: "pottery" } };
const data = (over: Partial<WeekData> = {}): WeekData => {
  const windows = over.windows ?? ["sat-day", "sat-eve"];
  return { status: "ready", now: NOW, windows, left: windowsLeft(windows, NOW), budget: 50, passes: [], plans: [], picks: [], goodHours: 0, reload: vi.fn(), saveBudget: vi.fn(async () => true), ...over };
};
const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: wide && (query.includes("744") || query.includes("1128")), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
};
const show = (url: string) => render(<MemoryRouter initialEntries={[url]}><Calendar /></MemoryRouter>);
const flush = () => act(async () => void (await Promise.resolve()));
const lastToast = () => toasts.calls[toasts.calls.length - 1];

// jsdom has no PointerEvent: a mouse event that also carries a pointer type is enough.
class TestPointerEvent extends MouseEvent {
  pointerType: string;
  pointerId: number;
  constructor(type: string, init: MouseEventInit & { pointerType?: string; pointerId?: number } = {}) {
    super(type, init);
    this.pointerType = init.pointerType ?? "mouse";
    this.pointerId = init.pointerId ?? 1;
  }
}
(window as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  window.localStorage.clear();
  setWide(false);
  auth.value = { user: { id: "u1" }, profile: { display_name: "Alex" }, isConfigured: true };
  hook.value = data();
  extra.value = { plans: [], stubs: [], failed: false };
  toasts.calls.length = 0;
  for (const f of Object.values(remote)) f.mockClear();
  for (const f of Object.values(picks)) f.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});


const climbing = { key: "sports/climbing", name: "Climbing", spaceSlug: "sports", slug: "climbing" };
const event = (id: number, over: Partial<LiveEventInput> = {}): LiveEventInput => ({
  cornerKey: climbing.key, eventId: id, title: `Climbing ${id}`, startsAt: ny(10, 31, 19), endsAt: ny(10, 31, 21), place: "Gowanus, Brooklyn", price: "Free", online: false, ...over,
});
const withEvents = (events: LiveEventInput[], over: Partial<WeekData> = {}) => {
  hook.value = data({ budget: 50, stubby: { picks: [climbing], events, pursuits: [], area: "" }, ...over });
};
const pickLabel = (title: string) => new RegExp(`^Stubby’s pick, .*${title}`);

describe("Stubby's picks", () => {
  beforeEach(() => setWide(true));

  it("puts one pick in a free stretch, with the label, the thing and Keep", () => {
    withEvents([event(1)]);
    show("/calendar?view=week");
    expect(screen.getByRole("button", { name: pickLabel("Climbing 1") })).toBeTruthy();
    expect(screen.getByText("Stubby’s pick")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep" })).toBeTruthy();
  });

  it("says Find something when nothing fits, never filler", () => {
    withEvents([]);
    show("/calendar?view=week");
    expect(screen.queryByText("Stubby’s pick")).toBeNull();
    expect(screen.getAllByRole("link", { name: "Find something" }).length).toBeGreaterThan(0);
  });

  it("does not pick a thing longer than the free stretch", () => {
    // 6 to 7 PM is all that is left of the evening after the plan at 7.
    withEvents([event(1, { startsAt: ny(10, 31, 18), endsAt: ny(10, 31, 20) })], { plans: [plan({ id: "event-77", kind: "event", startsAt: ny(10, 31, 19), endsAt: ny(10, 31, 20), pursuitId: undefined, mine: undefined })] });
    show("/calendar?view=week");
    expect(screen.queryByText("Stubby’s pick")).toBeNull();
  });

  it("keeps a pick as a plan with Undo, sending only the plan and nothing about the pick", async () => {
    withEvents([event(1)]);
    show("/calendar?view=week");
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    await flush();
    expect(picks.keepPick).toHaveBeenCalledTimes(1);
    expect(picks.keepPick.mock.calls[0][0]).toMatchObject({ id: "event:1", eventId: 1, title: "Climbing 1" });
    expect(lastToast().message).toBe("Plan made");
    // It is a plan now: not offered again while the plans reload.
    expect(screen.queryByText("Stubby’s pick")).toBeNull();
    lastToast().undo();
    await flush();
    expect(picks.undoKeep).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: pickLabel("Climbing 1") })).toBeTruthy();
  });

  it("says so when a Keep cannot be made, and keeps offering the pick", async () => {
    withEvents([event(1)]);
    picks.keepPick.mockResolvedValueOnce({ error: "Something went wrong. Try again." });
    show("/calendar?view=week");
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    await flush();
    expect(toasts.calls).toHaveLength(0);
    expect(screen.getByText("Stubby’s pick")).toBeTruthy();
  });

  it("opens the pick with its reason, and Not this swaps in the next match", async () => {
    withEvents([event(1), event(2, { startsAt: ny(10, 31, 21), endsAt: ny(10, 31, 23), title: "Late climbing" })]);
    show("/calendar?view=week");
    fireEvent.click(screen.getByRole("button", { name: pickLabel("Climbing 1") }));
    const sheet = screen.getByRole("dialog", { name: "Climbing 1" });
    expect(within(sheet).getByText("You said Saturday evenings work, and you picked Climbing.")).toBeTruthy();
    expect(within(sheet).getByText("Free")).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "Not this" }));
    await flush();
    expect(screen.getByRole("button", { name: pickLabel("Late climbing") })).toBeTruthy();
    expect(screen.queryByRole("button", { name: pickLabel("Climbing 1") })).toBeNull();
    // Kept in this browser only, and nothing was sent.
    expect(JSON.parse(window.localStorage.getItem("soosh.calendar.notthis.v1") ?? "{}")).toEqual({ "2026-10-31:sat-day": ["event:1"] });
    expect(picks.keepPick).not.toHaveBeenCalled();
    expect(picks.undoKeep).not.toHaveBeenCalled();
  });

  it("goes back to Find something after three Not this on one stretch", async () => {
    withEvents([1, 2, 3, 4].map((n) => event(n, { startsAt: ny(10, 31, 18 + n * 0), endsAt: ny(10, 31, 20) })));
    show("/calendar?view=week");
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole("button", { name: /^Stubby’s pick, / }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Not this" }));
      await flush();
    }
    expect(screen.queryByText("Stubby’s pick")).toBeNull();
    expect(screen.getAllByRole("link", { name: "Find something" }).length).toBeGreaterThan(0);
  });

  it("remembers Not this on a reload, in this browser", () => {
    window.localStorage.setItem("soosh.calendar.notthis.v1", JSON.stringify({ "2026-10-31:sat-day": ["event:1"] }));
    withEvents([event(1)]);
    show("/calendar?view=week");
    expect(screen.queryByText("Stubby’s pick")).toBeNull();
  });

  it("runs again when a block is added: the stretch is gone and so is its pick", async () => {
    withEvents([event(1)]);
    remote.fetchEntries.mockResolvedValueOnce([{ id: 3, kind: "block", startsAt: ny(10, 31, 18), endsAt: ny(10, 31, 23), repeat: "none" }]);
    show("/calendar?view=week");
    await flush();
    expect(screen.queryByText("Stubby’s pick")).toBeNull();
  });

  it("runs again when a plan is cancelled: the stretch opens and a pick comes back", async () => {
    withEvents([event(1)], { plans: [plan({ startsAt: ny(10, 31, 19) })] });
    show("/calendar?view=week");
    expect(screen.queryByText("Stubby’s pick")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Plan, 7 PM, Bouldering night" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel this plan" }));
    await flush();
    expect(screen.getByRole("button", { name: pickLabel("Climbing 1") })).toBeTruthy();
  });

  it("hides picks when Stubby's picks is turned off, and shows Find something", () => {
    withEvents([event(1)]);
    show("/calendar?view=week");
    fireEvent.click(screen.getByRole("checkbox", { name: /Stubby’s picks/ }));
    expect(screen.queryByText("Stubby’s pick")).toBeNull();
    expect(screen.getAllByRole("link", { name: "Find something" }).length).toBeGreaterThan(0);
  });

  it("shows a pick in the month and the list too", () => {
    withEvents([event(1)]);
    const { unmount } = show("/calendar");
    expect(screen.getByRole("button", { name: pickLabel("Climbing 1") })).toBeTruthy();
    unmount();
    show("/calendar?view=list");
    expect(screen.getByRole("button", { name: pickLabel("Climbing 1") })).toBeTruthy();
  });
});

describe("a pick that needs the host's approval", () => {
  beforeEach(() => setWide(true));
  const pottery = { key: "crafts/pottery", name: "Pottery", spaceSlug: "crafts", slug: "pottery" };
  const group = (needsApproval: boolean) => {
    hook.value = data({
      budget: 50,
      stubby: { picks: [pottery], events: [], pursuits: [{ cornerKey: pottery.key, pursuitId: "p9", title: "Pasta from scratch", startsAt: ny(10, 31, 19), hostName: "Priya Shah", needsApproval }], area: "" },
    });
  };

  it("says Ask to join, never Keep", () => {
    group(true);
    show("/calendar?view=week");
    expect(screen.getByRole("button", { name: "Ask to join" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Keep" })).toBeNull();
  });

  it("says Keep for a group you join at once", () => {
    group(false);
    show("/calendar?view=week");
    expect(screen.getByRole("button", { name: "Keep" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ask to join" })).toBeNull();
  });

  it("sends the request, says Request sent with Undo, and stops offering it", async () => {
    group(true);
    picks.keepPick.mockResolvedValueOnce({ requested: true });
    show("/calendar?view=week");
    fireEvent.click(screen.getByRole("button", { name: "Ask to join" }));
    await flush();
    expect(picks.keepPick).toHaveBeenCalledTimes(1);
    expect(lastToast().message).toBe("Request sent");
    expect(screen.queryByText("Stubby’s pick")).toBeNull();
    lastToast().undo();
    await flush();
    expect(picks.undoKeep).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Stubby’s pick")).toBeTruthy();
  });

  it("uses Ask to join in the pick's own sheet too", () => {
    group(true);
    show("/calendar?view=week");
    fireEvent.click(screen.getByRole("button", { name: /^Stubby’s pick, / }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Ask to join" })).toBeTruthy();
  });
});

describe("Stubby's picks on a phone", () => {
  it("shows the pick under the day in Month, with Keep", async () => {
    withEvents([event(1)]);
    show("/calendar");
    fireEvent.click(screen.getByRole("button", { name: /^Saturday Oct 31/ }));
    expect(screen.getByRole("button", { name: pickLabel("Climbing 1") })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    await flush();
    expect(picks.keepPick).toHaveBeenCalledTimes(1);
  });
});
