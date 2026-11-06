// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { CornerStarterContent } from "./CornerStarterContent";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const mount = (restricted = false) => render(<MemoryRouter><CornerStarterContent spaceSlug="art-creative" slug="drawing" restricted={restricted}/></MemoryRouter>);

it("shows real activities, a starter Pursuit and resources without creating anything", () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const write = vi.spyOn(Storage.prototype, "setItem");
  mount();
  const activities = screen.getByRole("region", { name: "Things to try" });
  expect(within(activities).getAllByRole("article")).toHaveLength(3);
  const details = activities.querySelector("details")!;
  fireEvent.click(details.querySelector("summary")!);
  expect(details.open).toBe(true);
  expect(within(details).getByText("Cost unknown. Check supplies, access and travel before starting.")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Pursuit ideas" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Start a Pursuit" }).getAttribute("href")).toBe("/pursuits/new?template=drawing-pursuit-01");
  expect(fetch).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled(); write.mockRestore();
});

it("uses outbound links and original descriptions without third-party media embeds", () => {
  mount();
  const resources = screen.getByRole("region", { name: "Resources" });
  const link = within(resources).getByRole("link", { name: "Visit website: The Public Domain Review" });
  expect(link.getAttribute("href")).toBe("https://publicdomainreview.org/");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  expect(resources.querySelector("iframe,img,video,audio")).toBeNull();
});

it("preserves the chosen template in the guest login redirect", () => {
  mount(true);
  const href = screen.getByRole("link", { name: "Start a Pursuit" }).getAttribute("href")!;
  expect(href.startsWith("/login?")).toBe(true);
  expect(new URLSearchParams(href.split("?")[1]).get("redirect")).toBe("/pursuits/new?template=drawing-pursuit-01");
});

it("does not show unrelated library sections on other Corners", () => {
  const { container } = render(<MemoryRouter><CornerStarterContent spaceSlug="custom" slug="unknown" restricted/></MemoryRouter>);
  expect(container.textContent).toBe("");
});
