// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StarterLibrary } from "./StarterLibrary";

function HistoryControls() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="location">{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>Browser Back</button></>;
}
const mount = (restricted = false, entry = "/discover?window=sat-day") => render(<MemoryRouter initialEntries={["/home", entry]}><StarterLibrary restricted={restricted}/><HistoryControls/></MemoryRouter>);
beforeEach(() => {
  Element.prototype.scrollIntoView ??= () => {};
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("keeps a search cleared when a Corner is chosen straight after (no stale URL params)", async () => {
  mount();
  fireEvent.click(screen.getByRole("link", { name: "See all resources" }));
  const dialog = await screen.findByRole("dialog", { name: "Resources" });
  fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search resources" }), { target: { value: "Standard" } });
  expect(screen.getByTestId("location").textContent).toContain("browseQuery=Standard");
  // Both changes land before React renders again, as when a fast input clears the box and picks a Corner.
  act(() => {
    fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search resources" }), { target: { value: "" } });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Corner" }), { target: { value: "books-writing/reading" } });
  });
  const url = screen.getByTestId("location").textContent ?? "";
  expect(url).toContain("browseCorner=books-writing%2Freading");
  expect(url).not.toContain("browseQuery");
  expect(within(dialog).getAllByRole("link", { name: /^Visit website:/ })).toHaveLength(3);
});

it("shows the website descriptions and starter steps without navigation or account writes", () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  mount();
  const resources = screen.getByRole("region", { name: "Resources" });
  const source = within(resources).getByRole("link", { name: "Visit website: Standard Ebooks" });
  expect(source.getAttribute("href")).toBe("https://standardebooks.org/");
  expect(source.getAttribute("target")).toBe("_blank");
  expect(source.getAttribute("rel")).toBe("noopener noreferrer");
  expect(source.querySelectorAll("a")).toHaveLength(0);
  expect(source.textContent).toContain("Carefully formatted editions");
  const pursuits = screen.getByRole("region", { name: "Pursuit ideas" });
  expect(within(pursuits).getByText("Choose the book")).toBeTruthy();
  expect(within(pursuits).getAllByRole("link", { name: "Start a Pursuit" })[0].getAttribute("href")).toBe("/pursuits/new?template=reading-pursuit-01");
  expect(fetch).not.toHaveBeenCalled();
});

it("keeps guest and pending-account browsing public while preserving the chosen template through signup", () => {
  mount(true);
  const href = within(screen.getByRole("region", { name: "Pursuit ideas" })).getAllByRole("link", { name: "Start a Pursuit" })[0].getAttribute("href")!;
  expect(href.startsWith("/login?")).toBe(true);
  expect(new URLSearchParams(href.split("?")[1]).get("redirect")).toBe("/pursuits/new?template=reading-pursuit-01");
  expect(screen.getByRole("link", { name: "Visit website: Standard Ebooks" }).getAttribute("href")).toBe("https://standardebooks.org/");
});

it("opens the full resource collection and searches and filters it through shareable URL state", async () => {
  mount();
  fireEvent.click(screen.getByRole("link", { name: "See all resources" }));
  const dialog = await screen.findByRole("dialog", { name: "Resources" });
  expect(within(dialog).getAllByRole("link", { name: /^Visit website:/ })).toHaveLength(16);
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("heading", { name: "Resources" })));
  fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search resources" }), { target: { value: "Standard" } });
  expect(within(dialog).getAllByRole("link", { name: /^Visit website:/ })).toHaveLength(1);
  expect(screen.getByTestId("location").textContent).toContain("browseQuery=Standard");
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Corner" }), { target: { value: "music/guitar" } });
  expect(within(dialog).getByRole("status").textContent).toBe("No matches. Try another word or Corner.");
  fireEvent.click(within(dialog).getByRole("button", { name: "Clear filters" }));
  expect(within(dialog).getAllByRole("link", { name: /^Visit website:/ })).toHaveLength(16);
  expect(screen.getByTestId("location").textContent).toContain("window=sat-day");
});

it("Browser Back closes a collection after filter edits instead of undoing every typed letter", async () => {
  mount();
  const trigger = screen.getByRole("link", { name: "See all resources" });
  fireEvent.click(trigger);
  const dialog = await screen.findByRole("dialog", { name: "Resources" });
  fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search resources" }), { target: { value: "art" } });
  fireEvent.click(screen.getByRole("button", { name: "Browser Back", hidden: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByTestId("location").textContent).toBe("/discover?window=sat-day");
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});

it("closes a directly shared collection on Discover and preserves unrelated parameters", async () => {
  mount(false, "/discover?window=sun-day&browse=resources&browseQuery=Standard&browseCorner=books-writing%2Freading");
  const dialog = await screen.findByRole("dialog", { name: "Resources" });
  expect(within(dialog).getAllByRole("link", { name: /^Visit website:/ })).toHaveLength(1);
  fireEvent.click(within(dialog).getByRole("button", { name: "Close collection" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByTestId("location").textContent).toBe("/discover?window=sun-day");
});

it("shows all Pursuit templates and links a filtered goal directly to the existing editable form", async () => {
  mount();
  fireEvent.click(screen.getByRole("link", { name: "See all ideas" }));
  const dialog = await screen.findByRole("dialog", { name: "Pursuit ideas" });
  expect(within(dialog).getAllByRole("link", { name: "Start a Pursuit" })).toHaveLength(10);
  fireEvent.change(within(dialog).getByRole("combobox", { name: "Corner" }), { target: { value: "photography-film/photography" } });
  expect(within(dialog).getAllByRole("link", { name: "Start a Pursuit" })).toHaveLength(1);
  expect(within(dialog).getByRole("link", { name: "Start a Pursuit" }).getAttribute("href")).toBe("/pursuits/new?template=photography-pursuit-01");
});
