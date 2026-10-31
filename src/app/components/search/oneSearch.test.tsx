// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * One search, three ways in: the box on Discover, the side menu's Search and the header magnifier all end at the
 * same /search, with the same scope, and /search gives the same results for "pottery" whichever way it was reached.
 */
vi.mock("heic2any", () => ({ default: vi.fn() }));
const searched = vi.hoisted(() => ({ queries: [] as string[] }));
vi.mock("../../lib/search", async (orig) => ({
  ...(await orig<typeof import("../../lib/search")>()),
  useUnifiedSearch: (q: string) => {
    searched.queries.push(q);
    const hits = /pottery/i.test(q)
      ? [{ group: "corner" as const, key: "corner:pottery", label: "Pottery", sub: "Crafts", to: "/corners/pottery", spaceSlug: "crafts-making", cornerSlug: "pottery" }]
      : [];
    const groups = { space: [], corner: hits, person: [], pursuit: [], moment: [], product: [] };
    return { groups, all: hits, loading: false };
  },
}));
vi.mock("../../lib/busyCorners", () => ({ fetchBusyCorners: async () => [] }));
vi.mock("../../lib/interests", () => ({ useInterests: () => ({ city: "" }) }));
vi.mock("../home/SuggestionPhoto", () => ({ SuggestionPhoto: () => <span /> }));
vi.mock("../HorizontalRow", () => ({ HorizontalRow: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul> }));

import { GlobalSearchBox } from "../nav/GlobalSearchBox";
import { SearchResults } from "../../pages/SearchResults";

const PLACEHOLDER = "Search Moments, people, Spaces";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.search}</p>;
}

/** The entry point under test, plus the real /search page it leads to. */
function app(entry: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/discover"]}>
      <Where />
      <Routes>
        <Route path="/discover" element={<main>{entry}</main>} />
        <Route path="/search" element={<SearchResults />} />
      </Routes>
    </MemoryRouter>,
  );
}

const resultLabels = () => screen.getAllByRole("link", { name: /Pottery/ }).map((a) => a.getAttribute("href"));

beforeEach(() => {
  searched.queries = [];
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
});
afterEach(cleanup);

describe("one search", () => {
  it("all three entry points use the same box: same label, same placeholder", () => {
    for (const entry of [<GlobalSearchBox launcher />, <GlobalSearchBox autoFocus inline />, <GlobalSearchBox />]) {
      const { unmount } = app(entry);
      expect(screen.getByRole("searchbox", { name: PLACEHOLDER }).getAttribute("placeholder")).toBe(PLACEHOLDER);
      unmount();
    }
  });

  it("Discover's box only leads to /search: it shows no results of its own, and the cursor is in the box there", async () => {
    app(<GlobalSearchBox launcher />);
    fireEvent.focus(screen.getByRole("searchbox", { name: PLACEHOLDER }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/search"));
    expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: PLACEHOLDER }));
  });

  it("the side menu's Search and the header magnifier send \"pottery\" to /search?q=pottery", async () => {
    for (const entry of [<GlobalSearchBox autoFocus inline />, <GlobalSearchBox />]) {
      const { unmount } = app(entry);
      const box = screen.getByRole("searchbox", { name: PLACEHOLDER });
      fireEvent.change(box, { target: { value: "pottery" } });
      fireEvent.keyDown(box, { key: "Enter" });
      await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/search?q=pottery"));
      unmount();
    }
  });

  it("returns the same results for \"pottery\" from all three", async () => {
    const seen: (string | null)[][] = [];
    // Discover: focus the launcher, then type in the /search box it opens.
    {
      const { unmount } = app(<GlobalSearchBox launcher />);
      fireEvent.focus(screen.getByRole("searchbox", { name: PLACEHOLDER }));
      const box = await screen.findByRole("searchbox", { name: PLACEHOLDER });
      fireEvent.change(box, { target: { value: "pottery" } });
      fireEvent.submit(box.closest("form")!);
      await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/search?q=pottery"));
      seen.push(resultLabels());
      unmount();
    }
    // The side menu and the magnifier: type there, press Enter, land on the same page.
    for (const entry of [<GlobalSearchBox autoFocus inline />, <GlobalSearchBox />]) {
      const { unmount } = app(entry);
      const box = screen.getByRole("searchbox", { name: PLACEHOLDER });
      fireEvent.change(box, { target: { value: "pottery" } });
      fireEvent.keyDown(box, { key: "Enter" });
      await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/search?q=pottery"));
      seen.push(resultLabels());
      unmount();
    }
    expect(seen).toHaveLength(3);
    expect(seen[0]).toEqual(["/corners/pottery"]);
    expect(seen[1]).toEqual(seen[0]);
    expect(seen[2]).toEqual(seen[0]);
    // And the one search function was asked the same thing every time.
    expect(new Set(searched.queries.filter((q) => /pottery/i.test(q)))).toEqual(new Set(["pottery"]));
  });
});
