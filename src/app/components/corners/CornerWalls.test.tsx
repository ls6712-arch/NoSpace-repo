// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, MemoryRouter, RouterProvider, useNavigate, useNavigationType } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryState } from "../../lib/useHistoryState";
import type { Chain, WallCard } from "../../lib/cornerWalls";

const auth = { user: { id: "me" } as { id: string } | null };
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../../../lib/supabase", () => ({ supabase: null }));
vi.mock("../../lib/reactionState", () => ({ useReactionState: () => ({ mine: [], toggle: () => {} }) }));
const fetchWall = vi.fn();
const fetchPassedAlong = vi.fn();
vi.mock("../../lib/cornerWalls", async (orig) => ({
  ...(await orig<typeof import("../../lib/cornerWalls")>()),
  fetchWall: (...a: unknown[]) => fetchWall(...a),
  fetchPassedAlong: (...a: unknown[]) => fetchPassedAlong(...a),
}));

import { CornerWalls, wallFaces } from "./CornerWalls";
import { WallCard as WallCardView } from "./WallCard";

const corner = { spaceSlug: "crafts-making", slug: "embroidery", name: "Embroidery" };
const card = (over: Partial<WallCard> = {}): WallCard => ({
  postId: 1,
  authorId: "u1",
  authorName: "Maya",
  mine: false,
  mediaType: "written",
  caption: "First row done",
  pursuitTitle: "Jacket",
  postedAt: Date.parse("2026-11-01T10:00:00Z"),
  finisherStub: false,
  startedBecause: [],
  ...over,
});
const chain: Chain = { links: [{ authorId: "u1", name: "Maya", pursuitId: "p1", lastPostId: 1 }, { authorId: "u2", name: "Priya", pursuitId: "p2", lastPostId: 2 }], chips: ["Maya’s Jacket", "Priya"], lastPostId: 2, mine: false };

const setup = (restricted = false) =>
  render(
    <MemoryRouter>
      <CornerWalls corner={corner} restricted={restricted} onOpenMoment={vi.fn()} onMake={vi.fn()} onMakeFromChain={vi.fn()} onLogMoment={vi.fn()} onDoWithPeople={vi.fn()} />
    </MemoryRouter>,
  );

const wall = (making: WallCard[], made: WallCard[], chains: Chain[] = []) => {
  fetchWall.mockImplementation(async (_c: string, kind: string) => (kind === "making" ? making : made));
  fetchPassedAlong.mockResolvedValue(chains);
};

beforeEach(() => {
  auth.user = { id: "me" };
  fetchWall.mockReset();
  fetchPassedAlong.mockReset();
});
afterEach(cleanup);

describe("CornerWalls", () => {
  it("renders both walls with fixtures, their lines, and Passed along", async () => {
    wall(
      [card(), card({ postId: 2, authorId: "u2", authorName: "Priya", pursuitTitle: "Cushion", startedBecause: ["Sam"], inspiredByName: "Maya", inspiredByPostId: 1 })],
      [card({ postId: 3, authorName: "Lee", pursuitTitle: "Sampler", finishedAt: Date.parse("2026-10-20T10:00:00Z"), finisherStub: true })],
      [chain],
    );
    setup();
    await screen.findByRole("heading", { name: "Still making" });
    expect(screen.getByRole("heading", { name: "Made it" })).toBeTruthy();
    expect(screen.getByText("Half-done, messy, in progress.")).toBeTruthy();
    expect(screen.getByText("Finished things, with the Moments that got them here.")).toBeTruthy();
    expect(screen.getByText("Started because of Maya")).toBeTruthy();
    expect(screen.getByText("Sam started because of this")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Passed along" })).toBeTruthy();
    expect(screen.getByText("Maya’s Jacket")).toBeTruthy();
    expect(screen.getByRole("button", { name: "You?" })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Walls" })).toBeTruthy();
  });

  it("has no digits in wall card text apart from the finished date", async () => {
    wall([card()], [card({ postId: 3, finishedAt: Date.parse("2026-10-20T12:00:00Z"), finisherStub: true })], [chain]);
    setup();
    await screen.findByRole("heading", { name: "Made it" });
    const text = [...document.querySelectorAll("[data-wall-card]")].map((n) => n.textContent ?? "");
    for (const t of text) expect(t.replace(/Finished [A-Z][a-z]{2} \d{1,2}(, \d{4})?/, "")).not.toMatch(/\d/);
    expect(text.join(" ")).toMatch(/Finished /);
  });

  it("puts the tear-off on other people's Moments and not on your own", async () => {
    wall([card({ postId: 1 }), card({ postId: 2, mine: true, authorName: "You" })], []);
    setup();
    await screen.findByRole("heading", { name: "Still making" });
    const cards = [...document.querySelectorAll<HTMLElement>("[data-wall-card]")];
    expect(within(cards[0]).getByRole("button", { name: "Make your version" })).toBeTruthy();
    expect(within(cards[1]).queryByRole("button", { name: "Make your version" })).toBeNull();
    expect(cards[1].querySelector("[data-tear-off]")).toBeNull();
  });

  it("hides Love this and Count me in on your own card, keeps them on others, and shows Finisher with the Stub icon", async () => {
    wall([card({ postId: 1 }), card({ postId: 2, mine: true, authorName: "You" })], [card({ postId: 3, finishedAt: Date.parse("2026-10-20T12:00:00Z"), finisherStub: true }), card({ postId: 4, finishedAt: Date.parse("2026-10-19T12:00:00Z") })]);
    setup();
    await screen.findByRole("heading", { name: "Made it" });
    const byId = (id: number) => document.querySelector<HTMLElement>(`[data-wall-card="${id}"]`)!;
    expect(within(byId(1)).getByRole("button", { name: /Love this/ })).toBeTruthy();
    expect(within(byId(1)).getByRole("button", { name: /Count me in/ })).toBeTruthy();
    expect(within(byId(2)).queryByRole("button", { name: /Love this|Count me in/ })).toBeNull();
    expect(within(byId(3)).getByText("Finisher")).toBeTruthy();
    expect(byId(3).querySelector("svg.lucide-ticket")).toBeTruthy();
    expect(within(byId(4)).queryByText("Finisher")).toBeNull();
  });

  it("puts the started-because lines in the accent text colour at the small size", async () => {
    wall([card({ startedBecause: ["Sam"], inspiredByName: "Maya", inspiredByPostId: 9 })], []);
    setup();
    for (const t of ["Started because of Maya", "Sam started because of this"]) {
      const el = await screen.findByText(t);
      expect(el.className).toContain("text-small");
      expect(el.className).toContain("text-[var(--accent-text)]");
      expect(el.className).not.toContain("text-caption");
    }
  });

  it("after you started your own, the strip is the one line You started yours.", async () => {
    wall([card({ postId: 1 })], []);
    // The set of Moments you started because of comes from the database; none here, so the strip shows.
    setup();
    await screen.findByRole("heading", { name: "Still making" });
    expect(screen.queryByText("You started yours.")).toBeNull();
    expect(screen.queryByText(/Yours is on/)).toBeNull();
  });

  it("an empty Made it has no panel and no phone control; Still making is on its own", async () => {
    wall([card()], []);
    setup();
    await screen.findByRole("heading", { name: "Still making" });
    expect(screen.queryByRole("heading", { name: "Made it" })).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Walls" })).toBeNull();
    expect(screen.queryByText("Passed along")).toBeNull();
  });

  it("with both walls empty shows one invitation and nothing that says nobody is here", async () => {
    wall([], []);
    const { container } = setup();
    await screen.findByRole("heading", { name: "Share what you’re making." });
    expect(screen.getByRole("button", { name: "Log a Moment" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Do this with people" })).toBeTruthy();
    expect(container.textContent).not.toMatch(/nobody|be the first/i);
    expect(container.querySelector("[data-wall]")).toBeNull();
  });

  it("Show more asks for the next page and appends it", async () => {
    const five = [1, 2, 3, 4, 5].map((i) => card({ postId: i, postedAt: 1_800_000_000_000 - i * 1000 }));
    fetchWall.mockImplementation(async (_c: string, kind: string, o?: { before?: number }) => (kind === "making" ? (o?.before ? [card({ postId: 9, authorName: "Zed" })] : five) : []));
    fetchPassedAlong.mockResolvedValue([]);
    setup();
    await screen.findByRole("heading", { name: "Still making" });
    expect(document.querySelectorAll("[data-wall-card]").length).toBe(4);
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(document.querySelectorAll("[data-wall-card]").length).toBe(5));
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("a visitor gets blurred shapes and a sign-up button, and nothing is asked of the server", () => {
    auth.user = null;
    const { container } = setup(true);
    expect(fetchWall).not.toHaveBeenCalled();
    expect(fetchPassedAlong).not.toHaveBeenCalled();
    expect(screen.getByText("Members see who’s making what.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign up" }).getAttribute("href")).toBe("/onboarding");
    expect(container.querySelectorAll("img").length).toBe(0);
    expect(container.querySelector("[data-wall-card]")).toBeNull();
    expect(container.textContent).not.toMatch(/Maya|Priya/);
  });
});

describe("WallCard once you started your own", () => {
  it("replaces the tear-off with the muted line You started yours.", () => {
    const { container } = render(
      <ul>
        <WallCardView card={card()} kind="making" yoursStarted onOpen={vi.fn()} onMake={vi.fn()} />
      </ul>,
    );
    expect(screen.getByText("You started yours.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Make your version" })).toBeNull();
    expect(container.querySelector("[data-tear-off]")).toBeNull();
  });
});

describe("wallFaces", () => {
  it("is at most 3 distinct newest posters, with no number", () => {
    const faces = wallFaces([card({ authorId: "a", authorName: "A" }), card({ authorId: "a", authorName: "A" }), card({ authorId: "b", authorName: "B" }), card({ authorId: "c", authorName: "C" }), card({ authorId: "d", authorName: "D" })]);
    expect(faces.map((f) => f.name)).toEqual(["A", "B", "C"]);
  });
});

describe("corner.tab", () => {
  function Page() {
    const [tab, setTab] = useHistoryState<"auto" | "walls" | "first">("corner.tab", "auto");
    const navigate = useNavigate();
    return (
      <div>
        <p data-testid="tab">{tab}</p><i data-testid="nt">{useNavigationType()}</i>
        <button onClick={() => setTab("first")}>pick first</button>
        <button onClick={() => navigate("/elsewhere")}>leave</button>
      </div>
    );
  }
  it("survives Back, and a fresh visit starts from the default", async () => {
    sessionStorage.clear();
    const router = createMemoryRouter(
      [
        { path: "/corners/embroidery", element: <Page /> },
        { path: "/elsewhere", element: <p>elsewhere</p> },
      ],
      { initialEntries: ["/corners/embroidery"] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByTestId("tab").textContent).toBe("auto");
    fireEvent.click(screen.getByText("pick first"));
    fireEvent.click(screen.getByText("leave"));
    await screen.findByText("elsewhere");
    await router.navigate(-1);
    await waitFor(() => expect(screen.getByTestId("tab").textContent).toBe("first"));
    // A fresh visit (a push, not Back) starts from the default again.
    await router.navigate("/elsewhere");
    await screen.findByText("elsewhere");
    await router.navigate("/corners/embroidery");
    await screen.findByTestId("tab");
    await waitFor(() => expect([screen.getByTestId("nt").textContent, screen.getByTestId("tab").textContent]).toEqual(["PUSH", "auto"]));
  });
});
