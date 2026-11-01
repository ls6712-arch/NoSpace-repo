// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", () => ({ useReducedMotion: () => true }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
const api = vi.hoisted(() => ({
  askStubby: vi.fn(),
  fetchCityPicks: vi.fn(),
}));
vi.mock("../../lib/cityPicks", async (orig) => ({ ...(await orig<typeof import("../../lib/cityPicks")>()), ...api }));

import { askLine, CityPicksSection } from "./AskStubby";
import { visiblePicks, type CityPick } from "../../lib/cityPicks";

const pick = (over: Partial<CityPick> = {}): CityPick => ({
  id: 1, title: "Wheel night", place: "Greenpoint", startsAt: Date.now() + 86_400_000, endsAt: null, price: "$35", url: "https://example.com/w", cornerKey: null, color: "orange", published: true, ...over,
});
const stubby = () => document.querySelector("[data-stubby-state]")?.getAttribute("data-stubby-state");

beforeEach(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as unknown as typeof window.matchMedia;
  api.askStubby.mockReset();
  api.fetchCityPicks.mockReset();
});
afterEach(cleanup);

describe("asking Stubby", () => {
  it("says what came back, with plural counts", () => {
    expect(askLine(2, 1)).toBe("Added 2 things for you. 1 ask left today.");
    expect(askLine(1, 0)).toBe("Added 1 thing for you. 0 asks left today.");
    expect(askLine(0, null)).toBe("Nothing new for that. Try other words.");
  });

  it("can't ask with nothing typed", () => {
    render(<MemoryRouter><CityPicksSection picks={[]} /></MemoryRouter>);
    expect((screen.getByRole("button", { name: "Ask Stubby" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("asks, shows the new finds in the row, and Stubby stamps", async () => {
    api.askStubby.mockResolvedValue({ result: { added: 1, live: 0, asksLeft: 2 }, error: null });
    api.fetchCityPicks.mockResolvedValue([pick({ title: "Dog walk meetup", published: false, mine: true })]);
    render(<MemoryRouter><CityPicksSection picks={[]} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: "dog friendly saturday" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    expect(await screen.findByText("Dog walk meetup")).toBeTruthy();
    expect(api.askStubby).toHaveBeenCalledWith("dog friendly saturday");
    expect(api.fetchCityPicks.mock.calls[0][2]).toBe("me");
    expect(screen.getByText("Added 1 thing for you. 2 asks left today.")).toBeTruthy();
    expect(stubby()).toBe("stamped");
  });

  it("shrugs when nothing new turns up, and tilts with the reason when he can't look", async () => {
    api.askStubby.mockResolvedValueOnce({ result: { added: 0, live: 0, asksLeft: 1 }, error: null });
    api.fetchCityPicks.mockResolvedValue([]);
    render(<MemoryRouter><CityPicksSection picks={[]} /></MemoryRouter>);
    const box = screen.getByLabelText("What are you in the mood for?");
    fireEvent.change(box, { target: { value: "underwater chess" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    await screen.findByText("Nothing new for that. Try other words. 1 ask left today.");
    expect(stubby()).toBe("shrug");
    api.askStubby.mockResolvedValueOnce({ result: null, error: "That's your 3 asks for today. Stubby will look again tomorrow." });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    await waitFor(() => expect(stubby()).toBe("tilt"));
    expect(screen.getByText("That's your 3 asks for today. Stubby will look again tomorrow.")).toBeTruthy();
  });
});

describe("what the row shows", () => {
  it("shows live picks and this person's own finds, never anyone else's drafts", () => {
    const now = Date.now();
    const shown = visiblePicks(
      [pick({ id: 1 }), pick({ id: 2, published: false, mine: true }), pick({ id: 3, published: false })],
      now,
      now + 7 * 86_400_000,
    );
    expect(shown.map((p) => p.id)).toEqual([1, 2]);
  });
});
