// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../lib/reactionState", () => ({ useReactionState: () => ({ mine: [], toggle: vi.fn() }) }));
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
    const { container } = render(<MemoryRouter><StillMakingSection cards={[]} fallback={false} onOpen={vi.fn()} onMake={vi.fn()} /></MemoryRouter>);
    expect(container.innerHTML).toBe("");
  });
  it("names your Corners, or Soosh with a nudge to follow some", () => {
    render(<MemoryRouter><StillMakingSection cards={[card(1)]} fallback={false} onOpen={vi.fn()} onMake={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: HOME_V3_COPY.stillMakingYours })).toBeTruthy();
    cleanup();
    render(<MemoryRouter><StillMakingSection cards={[card(1)]} fallback onOpen={vi.fn()} onMake={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: HOME_V3_COPY.stillMakingAll })).toBeTruthy();
    expect(screen.getByText(HOME_V3_COPY.followMore)).toBeTruthy();
  });
  it("starts Make your version from the card it is on", () => {
    const onMake = vi.fn();
    render(<MemoryRouter><StillMakingSection cards={[card(7)]} fallback={false} onOpen={vi.fn()} onMake={onMake} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Make your version/ }));
    expect(onMake.mock.calls[0][0].card.postId).toBe(7);
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
