// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MomentTestState } from "../moment/testSupport";
const ctx = vi.hoisted(() => ({ user: { id: "me" } }) as MomentTestState);
vi.mock("../../../lib/supabase", () => ({ supabase: null }));
vi.mock("../../context/AuthContext", async () => (await import("../moment/testSupport")).authMock(ctx));
vi.mock("../../context/ContentContext", async () => (await import("../moment/testSupport")).contentMock(ctx));
vi.mock("../../context/SocialContext", async () => (await import("../moment/testSupport")).socialMock(ctx));
vi.mock("../../context/PrivateLogsContext", async () => (await import("../moment/testSupport")).privateLogsMock());
vi.mock("../../context/CornersContext", async () => (await import("../moment/testSupport")).cornersMock());
import { HOME_V3_COPY, HappeningSection, StillMakingSection } from "./YourCornersSections";
import type { HomeWallCard } from "../../lib/homeYourCorners";
import type { WallCard } from "../../lib/cornerWalls";

afterEach(cleanup);
window.matchMedia ??= (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
window.HTMLElement.prototype.scrollTo ??= () => {};
const corner = { spaceSlug: "ceramics", slug: "pottery", name: "Pottery" };
const card = (postId: number): HomeWallCard => ({
  corner,
  card: { postId, authorId: `a${postId}`, authorName: "Ana", mine: false, mediaType: "written", caption: "Second bowl", postedAt: 1, finisherStub: false, startedBecause: [] } as WallCard,
});

describe("Still making on Home", () => {
  it("is not shown when there is nothing to show", () => {
    const { container } = render(<MemoryRouter><StillMakingSection cards={[]} fallback={false} onOpen={vi.fn()} /></MemoryRouter>);
    expect(container.innerHTML).toBe("");
  });
  it("names your Corners, or Soosh with a nudge to follow some", () => {
    render(<MemoryRouter><StillMakingSection cards={[card(1)]} fallback={false} onOpen={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: HOME_V3_COPY.stillMakingYours })).toBeTruthy();
    cleanup();
    render(<MemoryRouter><StillMakingSection cards={[card(1)]} fallback onOpen={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: HOME_V3_COPY.stillMakingAll })).toBeTruthy();
    expect(screen.getByText(HOME_V3_COPY.followMore)).toBeTruthy();
  });
  it("opens the Moment at its thoughts from the card it is on, with no action button", () => {
    const onOpen = vi.fn();
    render(<MemoryRouter><StillMakingSection cards={[card(7)]} fallback={false} onOpen={onOpen} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Thoughts" }));
    expect(onOpen.mock.calls[0][0].card.postId).toBe(7);
    const row = document.querySelector("[data-moment-actions]")!;
    expect(row.textContent).toBe("");
  });
});

describe("Happening this week on Home", () => {
  it("is not shown without events, and links each ticket to its Space's events", () => {
    const { container } = render(<MemoryRouter><HappeningSection events={[]} /></MemoryRouter>);
    expect(container.innerHTML).toBe("");
    render(<MemoryRouter><HappeningSection events={[{ id: 1, title: "Wheel night", startsAt: Date.now() + 86400000, spaceName: "Clay House", spaceSlug: "clay-house" }]} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: /Wheel night/ }).getAttribute("href")).toBe("/space/clay-house?tab=events");
  });
});
