// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("heic2any", () => ({ default: vi.fn() }));
const city = vi.hoisted(() => ({ value: "New York" }));
const busy = vi.hoisted(() => ({ rows: [] as { key: string; events: number }[] }));
vi.mock("../../lib/interests", () => ({ useInterests: () => ({ city: city.value }) }));
vi.mock("../../lib/busyCorners", () => ({ fetchBusyCorners: async () => busy.rows }));
vi.mock("../home/SuggestionPhoto", () => ({ SuggestionPhoto: () => <span /> }));
vi.mock("../HorizontalRow", () => ({ HorizontalRow: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul> }));

import { BUSY_HEADING, EmptySearch } from "./EmptySearch";

const show = () => render(<MemoryRouter><EmptySearch /></MemoryRouter>);

beforeEach(() => {
  city.value = "New York";
  busy.rows = [];
});
afterEach(cleanup);

describe("empty search", () => {
  it("shows Busy this week with the Corners that have events, and a row of up to six Corners", async () => {
    busy.rows = [{ key: "food-cooking/pasta", events: 4 }, { key: "crafts-making/pottery", events: 1 }];
    show();
    expect(await screen.findByRole("heading", { name: BUSY_HEADING })).toBeTruthy();
    expect(screen.getByText("4 events")).toBeTruthy();
    expect(screen.getByText("1 event")).toBeTruthy();
    const row = screen.getByRole("heading", { name: "Corners" }).closest("section")!;
    const tiles = row.querySelectorAll("li");
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(6);
  });

  it("leaves Busy this week out when nothing is on, and never says Be the first", async () => {
    show();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Corners" })).toBeTruthy());
    expect(screen.queryByRole("heading", { name: BUSY_HEADING })).toBeNull();
    expect(document.body.textContent).not.toContain("Be the first");
  });
});
