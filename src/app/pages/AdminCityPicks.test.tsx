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
  runScout: vi.fn(),
  fetchSources: vi.fn(async () => ({ sources: [] as unknown[], error: null })),
  setSourceEnabled: vi.fn(async () => ({ error: null })),
  addSource: vi.fn(async () => ({ error: null })),
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
  for (const f of [api.savePick, api.setPublished, api.deletePick, api.runScout, api.fetchAllPicks]) f.mockClear();
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

  it("runs the scout with the focus, reloads, and says what it added and skipped", async () => {
    api.runScout.mockResolvedValue({ report: { added: 2, found: 3, searches: 5, dropped: [{ title: "Old fair", reason: "More than 14 days away." }] }, error: null });
    show();
    await screen.findByText("Halloween parade");
    fireEvent.change(screen.getByLabelText(/^Look for/), { target: { value: "pottery" } });
    fireEvent.click(screen.getByRole("button", { name: "Find picks" }));
    expect(await screen.findByText("Added 2 drafts.")).toBeTruthy();
    expect(api.runScout).toHaveBeenCalledWith("pottery");
    expect(api.fetchAllPicks).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Skipped 1 pick")).toBeTruthy();
    expect(screen.getByText("Old fair")).toBeTruthy();
  });

  it("shows the scout's error and does not reload", async () => {
    api.runScout.mockResolvedValue({ report: null, error: "The scout is switched off." });
    show();
    await screen.findByText("Halloween parade");
    fireEvent.click(screen.getByRole("button", { name: "Find picks" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The scout is switched off.");
    expect(api.fetchAllPicks).toHaveBeenCalledTimes(1);
  });

  it("marks a scout draft with its source link, check date and note", async () => {
    api.fetchAllPicks.mockResolvedValue({
      picks: [row({ scout: { sourceUrl: "https://example.com/pottery", checkedAt: Date.UTC(2026, 10, 1, 15), note: "Price not listed" } })],
      error: null,
    });
    show();
    await screen.findByText("Halloween parade");
    expect(screen.getByText(/Found by Stubby · Checked Nov 1/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Source" }).getAttribute("href")).toBe("https://example.com/pottery");
    expect(screen.getByText("Price not listed")).toBeTruthy();
  });

  it("lists where Stubby looks each morning, pauses one, and adds one", async () => {
    api.fetchSources.mockResolvedValue({
      sources: [
        { id: 1, name: "NYC Parks", focus: "parks", searchDomain: "nycgovparks.org", trustedHost: "nycgovparks.org", enabled: true },
        { id: 2, name: "Around the city", focus: "a mix", searchDomain: null, trustedHost: null, enabled: false },
      ],
      error: null,
    });
    show();
    expect(await screen.findByText("NYC Parks")).toBeTruthy();
    expect(screen.getByText("nycgovparks.org · Publishes on its own from nycgovparks.org")).toBeTruthy();
    expect(screen.getByText("Whole web · Drafts only")).toBeTruthy();
    expect(screen.getByText("Paused")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(api.setSourceEnabled).toHaveBeenCalledWith(1, false));
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    await waitFor(() => expect(api.setSourceEnabled).toHaveBeenCalledWith(2, true));

    fireEvent.click(screen.getByRole("button", { name: "Add a place" }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Queens Library" } });
    fireEvent.change(screen.getByLabelText(/^What to look for/), { target: { value: "free classes at Queens Public Library" } });
    fireEvent.change(screen.getByLabelText(/^Search only this site/), { target: { value: "https://www.queenslibrary.org/calendar" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save changes" }).at(-1)!);
    await waitFor(() => expect(api.addSource).toHaveBeenCalledTimes(1));
    expect((api.addSource.mock.calls[0] as unknown[])[0]).toMatchObject({ name: "Queens Library", searchDomain: "https://www.queenslibrary.org/calendar" });
  });
});
