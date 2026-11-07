// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it } from "vitest";
import { activitiesFor } from "../../lib/cornerActivities";
import { CornerActivities } from "./CornerActivities";

afterEach(cleanup);
const mount = (slug: string) => render(<MemoryRouter><CornerActivities cornerSlug={slug} /></MemoryRouter>);

it("shows nothing for a Corner with no activities", () => {
  const { container } = mount("pottery");
  expect(container.innerHTML).toBe("");
});

it("shows Things to try with tabs, a card per activity, and Try this opening the composer", () => {
  mount("origami");
  expect(screen.getByRole("heading", { name: "Things to try" })).toBeTruthy();
  const tabs = screen.getAllByRole("tab");
  expect(tabs.length).toBeGreaterThan(1);
  const panel = screen.getByRole("tabpanel");
  const cards = within(panel).getAllByRole("listitem").filter((li) => li.querySelector("h3"));
  const home = activitiesFor("origami").filter((a) => a.where === "home");
  expect(cards).toHaveLength(home.length);
  const first = within(cards[0]).getByRole("link", { name: "Try this" });
  expect(first.getAttribute("href")).toMatch(/^\/create\?hobby=crafts-making&sub=origami&activity=origami-\d+$/);
  // Cost, energy, who and duration are tags; the first step is on the card.
  expect(within(cards[0]).getByText("First step:")).toBeTruthy();
});

it("switches tabs, an activity can sit under more than one, and the active tab is marked", () => {
  mount("origami");
  const people = screen.getByRole("tab", { name: "With people" });
  fireEvent.click(people);
  expect(people.getAttribute("aria-selected")).toBe("true");
  const withOthers = activitiesFor("origami").filter((a) => a.who.includes("friend") || a.who.includes("group"));
  expect(within(screen.getByRole("tabpanel")).getAllByRole("link", { name: "Try this" })).toHaveLength(withOthers.length);
});
