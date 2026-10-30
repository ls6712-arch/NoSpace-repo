// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("heic2any", () => ({ default: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: "u1" } as { id: string } | null, isAdmin: true }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("../context/CategoriesContext", () => ({ useCategories: () => ({ isAdmin: auth.isAdmin }) }));
const api = vi.hoisted(() => ({
  fetchAllPicks: vi.fn(),
  savePick: vi.fn(async () => ({ error: null })),
  setPublished: vi.fn(async () => ({ error: null })),
  deletePick: vi.fn(async () => ({ error: null })),
}));
vi.mock("../lib/cityPicks", async (orig) => ({ ...(await orig<typeof import("../lib/cityPicks")>()), ...api }));

import { AdminCityPicks } from "./AdminCityPicks";

const row = (over: Record<string, unknown> = {}) => ({
  id: 1, title: "Halloween parade", place: "Sixth Avenue", startsAt: Date.UTC(2026, 9, 31, 23), endsAt: null, price: "free", url: null, cornerKey: null, color: "orange", published: false, cornerId: null, ...over,
});

beforeEach(() => {
  auth.user = { id: "u1" };
  auth.isAdmin = true;
  api.fetchAllPicks.mockResolvedValue({ picks: [row(), row({ id: 2, title: "Marathon", published: true })], error: null });
  for (const f of [api.savePick, api.setPublished, api.deletePick]) f.mockClear();
});
afterEach(cleanup);
const show = () => render(<MemoryRouter><AdminCityPicks /></MemoryRouter>);

describe("AdminCityPicks", () => {
  it("shows nothing to someone who is not an admin", () => {
    auth.isAdmin = false;
    show();
    expect(screen.getByText("Nothing here for you")).toBeTruthy();
    expect(api.fetchAllPicks).not.toHaveBeenCalled();
  });

  it("lists picks with Published or Draft, and publishes and unpublishes", async () => {
    show();
    await screen.findByText("Halloween parade");
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.getByText("Published")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(api.setPublished).toHaveBeenCalledWith(1, true);
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    expect(api.setPublished).toHaveBeenCalledWith(2, false);
  });

  it("will not save a pick without a title, and saves a good one", async () => {
    show();
    await screen.findByText("Halloween parade");
    fireEvent.click(screen.getByRole("button", { name: "Add a pick" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Add a title.");
    expect(api.savePick).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Dumbo night" } });
    fireEvent.change(screen.getByLabelText(/^Starts/), { target: { value: "2026-11-02T19:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api.savePick).toHaveBeenCalledTimes(1));
    expect((api.savePick.mock.calls[0] as unknown[])[0]).toMatchObject({ title: "Dumbo night", starts: "2026-11-02T19:00" });
  });

  it("asks before deleting", async () => {
    show();
    await screen.findByText("Halloween parade");
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(api.deletePick).not.toHaveBeenCalled();
    expect(screen.getByText("This removes the pick for good.")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)!);
    await waitFor(() => expect(api.deletePick).toHaveBeenCalledWith(1));
  });
});
