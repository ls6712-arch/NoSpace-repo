// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// CornersContext reaches the photo converter, which needs a browser Worker that jsdom lacks.

const flow = vi.hoisted(() => ({ next: vi.fn(), react: vi.fn(), setStubby: vi.fn(), inviteCode: null as string | null, redirectTo: "/" }));
vi.mock("../OnboardingContext", () => ({ useOnboarding: () => flow }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../../../lib/interests", () => ({ useInterests: () => ({ city: "Brooklyn" }) }));

const arrival = vi.hoisted(() => ({ value: null as null | { name: string; cornerKey?: string } }));
vi.mock("../useArrival", () => ({ useArrival: () => arrival.value }));

const corners = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock("../../../context/CornersContext", async () => {
  const actual = await vi.importActual<typeof import("../../../context/CornersContext")>("../../../context/CornersContext");
  return { ...actual, useCorners: () => ({ allCorners: corners.list }) };
});

const remote = vi.hoisted(() => ({
  savePrivate: vi.fn(),
  fetchTaste: vi.fn(),
  fetchCornerActivity: vi.fn(),
  fetchPasses: vi.fn(),
  savePasses: vi.fn(),
}));
vi.mock("../../../lib/onboardingRemote", () => ({ savePrivate: remote.savePrivate }));
vi.mock("../../../lib/tasteRemote", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/tasteRemote")>("../../../lib/tasteRemote");
  return { ...actual, fetchTaste: remote.fetchTaste, fetchCornerActivity: remote.fetchCornerActivity, fetchPasses: remote.fetchPasses, savePasses: remote.savePasses };
});

import { CURATED_CORNERS } from "../../../data/curatedCorners";
import { FreeScreen } from "./FreeScreen";
import { PicksScreen } from "./PicksScreen";
import { YoursScreen } from "./YoursScreen";

const key = (i: number) => `${CURATED_CORNERS[i].spaceSlug}/${CURATED_CORNERS[i].slug}`;
const corner = (i: number, extra: Record<string, unknown> = {}) => ({
  spaceSlug: CURATED_CORNERS[i].spaceSlug,
  slug: CURATED_CORNERS[i].slug,
  name: CURATED_CORNERS[i].name,
  momentCount: 5,
  momentCount30d: 5,
  hasActiveSpace: false,
  hidden: false,
  isCurated: true,
  isCatalog: false,
  aliases: [],
  ...extra,
});

beforeEach(() => {
  flow.next.mockReset();
  flow.react.mockReset();
  arrival.value = null;
  corners.list = CURATED_CORNERS.map((_, i) => corner(i));
  remote.savePrivate.mockReset().mockResolvedValue({ error: null });
  remote.fetchTaste.mockReset().mockResolvedValue({ picks: [], windows: [], budget: null });
  remote.fetchCornerActivity.mockReset().mockResolvedValue(new Map());
  remote.fetchPasses.mockReset().mockResolvedValue([]);
  remote.savePasses.mockReset().mockResolvedValue({ error: null });
});
afterEach(cleanup);

const chipsIn = (name: string) => screen.getByRole("list", { name }).querySelectorAll("button");

describe("picks (screen 7)", () => {
  it("offers 12 Corners and needs three, with no maximum", async () => {
    render(<PicksScreen />);
    await waitFor(() => expect(chipsIn("Corners").length).toBe(12));
    const next = screen.getByRole("button", { name: "Pick 3 more" }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    const chips = chipsIn("Corners");
    for (let i = 0; i < 12; i++) fireEvent.click(chips[i]);
    expect(chipsIn("Corners").length).toBe(12);
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(false);
    expect(Array.from(chipsIn("Corners")).every((c) => c.getAttribute("aria-pressed") === "true")).toBe(true);
  });

  it("is exactly 12 text-only chips in two columns, one per activity", async () => {
    render(<PicksScreen />);
    await waitFor(() => expect(chipsIn("Corners").length).toBe(12));
    expect(screen.getByRole("list", { name: "Corners" }).className).toContain("grid-cols-2");
    const labels = Array.from(chipsIn("Corners")).map((c) => c.textContent ?? "");
    expect(labels.some((t) => /\p{Extended_Pictographic}/u.test(t))).toBe(false);
    expect(labels.some((t) => t.includes("Run clubs"))).toBe(false);
    expect(labels.some((t) => t.includes("Running"))).toBe(true);
  });

  it("says how many are missing as they are picked, and stamps or unstamps Stubby", async () => {
    render(<PicksScreen />);
    await waitFor(() => expect(chipsIn("Corners").length).toBe(12));
    const chips = chipsIn("Corners");
    fireEvent.click(chips[0]);
    expect(screen.getByRole("button", { name: "Pick 2 more" })).toBeTruthy();
    expect(flow.react).toHaveBeenLastCalledWith("stamped");
    fireEvent.click(chips[0]);
    expect(screen.getByRole("button", { name: "Pick 3 more" })).toBeTruthy();
    expect(flow.react).toHaveBeenLastCalledWith("unstamped");
  });

  it("puts a Corner with something near in the next 14 days first", async () => {
    remote.fetchCornerActivity.mockResolvedValue(new Map([[key(20), 4]]));
    render(<PicksScreen />);
    await waitFor(() => expect(chipsIn("Corners").length).toBe(12));
    expect(chipsIn("Corners")[0].textContent).toContain(CURATED_CORNERS[20].name);
  });

  it("starts the friend's Corner first, picked, with who is going, and lets it be unpicked", async () => {
    arrival.value = { name: "Mia Chen", cornerKey: key(7) };
    render(<PicksScreen />);
    await waitFor(() => expect(chipsIn("Corners")[0].getAttribute("aria-pressed")).toBe("true"));
    const first = chipsIn("Corners")[0];
    expect(first.textContent).toContain(CURATED_CORNERS[7].name);
    expect(first.textContent).toContain("Mia’s going");
    expect(first.textContent).not.toContain("Chen");
    fireEvent.click(first);
    expect(chipsIn("Corners")[0].getAttribute("aria-pressed")).toBe("false");
  });

  it("does not preselect the friend's Corner over picks already saved", async () => {
    remote.fetchTaste.mockResolvedValue({ picks: [key(1), key(2), key(3)], windows: [], budget: null });
    arrival.value = { name: "Mia", cornerKey: key(7) };
    render(<PicksScreen />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).toBeTruthy());
    expect(chipsIn("Corners")[0].getAttribute("aria-pressed")).toBe("false");
  });

  it("finds an existing Corner with Something else, and never makes one", async () => {
    corners.list = [...CURATED_CORNERS.map((_, i) => corner(i)), { ...corner(0), spaceSlug: "other", slug: "zine-making", name: "Zine making", isCurated: false }];
    render(<PicksScreen />);
    await waitFor(() => expect(chipsIn("Corners").length).toBe(12));
    fireEvent.click(screen.getByRole("button", { name: "+ Something else" }));
    fireEvent.change(screen.getByLabelText("Find a Corner"), { target: { value: "zine" } });
    fireEvent.click(await screen.findByRole("button", { name: "Zine making" }));
    expect(screen.getByRole("button", { name: "Pick 2 more" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Find a Corner"), { target: { value: "qqqqzzzz" } });
    expect(screen.getByText("No Corner by that name.")).toBeTruthy();
  });

  it("saves the picks and moves on", async () => {
    render(<PicksScreen />);
    await waitFor(() => expect(chipsIn("Corners").length).toBe(12));
    const chips = chipsIn("Corners");
    [0, 1, 2].forEach((i) => fireEvent.click(chips[i]));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(flow.next).toHaveBeenCalled());
    const saved = remote.savePrivate.mock.calls[0][1].picks as string[];
    expect(saved.length).toBe(3);
  });
});

describe("free (screen 8)", () => {
  it("offers exact ranges per day instead of broad checkboxes", async () => {
    render(<FreeScreen />);
    await waitFor(()=>expect(screen.getByRole("button",{name:"Add time"}).matches(":disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: /^Saturday/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add time" }));
    fireEvent.change(screen.getByLabelText("Saturday from 1"),{target:{value:"10:00"}});
    fireEvent.change(screen.getByLabelText("Saturday to 1"),{target:{value:"14:00"}});
    expect(screen.getByRole("button", {name:/^Saturday.*10:00 AM to 2:00 PM/})).toBeTruthy();
    expect(screen.getByRole("button", {name:"Next"})).toBeTruthy();
  });

  it("needs a time for Next, and shows the calendar row as coming soon", () => {
    render(<FreeScreen />);
    expect((screen.getByRole("button", { name: "Pick a time" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Coming soon")).toBeTruthy();
    expect((screen.getByText("Connect a calendar").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves the windows", async () => {
    render(<FreeScreen />);
    await waitFor(()=>expect(remote.fetchTaste).toHaveBeenCalled());
    await waitFor(()=>expect(screen.getByRole("button",{name:"Add time"}).matches(":disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: /^Saturday/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add time" }));
    fireEvent.click(screen.getByRole("button", { name: /^Monday/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add time" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(flow.next).toHaveBeenCalled());
    expect(remote.savePrivate).toHaveBeenCalledWith("u1", { free_windows: ["mon@1080-1140", "sat@1080-1140"] });
    expect(flow.next).toHaveBeenCalledWith(undefined);
  });

  it("skips: saves nothing, and Stubby shrugs", async () => {
    render(<FreeScreen />);
    await waitFor(()=>expect(remote.fetchTaste).toHaveBeenCalled());
    await waitFor(()=>expect(screen.getByRole("button",{name:"Add time"}).matches(":disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await waitFor(() => expect(flow.next).toHaveBeenCalledWith({ reaction: "shrug" }));
    expect(remote.savePrivate).not.toHaveBeenCalled();
  });
});

describe("yours (screen 9)", () => {
  it("adds a pass per kind with Stubby showing it's yours, and takes it off on a second tap", async () => {
    render(<YoursScreen />);
    await waitFor(()=>expect((screen.getByRole("button",{name:"Next"}) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Climbing" }));
    expect(flow.react).toHaveBeenLastCalledWith("yours");
    expect(screen.getByRole("button", { name: "Climbing" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.change(screen.getByLabelText("Climbing place (optional)"), { target: { value: "Brooklyn Boulders" } });
    fireEvent.click(screen.getByRole("button", { name: "Museum" }));
    expect(flow.react).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Climbing" }));
    expect(screen.queryByLabelText("Climbing place (optional)")).toBeNull();
    expect(flow.react).toHaveBeenCalledTimes(2);
  });

  it("has Skip beside the four amounts at the same weight, and Skip means no budget", async () => {
    render(<YoursScreen />);
    await waitFor(()=>expect((screen.getByRole("button",{name:"Next"}) as HTMLButtonElement).disabled).toBe(false));
    for (const name of ["Free only", "$50", "$100", "$200", "Skip"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "$100" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(flow.react).toHaveBeenLastCalledWith("shrug");
    expect(screen.getByRole("button", { name: "$100" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Your saved budget stays as it is. Pass coverage needs confirmation.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(flow.next).toHaveBeenCalledWith({ stamp: true }));
    expect(remote.savePrivate).not.toHaveBeenCalled();
  });

  it("saves a chosen budget, and Free only is 0 not null", async () => {
    render(<YoursScreen />);
    await waitFor(()=>expect((screen.getByRole("button",{name:"Next"}) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Free only" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(flow.next).toHaveBeenCalled());
    expect(remote.savePrivate).toHaveBeenCalledWith("u1", { monthly_budget: 0 });
  });

  it("says only you see the budget", () => {
    render(<YoursScreen />);
    expect(screen.getByText("Only you see this.")).toBeTruthy();
  });

  it("can be left empty: Next is always on", async () => {
    render(<YoursScreen />);
    await waitFor(()=>expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(flow.next).toHaveBeenCalled());
    expect(remote.savePasses.mock.calls[0][1]).toEqual([]);
  });

  it("never claims a pass makes anything free", async () => {
    const { container } = render(<YoursScreen />);
    await waitFor(()=>expect((screen.getByRole("button",{name:"Next"}) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Museum" }));
    expect(container.textContent).not.toMatch(/\$0|with your pass|free with/i);
  });
});
