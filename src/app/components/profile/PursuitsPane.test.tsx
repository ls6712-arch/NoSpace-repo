// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { PursuitsPane } from "./PursuitsPane";
vi.mock("../../lib/profileApi", () => ({
  fetchPursuits: vi.fn(async () => ({
    ok: true,
    value: [
      {
        id: "old-pursuit",
        category: "Cooking",
        goal: "Try ten recipes",
        target: 10,
        momentCount: 2,
        stubCount: 0,
        finished: false,
        archived: false,
        lastMomentDate: null,
        finishedAt: null,
        sharedWithYou: false,
      },
    ],
  })),
  fetchMoments: vi.fn(async () => ({ ok: true, value: { items: [] } })),
  deletePursuit: vi.fn(),
  setPursuitArchived: vi.fn(),
  setPursuitFinished: vi.fn(),
}));
afterEach(cleanup);
function setup(owner = true) {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route
          path="/profile"
          element={<PursuitsPane profileId="owner" owner={owner} />}
        />
        <Route path="/pursuits/new" element={<p>Unified creation</p>} />
        <Route path="/pursuit/:id" element={<p>Pursuit detail</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
describe("profile Pursuit entry points", () => {
  it("opens unified creation instead of the old category and Moments dialog", async () => {
    setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Start a Pursuit" }),
    );
    expect(screen.getByText("Unified creation")).toBeTruthy();
    expect(screen.queryByText("Number of Moments (optional)")).toBeNull();
  });
  it("opens the compatible detail from an existing card", async () => {
    setup();
    fireEvent.click(
      await screen.findByRole("button", { name: /Try ten recipes/ }),
    );
    expect(screen.getByText("Pursuit detail")).toBeTruthy();
  });
  it("keeps archive and delete accessible separately", async () => {
    setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "More options" }),
    );
    expect(await screen.findByRole("button", { name: "Archive" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });
  it("keeps other profiles read-only", async () => {
    setup(false);
    await screen.findByText("Try ten recipes");
    expect(
      screen.queryByRole("button", { name: "Start a Pursuit" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "More options" })).toBeNull();
  });
});
