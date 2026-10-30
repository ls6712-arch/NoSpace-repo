// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("heic2any", () => ({ default: vi.fn() }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

const flow = vi.hoisted(() => ({ next: vi.fn(), finish: vi.fn(), react: vi.fn(), setStubby: vi.fn(), redirectTo: "/" }));
vi.mock("../OnboardingContext", () => ({ useOnboarding: () => flow }));
vi.mock("../StepStubby", () => ({ StepStubby: () => <div data-testid="stubby" /> }));
vi.mock("../../../components/stubby/Stubby", () => ({ Stubby: () => <span data-testid="eyes" /> }));

const auth = vi.hoisted(() => ({
  user: { id: "u1", created_at: "2026-10-05T12:00:00Z" },
  profile: { display_name: "Mia Chen", username: "mia", avatar_url: undefined as string | undefined },
  refreshProfile: vi.fn(),
}));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../../../context/CornersContext", () => ({ useCorners: () => ({ allCorners: [] }) }));

const sb = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase", () => ({ supabase: sb }));

const picker = vi.hoisted(() => ({ onChange: null as null | ((u: string | undefined) => void) }));
vi.mock("../../../components/AvatarPicker", () => ({
  AvatarPicker: (p: { onChange: (u: string | undefined) => void }) => {
    picker.onChange = p.onChange;
    return <div data-testid="picker" />;
  },
}));

const remote = vi.hoisted(() => ({ loadPlanInput: vi.fn(), goToPlan: vi.fn(), tearOffHalf: vi.fn() }));
vi.mock("../../../lib/firstPlanRemote", () => remote);

import { CardScreen } from "./CardScreen";
import { InviteScreen, shareMessage } from "./InviteScreen";
import { PlanScreen } from "./PlanScreen";
import { saveHalf } from "../../../lib/firstPlanHandoff";

const NOW = new Date(2026, 9, 28, 10, 0, 0).getTime();
const at = (day: number, h: number) => new Date(2026, 9, day, h, 0, 0).getTime();
const input = (over: Record<string, unknown> = {}) => ({
  now: NOW,
  picks: [{ key: "sports-fitness/climbing", name: "Climbing", spaceSlug: "sports-fitness", slug: "climbing" }],
  windows: ["thu-eve"],
  budget: 50,
  passes: [],
  events: [{ cornerKey: "sports-fitness/climbing", eventId: 7, title: "Bouldering night", startsAt: at(29, 19), place: "Williamsburg", price: "Free", online: false }],
  pursuits: [],
  invite: null,
  city: "New York",
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  Object.values(flow).forEach((f) => typeof f === "function" && (f as ReturnType<typeof vi.fn>).mockReset());
  remote.loadPlanInput.mockReset().mockResolvedValue(input());
  remote.goToPlan.mockReset().mockResolvedValue({});
  remote.tearOffHalf.mockReset().mockResolvedValue({ half: { url: "https://x.test/#/join/tok", title: "Bouldering night", when: "Thursday, 7:00 PM" }, ownPursuitId: "p9" });
  sb.rpc.mockReset().mockResolvedValue({ data: 12, error: null });
  auth.refreshProfile.mockReset();
  auth.profile.avatar_url = undefined;
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the member card (screen 10)", () => {
  it("shows the number, first name and joined month, and asks for a photo with Later the same size", async () => {
    render(<CardScreen />);
    expect(screen.getByRole("heading", { name: "Put a face on your card" })).toBeTruthy();
    await waitFor(() => expect(screen.getByText("No. 12")).toBeTruthy());
    expect(screen.getByText("Mia")).toBeTruthy();
    expect(screen.queryByText("Chen")).toBeNull();
    expect(screen.getByText("Joined October 2026")).toBeTruthy();
    const add = screen.getByRole("button", { name: "Add a photo" }) as HTMLButtonElement;
    const later = screen.getByRole("button", { name: "Later" });
    expect(add.disabled).toBe(true);
    expect(add.getAttribute("data-on-dark")).toBe(later.getAttribute("data-on-dark"));
    fireEvent.click(later);
    expect(flow.next).toHaveBeenCalledTimes(1);
  });

  it("moves on with a photo, and Stubby stamps when one is added", async () => {
    render(<CardScreen />);
    await act(async () => picker.onChange?.("https://img.test/me.jpg"));
    expect(auth.refreshProfile).toHaveBeenCalled();
    expect(flow.react).toHaveBeenCalledWith("stamped");
    const next = screen.getByRole("button", { name: "Next" }) as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    fireEvent.click(next);
    expect(flow.next).toHaveBeenCalled();
  });

  it("still shows a card when the number cannot be read", async () => {
    sb.rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    render(<CardScreen />);
    await waitFor(() => expect(sb.rpc).toHaveBeenCalled());
    expect(screen.queryByText(/^No\. /)).toBeNull();
    expect(screen.getByText("Mia")).toBeTruthy();
  });
});

describe("the first plan (screen 11)", () => {
  it("shows the plan as a ticket with a headline that follows the time and a true reason", async () => {
    render(<PlanScreen />);
    expect(flow.setStubby).toHaveBeenCalledWith("thinking");
    await screen.findByRole("heading", { name: "Tomorrow’s yours." });
    expect(screen.getByRole("article", { name: "Bouldering night" })).toBeTruthy();
    expect(screen.getByText("Thursday, 7:00 PM · Williamsburg")).toBeTruthy();
    expect(screen.getByText("You said Thursday evenings work, and you picked Climbing.")).toBeTruthy();
    expect(screen.getByText("Free")).toBeTruthy();
    expect(screen.getByText("Admit one")).toBeTruthy();
    expect(flow.react).toHaveBeenCalledWith("stamped");
    // No Back on this screen is the flow's rule; here the three answers are all there.
    expect(screen.getByRole("button", { name: "Tear off half for a friend" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "I’m going solo" })).toBeTruthy();
    // The only plan found: nothing else to show, so the link goes to Discover.
    expect(screen.getByRole("button", { name: "Show me Discover" })).toBeTruthy();
  });

  it("I'm going solo does the real thing, then finishes onboarding", async () => {
    render(<PlanScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "I’m going solo" }));
    await waitFor(() => expect(flow.finish).toHaveBeenCalledTimes(1));
    expect(remote.goToPlan).toHaveBeenCalledTimes(1);
    expect(remote.goToPlan.mock.calls[0][0]).toMatchObject({ kind: "event", eventId: 7 });
    expect(remote.tearOffHalf).not.toHaveBeenCalled();
    expect(flow.next).not.toHaveBeenCalled();
  });

  it("Tear off half does it too, makes the link, and opens the invite screen", async () => {
    render(<PlanScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Tear off half for a friend" }));
    await waitFor(() => expect(flow.next).toHaveBeenCalledWith({ stamp: true }));
    expect(remote.goToPlan).toHaveBeenCalledTimes(1);
    expect(remote.tearOffHalf).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem("soosh.firstPlan.half") ?? "{}").half.url).toContain("/join/tok");
  });

  it("says so and goes nowhere when it cannot", async () => {
    remote.goToPlan.mockResolvedValue({ error: "Something went wrong. Try again." });
    render(<PlanScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "I’m going solo" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Something went wrong");
    expect(flow.finish).not.toHaveBeenCalled();
  });

  it("never does the thing twice when a later step fails and is retried", async () => {
    remote.tearOffHalf.mockResolvedValueOnce({ error: "Something went wrong. Try again." });
    render(<PlanScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Tear off half for a friend" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Tear off half for a friend" }));
    await waitFor(() => expect(flow.next).toHaveBeenCalled());
    expect(remote.goToPlan).toHaveBeenCalledTimes(1);
    expect(remote.tearOffHalf).toHaveBeenCalledTimes(2);
  });

  it("Show me something else walks the plans, and after the third opens Discover", async () => {
    const ev = (id: number, h: number) => ({ cornerKey: "sports-fitness/climbing", eventId: id, title: `Plan ${id}`, startsAt: at(29, h), online: false, price: "Free" });
    remote.loadPlanInput.mockResolvedValue(input({ windows: [], events: [ev(1, 18), ev(2, 19), ev(3, 20), ev(4, 21)] }));
    render(<PlanScreen />);
    await screen.findByRole("article", { name: "Plan 1" });
    fireEvent.click(screen.getByRole("button", { name: "Show me something else" }));
    await screen.findByRole("article", { name: "Plan 2" });
    fireEvent.click(screen.getByRole("button", { name: "Show me something else" }));
    await screen.findByRole("article", { name: "Plan 3" });
    fireEvent.click(screen.getByRole("button", { name: "Show me Discover" }));
    expect(flow.finish).toHaveBeenCalledWith("/discover");
    expect(screen.queryByRole("article", { name: "Plan 4" })).toBeNull();
  });

  it("an at-home plan outside New York says plans in their city are coming", async () => {
    remote.loadPlanInput.mockResolvedValue(input({ events: [], city: "London", picks: [{ key: "food-cooking/sourdough", name: "Sourdough", spaceSlug: "food-cooking", slug: "sourdough" }] }));
    render(<PlanScreen />);
    await screen.findByRole("article", { name: "Sourdough at home" });
    expect(screen.getByText("Soosh plans in your city are coming. For now, here’s one you can do anywhere.")).toBeTruthy();
  });

  it("with nothing to offer, goes to Discover", async () => {
    remote.loadPlanInput.mockResolvedValue(input({ events: [], picks: [] }));
    render(<PlanScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Go to Discover" }));
    expect(flow.finish).toHaveBeenCalledWith("/discover");
  });

  it("never claims a pass makes anything free", async () => {
    remote.loadPlanInput.mockResolvedValue(input({ budget: null, passes: [{ id: "a", kind: "climbing", label: "Climbing", place: "" }], events: [{ cornerKey: "sports-fitness/climbing", eventId: 7, title: "Bouldering night", startsAt: at(29, 19), price: "$30", online: false }] }));
    const { container } = render(<PlanScreen />);
    await screen.findByRole("article", { name: "Bouldering night" });
    expect(screen.getByText(/You have a climbing pass\./)).toBeTruthy();
    expect(container.textContent).not.toMatch(/\$0|with your pass/i);
  });
});

describe("tear off half (screen 12)", () => {
  const half = { url: "https://x.test/#/join/tok", title: "Bouldering night", when: "Thursday, 7:00 PM" };
  beforeEach(() => saveHalf("u1", half));
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete navigator.share;
  });

  it("shares the link and the message, and Stubby tears the tab off", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share });
    render(<InviteScreen />);
    expect(screen.getByRole("heading", { name: "Who gets the other half?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(flow.next).toHaveBeenCalledWith({ reaction: "torn" }));
    expect(share).toHaveBeenCalledWith({ title: "Bouldering night", text: shareMessage("Bouldering night", "Thursday, 7:00 PM"), url: half.url });
    expect(shareMessage("Bouldering night", "Thursday, 7:00 PM")).toBe("I’m doing Bouldering night on Thursday, 7:00 PM. Take the other half:");
  });

  it("closing the share sheet sends nothing and stays", async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(Object.assign(new Error("x"), { name: "AbortError" })) });
    render(<InviteScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect((navigator.share as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1));
    expect(flow.next).not.toHaveBeenCalled();
  });

  it("copies the link where there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<InviteScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(flow.next).toHaveBeenCalledWith({ reaction: "torn" }));
    expect(writeText.mock.calls[0][0]).toContain(half.url);
  });

  it("is optional: Skip for now finishes with no reaction, and with no link there is nothing to send", async () => {
    render(<InviteScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(flow.next).toHaveBeenCalledWith(undefined);
    cleanup();
    sessionStorage.clear();
    render(<InviteScreen />);
    expect((screen.getByRole("button", { name: "Nothing to send" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
