// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allSubHobbies } from "../data/hobbies";
import { cornerGuide } from "../data/cornerGuides";
import { CURATED_CORNERS } from "../data/curatedCorners";
import type { Post } from "../data/posts";

const h = vi.hoisted(() => ({
  auth: { value: { user: { id: "me" } as { id: string } | null, profile: { username: "me", display_name: "Priya Shah", avatar_url: null }, loading: false, isConfigured: true } },
  feed: { value: [] as unknown[] },
  actions: [] as string[],
  makePlan: vi.fn(),
  cancelPlan: vi.fn(),
  announced: [] as { message: string; undo: () => void }[],
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => h.auth.value }));
vi.mock("../context/ContentContext", () => ({ useContent: () => ({ publicFeed: h.feed.value }) }));
vi.mock("../context/SocialContext", () => ({ useSocial: () => ({ blockedIds: [] }) }));
vi.mock("../lib/useFeedInputs", () => ({ useFeedInputs: () => ({ inputs: { meId: "me", followingIds: ["u1"], spacePostIds: new Set(), followedCorners: new Set() }, loaded: true }) }));
vi.mock("../lib/useHomeData", () => ({ useHomeData: () => ({ status: "ready", items: [], windows: [], left: [], plans: [], place: { city: "", area: "" } }) }));
vi.mock("../lib/discover", async (orig) => ({ ...(await orig<typeof import("../lib/discover")>()), fetchDiscoverMoments: async () => [] }));
vi.mock("../lib/startPlan", () => ({
  makeStartPlan: h.makePlan,
  cancelStartPlan: h.cancelPlan,
  moveStartPlan: vi.fn(),
  loadStartPlan: vi.fn(async () => null),
}));
vi.mock("../lib/undo", () => ({ announceChange: (message: string, o: { undo: () => void }) => h.announced.push({ message, undo: o.undo }) }));
vi.mock("../lib/startActions", () => ({ recordStartAction: (a: string) => h.actions.push(a) }));
vi.mock("../lib/firstPlanRemote", () => ({ tearOffHalf: vi.fn(async () => ({ error: "x" })), startSmallPursuit: vi.fn() }));
vi.mock("../components/calendar/CalendarSheets", () => ({ WhenFields: () => null }));
vi.mock("../components/start/InspirationStrip", () => ({
  InspirationStrip: ({ posts }: { posts: Post[] }) => (posts.length ? <div data-testid="strip">{posts.length}</div> : null),
}));

import { StartPage } from "./StartPage";

const Probe = () => {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
};
const show = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/start/:spaceSlug/:cornerSlug" element={<StartPage />} />
        <Route path="*" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T17:00:00Z")); // Thursday noon in New York
  localStorage.clear();
  h.actions.length = 0;
  h.announced.length = 0;
  h.makePlan.mockReset().mockResolvedValue({ plan: { pursuitId: "p1", sessionId: 5, startsAt: Date.parse("2026-11-07T00:00:00Z"), title: "Cooking" } });
  h.cancelPlan.mockReset().mockResolvedValue(null);
  h.auth.value = { user: { id: "me" }, profile: { username: "me", display_name: "Priya Shah", avatar_url: null }, loading: false, isConfigured: true };
  h.feed.value = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the Start page", () => {
  it("shows the activity, not the camera", () => {
    const { container } = show("/start/food-cooking/cooking?ref=home");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Cooking");
    expect(screen.getByText(cornerGuide("food-cooking", "cooking")!.step)).toBeTruthy();
    expect(screen.getByLabelText("What are you making?")).toBeTruthy();
    expect(container.querySelector("input[type=file]")).toBeNull();
    expect(document.body.textContent).not.toMatch(/Take a photo/i);
    expect(screen.queryByTestId("where")).toBeNull();
  });

  it("opens the Log form only through Done? Log it, after Now, with the dish as the caption", () => {
    show("/start/food-cooking/cooking");
    fireEvent.change(screen.getByLabelText("What are you making?"), { target: { value: "cacio e pepe" } });
    fireEvent.click(screen.getByRole("button", { name: "Start now" }));
    expect(screen.getByText("Doing it now")).toBeTruthy();
    expect(screen.queryByTestId("where")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Done? Log it" }));
    expect(screen.getByTestId("where").textContent).toBe("/create?hobby=food-cooking&sub=cooking&caption=cacio+e+pepe&ref=start");
    expect(h.makePlan).not.toHaveBeenCalled();
    expect(h.actions).toEqual([]);
  });

  it("adds exactly one plan, records going, and Undo takes it back out", async () => {
    show("/start/food-cooking/cooking");
    fireEvent.click(screen.getByRole("button", { name: "Tomorrow" }));
    const add = screen.getByRole("button", { name: "Add to my week" });
    await act(async () => {
      fireEvent.click(add);
    });
    expect(h.makePlan).toHaveBeenCalledTimes(1);
    expect(h.makePlan.mock.calls[0][0].title).toBe("Cooking");
    expect(h.actions).toEqual(["going"]);
    expect(h.announced).toHaveLength(1);
    expect(h.announced[0].message).toMatch(/^On your calendar for Fri /);
    await waitFor(() => expect(screen.getByText("Fri · Evening")).toBeTruthy());
    act(() => h.announced[0].undo());
    expect(h.cancelPlan).toHaveBeenCalledTimes(1);
    expect(h.cancelPlan.mock.calls[0][0].pursuitId).toBe("p1");
    await waitFor(() => expect(screen.getByRole("button", { name: "Tomorrow" })).toBeTruthy());
  });

  it("keeps the list across a reload, and ticking is remembered", () => {
    const c = CURATED_CORNERS.find((x) => cornerGuide(x.spaceSlug, x.slug) && x.needs.length > 0)!;
    const path = `/start/${c.spaceSlug}/${c.slug}`;
    const first = show(path);
    const row = screen.getAllByRole("checkbox")[0];
    expect(row.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(row);
    first.unmount();
    show(path);
    expect(screen.getAllByRole("checkbox")[0].getAttribute("aria-checked")).toBe("true");
  });

  it("still renders when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    const c = CURATED_CORNERS.find((x) => x.needs.length > 0)!;
    show(`/start/${c.spaceSlug}/${c.slug}`);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    vi.restoreAllMocks();
  });

  it("renders a Corner with no needs, no steps and no guide: header, When and With", () => {
    const bare = allSubHobbies.find((s) => !cornerGuide(s.hobbySlug, s.slug) && !CURATED_CORNERS.some((c) => c.slug === s.slug && c.spaceSlug === s.hobbySlug))!;
    show(`/start/${bare.hobbySlug}/${bare.slug}`);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(bare.label);
    expect(screen.getByRole("heading", { name: "When" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "With" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "How to start" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "What you’ll need" })).toBeTruthy(); // empty list still lets the person add their own
    expect(screen.getByRole("button", { name: "Start now" })).toBeTruthy();
  });

  it("sends an unknown Corner to its Corner page", () => {
    show("/start/nope/nothing");
    expect(screen.getByTestId("where").textContent).toBe("/corners/nothing");
  });

  it("asks a signed-out person to log in, and shows no camera", () => {
    h.auth.value = { ...h.auth.value, user: null };
    const { container } = show("/start/food-cooking/cooking");
    expect(screen.getByText("Log in to keep your Moments")).toBeTruthy();
    expect(container.querySelector("input[type=file]")).toBeNull();
  });

  it("hides the strip with no Moments and shows it, keeping the page mounted, when there are some", () => {
    const { rerender } = show("/start/food-cooking/cooking");
    expect(screen.queryByTestId("strip")).toBeNull();
    h.feed.value = [{ id: 1, hobbySlug: "food-cooking", corner: "cooking", type: "photo", media: "https://example.invalid/1.jpg", creator: "Sneha K", caption: "", likes: 0, createdAt: 1, visibility: "public", userId: "u1" }];
    rerender(
      <MemoryRouter initialEntries={["/start/food-cooking/cooking"]}>
        <Routes>
          <Route path="/start/:spaceSlug/:cornerSlug" element={<StartPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByTestId("strip")).toBeTruthy();
  });

  it("carries a Moment it may show through to Log as ?inspired=", () => {
    h.feed.value = [{ id: 1, hobbySlug: "food-cooking", corner: "cooking", type: "photo", media: "https://example.invalid/1.jpg", creator: "Sneha K", caption: "", likes: 0, createdAt: 1, visibility: "public", userId: "u1" }];
    show("/start/food-cooking/cooking?inspired=1");
    fireEvent.click(screen.getByRole("button", { name: "Start now" }));
    fireEvent.click(screen.getByRole("button", { name: "Done? Log it" }));
    expect(screen.getByTestId("where").textContent).toBe("/create?hobby=food-cooking&sub=cooking&inspired=1&ref=start");
  });

  it("does not carry an unknown ?inspired= to Log", () => {
    show("/start/food-cooking/cooking?inspired=999");
    fireEvent.click(screen.getByRole("button", { name: "Start now" }));
    fireEvent.click(screen.getByRole("button", { name: "Done? Log it" }));
    expect(screen.getByTestId("where").textContent).not.toContain("inspired");
  });

  it("ignores ?inspired= with an unknown id, and names the person for a Moment it may show", () => {
    show("/start/food-cooking/cooking?inspired=999");
    expect(document.body.textContent).not.toMatch(/Inspired by/);
    cleanup();
    h.feed.value = [{ id: 1, hobbySlug: "food-cooking", corner: "cooking", type: "photo", media: "https://example.invalid/1.jpg", creator: "Sneha K", caption: "", likes: 0, createdAt: 1, visibility: "public", userId: "u1" }];
    show("/start/food-cooking/cooking?inspired=1");
    expect(screen.getByText(/Inspired by Sneha/)).toBeTruthy();
  });
});
