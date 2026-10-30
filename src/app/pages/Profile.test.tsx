// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchProfile: vi.fn(),
  fetchMoments: vi.fn(),
  fetchStubs: vi.fn(),
  fetchPursuits: vi.fn(),
  fetchMyPlanning: vi.fn(),
  savePlanning: vi.fn(),
  setPlanningPaused: vi.fn(),
  saveProfileDetails: vi.fn(),
  createPursuit: vi.fn(),
  setPursuitFinished: vi.fn(),
  setPursuitArchived: vi.fn(),
  deletePursuit: vi.fn(),
  suggestPlan: vi.fn(),
  resolveHandle: vi.fn(),
  sendPlanInvite: vi.fn(),
}));
vi.mock("../lib/profileApi", async (orig) => ({ ...(await orig<typeof import("../lib/profileApi")>()), ...api }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me" }, profile: { username: "maya" }, isConfigured: true }),
}));
vi.mock("../lib/profileFollows", () => ({ follow: vi.fn(), unfollow: vi.fn() }));
vi.mock("../context/SocialContext", () => ({ useSocial: () => ({ block: vi.fn(), report: vi.fn() }) }));
const toast = vi.hoisted(() => ({ notify: vi.fn(), notifyError: vi.fn() }));
vi.mock("../components/ui/toaster", () => toast);
vi.mock("../../lib/supabase", () => ({ supabase: null, isSupabaseConfigured: false }));

import { Profile } from "./Profile";

const base = { id: "p1", username: "maya", displayName: "Maya Lin", avatarUrl: null, followState: "none", private: false, neighborhood: "Greenpoint, Brooklyn", bio: "Climbs.", stubCount: 7, pursuitCount: 2, friendCount: 3, level: { index: 4, name: "Weekend Regular" } };
const owner = { ...base, role: "owner", stubsToNext: 3, planningPaused: false, isPrivate: false };
const friend = { ...base, role: "friend", followState: "accepted", followsYou: true, planningPaused: false, mutualFriends: [], mutualFriendCount: 0, sharedCategories: ["Climbing", "Pottery"] };
const emptyPlanning = { availability: [], freeHoursPerWeek: null, monthlyBudgetCents: null, memberships: [], shareMembershipsWithFriends: true, calendarConnected: false, planningPaused: false };
const pursuit = (over: object) => ({ id: "x", category: "Climbing", goal: "Send my first V4", target: 5, momentCount: 2, stubCount: 2, finished: false, archived: false, lastMomentDate: null, finishedAt: null, sharedWithYou: false, ...over });
const ok = <T,>(value: T) => Promise.resolve({ ok: true as const, value });

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}
function show(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Where />
      <Routes>
        <Route path="/you" element={<Profile />} />
        <Route path="/u/:username" element={<Profile />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  toast.notify.mockReset();
  toast.notifyError.mockReset();
  api.fetchMoments.mockImplementation(() => ok({ total: 0, items: [] }));
  api.fetchStubs.mockImplementation(() => ok([]));
  api.fetchPursuits.mockImplementation(() => ok([]));
  api.fetchMyPlanning.mockImplementation(() => ok(emptyPlanning));
});
afterEach(cleanup);

describe("Profile tabs", () => {
  it("switches tabs, keeps the tab in the URL and answers arrow keys", async () => {
    api.fetchProfile.mockImplementation(() => ok(owner));
    show("/you");
    const moments = await screen.findByRole("tab", { name: "Moments" });
    expect(moments.getAttribute("aria-selected")).toBe("true");
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Stubs" }), { button: 0, ctrlKey: false });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/you?tab=stubs"));
    expect(await screen.findByText("No Stubs yet. Log a Moment toward a Pursuit to earn one.")).toBeTruthy();
    const stubs = screen.getByRole("tab", { name: "Stubs" });
    stubs.focus();
    fireEvent.keyDown(stubs, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("tab", { name: "Pursuits" }).getAttribute("aria-selected")).toBe("true"));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/you?tab=pursuits"));
  });

  it("opens straight on the tab named in the URL", async () => {
    api.fetchProfile.mockImplementation(() => ok(owner));
    show("/you?tab=pursuits");
    expect((await screen.findByRole("tab", { name: "Pursuits" })).getAttribute("aria-selected")).toBe("true");
  });
});

describe("Pursuits", () => {
  it("filters between Active and Finished", async () => {
    api.fetchProfile.mockImplementation(() => ok(owner));
    api.fetchPursuits.mockImplementation(() =>
      ok([pursuit({ id: "a", goal: "Send my first V4" }), pursuit({ id: "b", goal: "Sourdough, 10 loaves", category: "Baking", target: null, finished: true, finishedAt: "2026-10-12", stubCount: 1 })]),
    );
    show("/you?tab=pursuits");
    expect(await screen.findByText("Send my first V4")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Active · 1" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Sourdough, 10 loaves")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Finished · 1" }));
    expect(screen.getByText("Sourdough, 10 loaves")).toBeTruthy();
    expect(screen.getByText("Finished Oct 12 · 1 Stub")).toBeTruthy();
  });
});

describe("Pause planning", () => {
  it("turns on right away and goes back if saving fails", async () => {
    api.fetchProfile.mockImplementation(() => ok(owner));
    api.setPlanningPaused.mockImplementation(() => Promise.resolve({ ok: false, message: "x" }));
    show("/you");
    const sw = await screen.findByRole("switch", { name: "Pause planning" });
    expect(sw.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(sw);
    expect(api.setPlanningPaused).toHaveBeenCalledWith(true);
    await waitFor(() => expect(screen.getByRole("switch", { name: "Pause planning" }).getAttribute("aria-checked")).toBe("false"));
    expect(toast.notifyError).toHaveBeenCalled();
  });

  it("stays on when saving works", async () => {
    api.fetchProfile.mockImplementation(() => ok(owner));
    api.setPlanningPaused.mockImplementation(() => ok(null));
    show("/you");
    fireEvent.click(await screen.findByRole("switch", { name: "Pause planning" }));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Pause planning" }).getAttribute("aria-checked")).toBe("true"));
  });
});

describe("Friend view", () => {
  it("shows the You both card and no planning card", async () => {
    api.fetchProfile.mockImplementation(() => ok(friend));
    show("/u/maya");
    expect(await screen.findByText("Climbing and Pottery.")).toBeTruthy();
    expect(screen.queryByText("Your planning")).toBeNull();
    expect(screen.queryByText("Edit profile")).toBeNull();
  });

  it("replaces Plan something together when they paused planning", async () => {
    api.fetchProfile.mockImplementation(() => ok({ ...friend, planningPaused: true }));
    show("/u/maya");
    expect(await screen.findByText("Maya isn’t taking plans right now")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Plan something together" })).toBeNull();
  });

  it("plans together: pick a time, send, toast", async () => {
    api.fetchProfile.mockImplementation(() => ok(friend));
    api.suggestPlan.mockImplementation(() =>
      ok({ status: "ok", slots: [{ date: "2026-11-07", part: "afternoon" }, { date: "2026-11-08", part: "evening" }], categories: ["Climbing", "Something new"], place: { name: "Brooklyn Boulders", note: "You both have memberships here" } }),
    );
    api.sendPlanInvite.mockImplementation(() => ok("plan-1"));
    show("/u/maya");
    fireEvent.click(await screen.findByRole("button", { name: "Plan something together" }));
    expect((await screen.findAllByText("Plan with Maya")).length).toBeGreaterThan(0);
    const send = screen.getByRole("button", { name: "Send invite" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    const radio = await screen.findByRole("radio", { name: /Sat, Nov 7/ });
    fireEvent.click(radio);
    expect(radio.getAttribute("aria-checked")).toBe("true");
    expect(send.disabled).toBe(false);
    expect(screen.getByText("You both have memberships here")).toBeTruthy();
    fireEvent.click(send);
    await waitFor(() => expect(api.sendPlanInvite).toHaveBeenCalledWith("p1", null, { date: "2026-11-07", part: "afternoon" }, "Brooklyn Boulders"));
    expect(toast.notify).toHaveBeenCalledWith("Invite sent to Maya");
  });

  it("offers an open invite when no times are shared", async () => {
    api.fetchProfile.mockImplementation(() => ok(friend));
    api.suggestPlan.mockImplementation(() => ok({ status: "ok", slots: [], categories: ["Something new"] }));
    api.sendPlanInvite.mockImplementation(() => ok("plan-2"));
    show("/u/maya");
    fireEvent.click(await screen.findByRole("button", { name: "Plan something together" }));
    expect(await screen.findByText("No shared times in the next 2 weeks.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send an open invite" }));
    await waitFor(() => expect(api.sendPlanInvite).toHaveBeenCalledWith("p1", null, null, null));
  });
});

describe("Other viewers", () => {
  it("shows a private profile as identity, level name and a Follow button only", async () => {
    api.fetchProfile.mockImplementation(() => ok({ id: "p1", username: "maya", displayName: "Maya Lin", avatarUrl: null, followState: "none", role: "public", private: true, levelName: "Plan Maker" }));
    show("/u/maya");
    expect(await screen.findByText("This profile is private.")).toBeTruthy();
    expect(screen.getByText("Plan Maker")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Follow" })).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("says Follow back when they already follow you", async () => {
    api.fetchProfile.mockImplementation(() => ok({ ...base, role: "public", followsYou: true }));
    show("/u/maya");
    expect(await screen.findByRole("button", { name: "Follow back" })).toBeTruthy();
    expect(screen.queryByText("Your planning")).toBeNull();
  });

  it("sends a link made from a display name to the username it belongs to", async () => {
    api.fetchProfile.mockImplementation((h: string) => ok(h === "maya" ? friend : null));
    api.resolveHandle.mockImplementation(() => ok("maya"));
    show("/u/Maya%20Lin");
    expect(await screen.findByRole("heading", { name: "Maya Lin" })).toBeTruthy();
    expect(api.resolveHandle).toHaveBeenCalledWith("Maya Lin");
    expect(screen.getByTestId("where").textContent).toBe("/u/maya");
  });

  it("still shows the 404 when a display name matches nobody, or more than one person", async () => {
    api.fetchProfile.mockImplementation(() => ok(null));
    api.resolveHandle.mockImplementation(() => ok(null));
    show("/u/Nobody");
    expect(await screen.findByText("This page doesn’t exist")).toBeTruthy();
    expect(screen.getByTestId("where").textContent).toBe("/u/Nobody");
  });

  it("shows the standard 404 for a blocked or missing profile", async () => {
    api.fetchProfile.mockImplementation(() => ok(null));
    api.resolveHandle.mockImplementation(() => ok(null));
    show("/u/maya");
    expect(await screen.findByText("This page doesn’t exist")).toBeTruthy();
  });

  it("shows an error with a retry when the profile cannot load", async () => {
    api.fetchProfile.mockImplementationOnce(() => Promise.resolve({ ok: false, message: "x" }));
    api.fetchProfile.mockImplementation(() => ok(friend));
    show("/u/maya");
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Maya Lin" })).toBeTruthy();
  });
});

describe("New user", () => {
  const fresh = { ...owner, stubCount: 0, pursuitCount: 0, level: { index: 1, name: "Just Getting Started" }, stubsToNext: 1, neighborhood: null, bio: null };

  it("shows the first-run profile", async () => {
    api.fetchProfile.mockImplementation(() => ok(fresh));
    show("/you");
    expect(await screen.findByText("Add your neighborhood and a short bio")).toBeTruthy();
    expect(screen.getByText("Level 1 of 8")).toBeTruthy();
    expect(screen.getByText("Log 1 Moment to earn your first Stub and reach First Step.")).toBeTruthy();
    expect(screen.getByText("Your Moments show up here.")).toBeTruthy();
    expect(screen.queryByText(/never the exact time/)).toBeNull();
    expect(screen.getAllByText("Add").length).toBe(5);
    expect(screen.getByText("Add when you’re usually free to get plan suggestions.")).toBeTruthy();
  });

  it("starts an ongoing Pursuit for each pill, lets you pick more than one, and undoes a failed pick", async () => {
    api.fetchProfile.mockImplementation(() => ok(fresh));
    api.createPursuit.mockImplementationOnce(() => ok("id-1"));
    api.createPursuit.mockImplementationOnce(() => Promise.resolve({ ok: false, message: "x" }));
    api.createPursuit.mockImplementationOnce(() => ok("id-3"));
    show("/you");
    const group = (await screen.findByText("Pick your Pursuits")).closest("section")!;
    const climbing = within(group).getByRole("button", { name: "Climbing" });
    fireEvent.click(climbing);
    expect(climbing.getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(api.createPursuit).toHaveBeenCalledWith("Climbing", "Climbing", null));
    fireEvent.click(within(group).getByRole("button", { name: "Pottery" }));
    await waitFor(() => expect(within(group).getByRole("button", { name: "Pottery" }).getAttribute("aria-pressed")).toBe("false"));
    expect(toast.notifyError).toHaveBeenCalled();
    fireEvent.click(within(group).getByRole("button", { name: "Cooking" }));
    await waitFor(() => expect(api.createPursuit).toHaveBeenCalledWith("Cooking", "Cooking", null));
    expect(within(group).getByRole("button", { name: "Climbing" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("takes a pick back when the pill is tapped again", async () => {
    api.fetchProfile.mockImplementation(() => ok(fresh));
    api.createPursuit.mockImplementation(() => ok("id-1"));
    api.deletePursuit.mockImplementation(() => ok(null));
    show("/you");
    const group = (await screen.findByText("Pick your Pursuits")).closest("section")!;
    fireEvent.click(within(group).getByRole("button", { name: "Yoga" }));
    await waitFor(() => expect(api.createPursuit).toHaveBeenCalled());
    await waitFor(() => expect(api.fetchProfile.mock.calls.length).toBeGreaterThan(1));
    fireEvent.click(within(group).getByRole("button", { name: "Yoga" }));
    await waitFor(() => expect(api.deletePursuit).toHaveBeenCalledWith("id-1"));
    expect(within(group).getByRole("button", { name: "Yoga" }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("Pursuit actions", () => {
  const open = async () => {
    api.fetchProfile.mockImplementation(() => ok(owner));
    api.fetchPursuits.mockImplementation(() => ok([pursuit({ id: "a" })]));
    api.fetchMoments.mockImplementation(() => ok({ total: 0, items: [] }));
    show("/you?tab=pursuits");
    fireEvent.click(await screen.findByRole("button", { name: /Send my first V4/ }));
    await screen.findByRole("button", { name: "Finish" });
  };

  it("asks only for that Pursuit's Moments, never the whole list", async () => {
    api.fetchProfile.mockImplementation(() => ok(owner));
    api.fetchPursuits.mockImplementation(() => ok([pursuit({ id: "a", goal: "Send my first V4" }), pursuit({ id: "b", goal: "Learn the wheel", category: "Pottery" })]));
    api.fetchMoments.mockImplementation(() => ok({ total: 0, items: [] }));
    show("/you?tab=pursuits");
    fireEvent.click(await screen.findByRole("button", { name: /Send my first V4/ }));
    await waitFor(() => expect(api.fetchMoments).toHaveBeenCalledWith("p1", 100, 0, "a"));
    // Every Moments request while a detail is open names the Pursuit: none is unfiltered.
    expect(api.fetchMoments.mock.calls.every((c) => c[3] === "a")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Finish" })).toBeNull());
    api.fetchMoments.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /Learn the wheel/ }));
    await waitFor(() => expect(api.fetchMoments).toHaveBeenCalledWith("p1", 100, 0, "b"));
    expect(api.fetchMoments.mock.calls.every((c) => c[3] === "b")).toBe(true);
  });

  it("says Finish, not Mark finished, and finishes right away", async () => {
    api.setPursuitFinished.mockImplementation(() => ok(null));
    await open();
    expect(screen.queryByText("Mark finished")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(api.setPursuitFinished).toHaveBeenCalledWith("a", true));
  });

  it("archives, and shows it under Archived", async () => {
    api.setPursuitArchived.mockImplementation(() => ok(null));
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(api.setPursuitArchived).toHaveBeenCalledWith("a", true));
    expect(await screen.findByRole("button", { name: "Archived · 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Active · 0" })).toBeTruthy();
  });

  it("asks before deleting, and puts the Pursuit back if deleting fails", async () => {
    api.deletePursuit.mockImplementation(() => Promise.resolve({ ok: false, message: "x" }));
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Its Stubs go with it. Its Moments stay. To keep the Stubs, archive it instead.")).toBeTruthy();
    expect(api.deletePursuit).not.toHaveBeenCalled();
    const confirm = screen.getAllByRole("button", { name: "Delete" }).at(-1)!;
    fireEvent.click(confirm);
    await waitFor(() => expect(api.deletePursuit).toHaveBeenCalledWith("a"));
    await waitFor(() => expect(toast.notifyError).toHaveBeenCalled());
    expect(await screen.findByText("Send my first V4")).toBeTruthy();
  });
});

describe("Planning prompt", () => {
  it("is shown once and goes away when dismissed", async () => {
    localStorage.clear();
    api.fetchProfile.mockImplementation(() => ok(owner));
    show("/you");
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByText("Add when you’re usually free to get plan suggestions.")).toBeNull();
    cleanup();
    show("/you");
    await screen.findByText("Your planning");
    expect(screen.queryByText("Add when you’re usually free to get plan suggestions.")).toBeNull();
  });

  it("is not shown once availability is set", async () => {
    localStorage.clear();
    api.fetchProfile.mockImplementation(() => ok(owner));
    api.fetchMyPlanning.mockImplementation(() => ok({ ...emptyPlanning, availability: [{ day: "thu", part: "evening" }] }));
    show("/you");
    await screen.findByText("Thu evenings");
    expect(screen.queryByText("Add when you’re usually free to get plan suggestions.")).toBeNull();
  });

  it("shows the plan sheet the same empty answer when someone has no availability", async () => {
    api.fetchProfile.mockImplementation(() => ok(friend));
    api.suggestPlan.mockImplementation(() => ok({ status: "ok", slots: [], categories: ["Something new"] }));
    show("/u/maya");
    fireEvent.click(await screen.findByRole("button", { name: "Plan something together" }));
    expect(await screen.findByText("No shared times in the next 2 weeks.")).toBeTruthy();
    expect(screen.queryByText(/hasn.t (set|added)|no availability/i)).toBeNull();
  });
});
