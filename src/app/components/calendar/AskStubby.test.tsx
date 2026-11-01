// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  askStubby: vi.fn(),
  asksLeft: vi.fn(async () => 3),
  fetchMyPicks: vi.fn(async () => [] as unknown[]),
  removeMyPick: vi.fn(async () => ({ error: null })),
}));
vi.mock("../../lib/stubbyAsk", async (orig) => ({ ...(await orig<typeof import("../../lib/stubbyAsk")>()), ...api }));

import { AskStubby } from "./AskStubby";

const pick = { id: 9, title: "Wheel night", place: "Greenpoint, Brooklyn", startsAt: Date.UTC(2026, 10, 7, 23), endsAt: null, price: "$35", url: "https://example.com/wheel", note: "Price not listed" };

beforeEach(() => {
  for (const f of Object.values(api)) f.mockClear();
  api.asksLeft.mockResolvedValue(3);
  api.fetchMyPicks.mockResolvedValue([]);
});
afterEach(cleanup);

describe("AskStubby", () => {
  it("asks, makes Stubby think then stamp, and shows what he found", async () => {
    const onBusy = vi.fn();
    const onReact = vi.fn();
    api.askStubby.mockResolvedValue({ found: 1, asksLeft: 2, error: null });
    render(<AskStubby onBusy={onBusy} onReact={onReact} />);
    expect(await screen.findByText("3 asks left today")).toBeTruthy();
    api.fetchMyPicks.mockResolvedValue([pick]);
    fireEvent.change(screen.getByLabelText("What are you after?"), { target: { value: "pottery on Saturday" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    expect(await screen.findByText("Found 1 thing.")).toBeTruthy();
    expect(api.askStubby).toHaveBeenCalledWith("pottery on Saturday");
    expect(onBusy.mock.calls).toEqual([[true], [false]]);
    expect(onReact).toHaveBeenCalledWith("stamped");
    expect(screen.getByText("2 asks left today")).toBeTruthy();
    expect(screen.getByText("Wheel night")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open/ }).getAttribute("href")).toBe("https://example.com/wheel");
    expect(screen.getByText("Price not listed")).toBeTruthy();
  });

  it("shrugs when nothing fits", async () => {
    const onReact = vi.fn();
    api.askStubby.mockResolvedValue({ found: 0, asksLeft: 1, error: null });
    render(<AskStubby onReact={onReact} />);
    fireEvent.change(screen.getByLabelText("What are you after?"), { target: { value: "underwater chess" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    expect(await screen.findByText("Nothing fit this time. Try asking another way.")).toBeTruthy();
    expect(onReact).toHaveBeenCalledWith("shrug");
  });

  it("tilts and says why when the ask fails", async () => {
    const onReact = vi.fn();
    api.askStubby.mockResolvedValue({ found: 0, asksLeft: null, error: "The scout is switched off." });
    render(<AskStubby onReact={onReact} />);
    fireEvent.change(screen.getByLabelText("What are you after?"), { target: { value: "running" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The scout is switched off.");
    expect(onReact).toHaveBeenCalledWith("tilt");
  });

  it("stops at 3 a day", async () => {
    api.asksLeft.mockResolvedValue(0);
    render(<AskStubby />);
    expect(await screen.findByText("That’s your 3 for today. Stubby can look again tomorrow.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Ask Stubby" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("removes a pick", async () => {
    api.fetchMyPicks.mockResolvedValue([pick]);
    render(<AskStubby />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove: Wheel night" }));
    await waitFor(() => expect(api.removeMyPick).toHaveBeenCalledWith(9));
    expect(screen.queryByText("Wheel night")).toBeNull();
  });
});
