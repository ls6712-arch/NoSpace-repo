// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "me" } as { id: string } | null,
  followed: [] as string[],
  loaded: true,
  taste: (async () => ({ picks: [], windows: [], budget: null })) as () => Promise<{ picks: string[]; windows: string[]; budget: null }>,
  affinity: new Map<string, number>(),
  logged: [] as { kind: string; refId: string; position: number; action: string }[],
}));
const known = [
  { spaceSlug: "crafts-making", slug: "knitting", name: "Knitting" },
  { spaceSlug: "crafts-making", slug: "pottery", name: "Pottery" },
  { spaceSlug: "home-garden", slug: "gardening", name: "Gardening" },
  { spaceSlug: "books-writing", slug: "reading", name: "Reading" },
  { spaceSlug: "gaming-tabletop", slug: "board-games", name: "Board games" },
];
vi.mock("../../../lib/supabase", () => ({ supabase: null }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: state.user, profile: null }) }));
vi.mock("../../context/ContentContext", () => ({ useContent: () => ({ publicFeed: [] }) }));
vi.mock("../../context/SocialContext", () => ({ useSocial: () => ({ followedHobbies: state.followed, loaded: state.loaded }) }));
vi.mock("../../context/CornersContext", () => ({ useCorners: () => ({ allCorners: known }) }));
vi.mock("../../lib/discover", () => ({ fetchCornerAffinity: async () => state.affinity }));
vi.mock("../../lib/tasteRemote", async (orig) => ({ ...(await orig<typeof import("../../lib/tasteRemote")>()), fetchTaste: () => state.taste() }));
vi.mock("../../lib/homeSuggestions", () => ({ logSuggestionEvent: async (e: (typeof state.logged)[number]) => void state.logged.push(e) }));
import { CORNERS_ROW_COPY, CornersRow } from "./CornersRow";

window.matchMedia ??= (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
window.HTMLElement.prototype.scrollTo ??= () => {};
const show = () => render(<MemoryRouter><CornersRow /></MemoryRouter>);
const names = () => screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/corners/")).map((a) => a.getAttribute("href"));

beforeEach(() => {
  Object.assign(state, { user: { id: "me" }, followed: [], loaded: true, taste: async () => ({ picks: [], windows: [], budget: null }), affinity: new Map(), logged: [] });
});
afterEach(cleanup);

describe("the Corners row on Home", () => {
  it("shows someone who follows no Corners the Corners with a 3D world, their picks first, as still pictures", async () => {
    state.taste = async () => ({ picks: ["books-writing/reading"], windows: [], budget: null });
    show();
    expect(await screen.findByRole("heading", { name: CORNERS_ROW_COPY.forYou })).toBeTruthy();
    expect(names()).toEqual(["/corners/reading", "/corners/pottery", "/corners/gardening", "/corners/board-games"]);
    const img = screen.getByAltText("Reading") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/worlds/reading/card.webp");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(screen.getByRole("link", { name: /See all/ }).getAttribute("href")).toBe("/corners");
    // The name and the Corner's one line. No counts, badges or buttons.
    expect(screen.queryAllByRole("button").filter((b) => !b.getAttribute("aria-label")?.startsWith("Scroll"))).toEqual([]);
  });

  it("shows someone who follows Corners the same 3D Corners, the ones they follow first, under Corners for you", async () => {
    // Knitting has no 3D world, so following it does not change the row; Reading is followed, so it comes first.
    state.followed = ["crafts-making:knitting", "books-writing:reading"];
    state.taste = async () => ({ picks: ["gaming-tabletop/board-games"], windows: [], budget: null });
    show();
    expect(await screen.findByRole("heading", { name: CORNERS_ROW_COPY.forYou })).toBeTruthy();
    expect(names()).toEqual(["/corners/reading", "/corners/board-games", "/corners/pottery", "/corners/gardening"]);
    expect(screen.queryByText("Knitting")).toBeNull();
    for (const a of screen.getAllByRole("img")) expect(a.getAttribute("src")).toMatch(/^\/worlds\/[a-z-]+\/card\.webp$/);
  });

  it("treats someone who follows only Spaces as following no Corners, and never shows a Space as a Corner", async () => {
    state.followed = ["space:books-writing", "space:home-garden", ""];
    state.taste = async () => ({ picks: ["home-garden/gardening"], windows: [], budget: null });
    show();
    expect(await screen.findByRole("heading", { name: CORNERS_ROW_COPY.forYou })).toBeTruthy();
    expect(names()).toEqual(["/corners/gardening", "/corners/pottery", "/corners/reading", "/corners/board-games"]);
    expect(screen.queryByText("books-writing")).toBeNull();
  });

  it("shows a visitor the Corners with a 3D world in catalog order, and records nothing", async () => {
    state.user = null;
    state.loaded = false;
    show();
    expect(await screen.findByRole("heading", { name: CORNERS_ROW_COPY.forYou })).toBeTruthy();
    expect(names()).toEqual(["/corners/pottery", "/corners/gardening", "/corners/reading", "/corners/board-games"]);
    fireEvent.click(screen.getByAltText("Pottery"));
    expect(state.logged).toEqual([]);
  });

  it("records a tap as opened, with the Corner and its place in the row", async () => {
    show();
    fireEvent.click(await screen.findByAltText("Gardening"));
    expect(state.logged).toEqual([{ kind: "corner", refId: "home-garden/gardening", cornerKey: "home-garden/gardening", position: 1, action: "opened" }]);
  });

  it("holds the cards' places with squares while it loads", () => {
    state.loaded = false;
    const { container } = show();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(4);
    expect(container.querySelector("section")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders nothing when what it reads cannot be read", async () => {
    state.taste = () => Promise.reject(new Error("offline"));
    const { container } = show();
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });

  it("renders nothing when there is nothing to show", async () => {
    known.splice(1);
    const { container } = show();
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });
});
