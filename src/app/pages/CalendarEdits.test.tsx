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
  moveSession: vi.fn(async () => null as string | null),
  leavePlan: vi.fn(async () => null as string | null),
  fetchConnections: vi.fn(async () => [] as { id: string; name: string }[]),
  addEntry: vi.fn(async (e: { kind: string; startsAt: number; endsAt: number; repeat?: string; note?: string }) => ({ entry: { id: 7, kind: e.kind, startsAt: e.startsAt, endsAt: e.endsAt, repeat: e.repeat ?? "none", note: e.note } })),
  removeEntry: vi.fn(async () => null as string | null),
  updateEntry: vi.fn(async () => null as string | null),
  fetchEntries: vi.fn(async () => [] as unknown[]),
  savePrivate: vi.fn(async () => ({ error: null as string | null })),
}));
vi.mock("../lib/planEdits", async (orig) => ({ ...(await orig<typeof import("../lib/planEdits")>()), createPlan: remote.createPlan, deleteSession: remote.deleteSession, moveSession: remote.moveSession, leavePlan: remote.leavePlan, fetchConnections: remote.fetchConnections }));
vi.mock("../lib/calendarEntries", async (orig) => ({ ...(await orig<typeof import("../lib/calendarEntries")>()), addEntry: remote.addEntry, removeEntry: remote.removeEntry, updateEntry: remote.updateEntry, fetchEntries: remote.fetchEntries }));
vi.mock("../lib/onboardingRemote", async (orig) => ({ ...(await orig<typeof import("../lib/onboardingRemote")>()), savePrivate: remote.savePrivate }));
vi.mock("../lib/tasteRemote", async (orig) => ({ ...(await orig<typeof import("../lib/tasteRemote")>()), fetchTaste: async () => ({ picks: ["crafts/pottery"], windows: [], budget: null }) }));

import { Calendar } from "./Calendar";

const ny = (m: number, d: number, h: number) => nyTimeToMs(2026, m, d, h);
const NOW = ny(10, 30, 12);
const plan = (over: Partial<WeekPlanDetail> = {}): WeekPlanDetail => ({
  id: "session-5", kind: "session", title: "Bouldering night", startsAt: ny(10, 31, 19), color: "teal", mine: true, pursuitId: "p1", going: { friends: [], total: 1 }, cornerKey: "sports/climbing", ...over,
});
const stub: StubCard = { id: 1, kind: "session", serial: 3, title: "Pottery #2", meta: "Oct 3", issuedAt: ny(10, 3, 15), corner: { spaceSlug: "crafts", slug: "pottery" } };
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
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Make a plan", () => {
  it("needs a Corner, offers the picked ones first, and searches the rest", async () => {
    show("/calendar");
    fireEvent.click(screen.getByRole("button", { name: "Make a plan" }));
    await flush();
    const make = screen.getByRole("button", { name: "Make the plan" }) as HTMLButtonElement;
    expect(make.disabled).toBe(true);
    expect(screen.getByText("Your Corners")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pottery" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Find a Corner"), { target: { value: "climb" } });
    expect(screen.getByRole("button", { name: /^Climbing$/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Find a Corner"), { target: { value: "zzzzzz" } });
    expect(screen.getByText("No Corner matches.")).toBeTruthy();
  });

  it("makes the plan for the day and part picked, and says it can be undone", async () => {
    show("/calendar");
    fireEvent.click(screen.getByRole("button", { name: "Make a plan" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Pottery" }));
    fireEvent.click(screen.getByRole("button", { name: "Evening" }));
    fireEvent.click(screen.getByRole("button", { name: "Make the plan" }));
    await flush();
    expect(remote.createPlan).toHaveBeenCalledTimes(1);
    expect(remote.createPlan.mock.calls[0][0]).toMatchObject({ title: "Pottery", cornerKey: "crafts/pottery", startsAt: ny(10, 30, 19) });
    expect(lastToast().message).toBe("Plan made");
    lastToast().undo();
    await flush();
    expect(remote.deleteSession).toHaveBeenCalledWith(41);
  });

  it("uses an exact time when one is typed, and refuses a time that has passed", async () => {
    show("/calendar");
    fireEvent.click(screen.getByRole("button", { name: "Make a plan" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Pottery" }));
    fireEvent.change(screen.getByLabelText("Exact time (optional)"), { target: { value: "20:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Make the plan" }));
    await flush();
    expect(remote.createPlan.mock.calls[0][0]).toMatchObject({ startsAt: ny(10, 30, 20) + 30 * 60_000 });
    cleanup();
    show("/calendar");
    fireEvent.click(screen.getByRole("button", { name: "Make a plan" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Pottery" }));
    fireEvent.change(screen.getByLabelText("Exact time (optional)"), { target: { value: "09:00" } });
    expect((screen.getByRole("button", { name: "Make the plan" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers a friend only when there are connections, and sends the pick", async () => {
    remote.fetchConnections.mockResolvedValueOnce([{ id: "f1", name: "Priya Shah" }]);
    show("/calendar");
    fireEvent.click(screen.getByRole("button", { name: "Make a plan" }));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Pottery" }));
    fireEvent.change(screen.getByLabelText("Bring a friend (optional)"), { target: { value: "f1" } });
    fireEvent.click(screen.getByRole("button", { name: "Make the plan" }));
    await flush();
    expect(remote.createPlan.mock.calls[0][0]).toMatchObject({ friendId: "f1" });
  });
});

describe("empty hours", () => {
  beforeEach(() => setWide(true));
  const column = () => document.querySelectorAll<HTMLElement>(".cursor-cell")[0];

  it("opens the time sheet for the hour tapped, with the three choices", async () => {
    show("/calendar?view=week");
    // 7 AM at the top, 48px an hour: 288px down is 1 PM.
    fireEvent.click(column(), { clientY: 288 });
    await flush();
    expect(screen.getByRole("dialog", { name: "Friday, 1 PM" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Make a plan at 1 PM" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "I’m free then" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Block this time" })).toBeTruthy();
  });

  it("opens the plan form with the time filled in", async () => {
    show("/calendar?view=week");
    fireEvent.click(column(), { clientY: 288 });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Make a plan at 1 PM" }));
    await flush();
    expect((screen.getByLabelText("Exact time (optional)") as HTMLInputElement).value).toBe("13:00");
    expect(screen.getByRole("button", { name: "Daytime", pressed: true })).toBeTruthy();
  });

  it("adds free time once or every week, and Undo takes it away", async () => {
    show("/calendar?view=week");
    fireEvent.click(column(), { clientY: 288 });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "I’m free then" }));
    fireEvent.click(screen.getByRole("button", { name: "Every Friday" }));
    await flush();
    expect(remote.addEntry).toHaveBeenCalledWith({ kind: "free", startsAt: ny(10, 30, 13), endsAt: ny(10, 30, 18), repeat: "weekly" });
    expect(lastToast().message).toBe("Free time added");
    lastToast().undo();
    await flush();
    expect(remote.removeEntry).toHaveBeenCalledWith(7);
  });

  it("adds a block with an optional note and shows it, hatched, with the note", async () => {
    show("/calendar?view=week");
    fireEvent.click(column(), { clientY: 288 });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Block this time" }));
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Dentist" } });
    expect(screen.getByText("Only you see this.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Just this once" }));
    await flush();
    expect(remote.addEntry).toHaveBeenCalledWith({ kind: "block", startsAt: ny(10, 30, 13), endsAt: ny(10, 30, 18), repeat: "none", note: "Dentist" });
    expect(screen.getByRole("button", { name: "Block, 1 to 6 PM, Dentist" })).toBeTruthy();
  });

  it("hides blocks when Your blocks is off", async () => {
    show("/calendar?view=week");
    fireEvent.click(column(), { clientY: 288 });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Block this time" }));
    fireEvent.click(screen.getByRole("button", { name: "Just this once" }));
    await flush();
    expect(screen.getByRole("button", { name: /^Block, / })).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: /Your blocks/ }));
    expect(screen.queryByRole("button", { name: /^Block, / })).toBeNull();
  });

  it("selects a range by dragging across empty hours with a mouse", async () => {
    show("/calendar?view=week");
    const col = column();
    fireEvent.pointerDown(col, { button: 0, pointerType: "mouse", clientY: 240, clientX: 10, pointerId: 1 });
    fireEvent.pointerMove(col, { pointerType: "mouse", clientY: 336, clientX: 10, pointerId: 1 });
    fireEvent.pointerUp(col, { pointerType: "mouse", clientY: 336, clientX: 10, pointerId: 1 });
    await flush();
    // 240px is 12 PM, 336px is 2 PM.
    expect(screen.getByRole("dialog", { name: "Friday, 12 PM" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Block this time" }));
    fireEvent.click(screen.getByRole("button", { name: "Just this once" }));
    await flush();
    expect(remote.addEntry).toHaveBeenCalledWith(expect.objectContaining({ startsAt: ny(10, 30, 12), endsAt: ny(10, 30, 14) }));
  });
});

describe("tapping a plan", () => {
  beforeEach(() => {
    hook.value = data({ plans: [plan()] });
  });
  const openPlan = () => {
    show("/calendar");
    fireEvent.click(screen.getByRole("button", { name: /^Saturday Oct 31/ }));
    fireEvent.click(screen.getByRole("button", { name: "Plan, 7 PM, Bouldering night" }));
  };

  it("offers change, bring and cancel for a plan only you are in", () => {
    hook.value = data({ plans: [plan({ kind: "session" })] });
    openPlan();
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("button", { name: "Change the time" })).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: "Bring someone" })).toBeTruthy();
    expect(within(sheet).getByRole("button", { name: "Cancel this plan" })).toBeTruthy();
  });

  it("cancels at once on screen, sends nothing for 6 seconds, then deletes it", async () => {
    openPlan();
    fireEvent.click(screen.getByRole("button", { name: "Cancel this plan" }));
    expect(lastToast().message).toBe("Plan removed");
    expect(screen.queryByRole("button", { name: "Plan, 7 PM, Bouldering night" })).toBeNull();
    expect(remote.deleteSession).not.toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(5900));
    expect(remote.deleteSession).not.toHaveBeenCalled();
    await act(async () => void vi.advanceTimersByTime(200));
    expect(remote.deleteSession).toHaveBeenCalledWith(5);
  });

  it("brings the plan back and sends nothing when Undo is tapped", async () => {
    openPlan();
    fireEvent.click(screen.getByRole("button", { name: "Cancel this plan" }));
    act(() => lastToast().undo());
    await act(async () => void vi.advanceTimersByTime(7000));
    expect(remote.deleteSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Saturday Oct 31/ }));
    expect(screen.getByRole("button", { name: "Plan, 7 PM, Bouldering night" })).toBeTruthy();
  });

  it("leaves a host's listing by taking only you out, after the 6 seconds", async () => {
    hook.value = data({ plans: [plan({ id: "event-9", kind: "event", pursuitId: undefined, mine: undefined })] });
    openPlan();
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).queryByRole("button", { name: "Cancel this plan" })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: "Change the time" })).toBeNull();
    fireEvent.click(within(sheet).getByRole("button", { name: "Leave this plan" }));
    expect(lastToast().message).toBe("You left the plan");
    await act(async () => void vi.advanceTimersByTime(6100));
    expect(remote.leavePlan).toHaveBeenCalledTimes(1);
    expect(remote.leavePlan.mock.calls[0]).toMatchObject([{ id: "event-9", kind: "event" }, "u1"]);
  });

  it("skips a session of a longer Pursuit and moves it", async () => {
    hook.value = data({ plans: [plan({ session: { n: 2, total: 5 } })] });
    show("/calendar");
    fireEvent.click(screen.getByRole("button", { name: /^Saturday Oct 31/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pursuit session, 7 PM, Bouldering night" }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("link", { name: "Open Pursuit" }).getAttribute("href")).toBe("/pursuit/p1");
    fireEvent.click(within(sheet).getByRole("button", { name: "Move this session" }));
    fireEvent.change(screen.getByLabelText("When"), { target: { value: "18:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await flush();
    expect(remote.moveSession).toHaveBeenCalledWith(5, ny(10, 31, 18) + 30 * 60_000);
    expect(lastToast().message).toBe("Time changed");
    lastToast().undo();
    await flush();
    expect(remote.moveSession).toHaveBeenLastCalledWith(5, ny(10, 31, 19));
  });

  it("puts the plan back and says so when the send fails", async () => {
    remote.deleteSession.mockResolvedValueOnce("Something went wrong. Try again.");
    openPlan();
    fireEvent.click(screen.getByRole("button", { name: "Cancel this plan" }));
    await act(async () => void vi.advanceTimersByTime(6100));
    await flush();
    fireEvent.click(screen.getByRole("button", { name: /^Saturday Oct 31/ }));
    expect(screen.getByRole("button", { name: "Plan, 7 PM, Bouldering night" })).toBeTruthy();
  });
});

describe("tapping free time, a block and a Stub", () => {
  it("opens a Stub as its ticket", () => {
    extra.value = { plans: [], stubs: [stub], failed: false };
    show("/calendar");
    fireEvent.click(screen.getByRole("button", { name: /^Saturday Oct 3,/ }));
    fireEvent.click(screen.getByRole("button", { name: "Stub, Pottery #2" }));
    const sheet = screen.getByRole("dialog", { name: "Stub" });
    expect(within(sheet).getByText("Pottery #2")).toBeTruthy();
  });

  it("marks one free slot not free, once, with Undo", async () => {
    show("/calendar");
    fireEvent.click(screen.getByRole("button", { name: /^Saturday Oct 31/ }));
    fireEvent.click(screen.getByRole("button", { name: "Free all day" }));
    // The usual week is changed on its own screen.
    expect(screen.getByRole("link", { name: "Change the times" }).getAttribute("href")).toBe("/week/free?from=week");
    fireEvent.click(screen.getByRole("button", { name: "Not free this Saturday" }));
    await flush();
    expect(remote.addEntry).toHaveBeenCalledWith(expect.objectContaining({ kind: "busy" }));
    expect(lastToast().message).toBe("Marked not free");
  });

  it("removes a slot from the usual week and puts it back on Undo", async () => {
    show("/calendar");
    fireEvent.click(screen.getByRole("button", { name: /^Saturday Oct 31/ }));
    fireEvent.click(screen.getByRole("button", { name: "Free all day" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from my usual week" }));
    await flush();
    expect(remote.savePrivate).toHaveBeenCalledWith("u1", { free_windows: null });
    lastToast().undo();
    await flush();
    expect(remote.savePrivate).toHaveBeenLastCalledWith("u1", { free_windows: ["sat-day", "sat-eve"] });
  });
});

describe("dragging with a mouse", () => {
  beforeEach(() => setWide(true));

  it("moves a plan only you are in, snapped to 15 minutes, and Undo moves it back", async () => {
    hook.value = data({ plans: [plan()] });
    show("/calendar?view=week");
    const block = screen.getByRole("button", { name: "Plan, 7 PM, Bouldering night" });
    fireEvent.pointerDown(block, { button: 0, pointerType: "mouse", clientX: 0, clientY: 0 });
    fireEvent.pointerMove(block, { pointerType: "mouse", clientX: 0, clientY: 100 });
    fireEvent.pointerUp(block, { pointerType: "mouse", clientX: 0, clientY: 100 });
    await flush();
    // 100px is a little over 2 hours; it snaps to 2 hours.
    expect(remote.moveSession).toHaveBeenCalledWith(5, ny(10, 31, 21));
    lastToast().undo();
    await flush();
    expect(remote.moveSession).toHaveBeenLastCalledWith(5, ny(10, 31, 19));
  });

  it("opens the sheet instead when it is only a click", async () => {
    hook.value = data({ plans: [plan()] });
    show("/calendar?view=week");
    const block = screen.getByRole("button", { name: "Plan, 7 PM, Bouldering night" });
    fireEvent.pointerDown(block, { button: 0, pointerType: "mouse", clientX: 0, clientY: 0 });
    fireEvent.pointerUp(block, { pointerType: "mouse", clientX: 0, clientY: 2 });
    fireEvent.click(block);
    await flush();
    expect(remote.moveSession).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Bouldering night" })).toBeTruthy();
  });

  it("never drags a host's listing or a session of a longer Pursuit", async () => {
    hook.value = data({ plans: [plan({ id: "event-9", kind: "event", mine: undefined, pursuitId: undefined })] });
    show("/calendar?view=week");
    const block = screen.getByRole("button", { name: "Plan, 7 PM, Bouldering night" });
    fireEvent.pointerDown(block, { button: 0, pointerType: "mouse", clientX: 0, clientY: 0 });
    fireEvent.pointerMove(block, { pointerType: "mouse", clientX: 0, clientY: 100 });
    fireEvent.pointerUp(block, { pointerType: "mouse", clientX: 0, clientY: 100 });
    await flush();
    expect(remote.moveSession).not.toHaveBeenCalled();
  });

  it("deletes a plan only you are in with the Delete key, with Undo", async () => {
    hook.value = data({ plans: [plan()] });
    show("/calendar?view=week");
    fireEvent.keyDown(screen.getByRole("button", { name: "Plan, 7 PM, Bouldering night" }), { key: "Delete" });
    expect(lastToast().message).toBe("Plan removed");
    expect(screen.queryByRole("button", { name: "Plan, 7 PM, Bouldering night" })).toBeNull();
  });

  it("changes a block's end by its bottom edge and moves it by dragging", async () => {
    show("/calendar?view=week");
    const column = document.querySelectorAll<HTMLElement>(".cursor-cell")[0];
    fireEvent.click(column, { clientY: 288 });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Block this time" }));
    fireEvent.click(screen.getByRole("button", { name: "Just this once" }));
    await flush();
    const block = screen.getByRole("button", { name: /^Block, / });
    fireEvent.pointerDown(block, { button: 0, pointerType: "mouse", clientX: 0, clientY: 0 });
    fireEvent.pointerMove(block, { pointerType: "mouse", clientX: 0, clientY: 48 });
    fireEvent.pointerUp(block.parentElement as HTMLElement, { pointerType: "mouse", clientX: 0, clientY: 48 });
    await flush();
    // An hour later: 2 to 7 PM.
    expect(remote.updateEntry).toHaveBeenCalledWith(7, expect.objectContaining({ startsAt: ny(10, 30, 14), endsAt: ny(10, 30, 19) }));
  });
});
