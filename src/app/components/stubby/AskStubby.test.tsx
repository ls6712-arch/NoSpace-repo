// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  askStubbyStream: vi.fn(),
  asksLeft: vi.fn(async () => 3),
  fetchMyPicks: vi.fn(async () => [] as unknown[]),
  removeMyPick: vi.fn(async () => ({ error: null, askId: 7 })),
}));
vi.mock("../../lib/stubbyAsk", async (orig) => ({ ...(await orig<typeof import("../../lib/stubbyAsk")>()), ...api }));

import { MemoryRouter } from "react-router";
import { AskStubby, useAskStubby } from "./AskStubby";
import { StubbyResults } from "./StubbyResults";
import type { BuddyReaction } from "./StubbyBuddy";

/** The form and the results, sharing one ask, as the Calendar stage puts them. */
function Harness({ onReact }: { onReact?: (r: BuddyReaction) => void }) {
  const state = useAskStubby({ onReact });
  return (
    <>
      <AskStubby state={state} />
      <StubbyResults state={state} />
      <p data-testid="busy">{String(state.busy)}</p>
      <p data-testid="outcome">{String(state.outcome)}</p>
    </>
  );
}

// A fixed clock (Date only) so "today" never straddles midnight: Sunday Nov 1, 2026, 5:00 pm New York.
const CLOCK = Date.UTC(2026, 10, 1, 22);
const pick = { id: 9, title: "Wheel night", place: "Greenpoint, Brooklyn", startsAt: Date.UTC(2026, 10, 7, 23), endsAt: null, price: "$35", url: "https://example.com/wheel", note: "Price not listed", kind: "event" as const, why: null, after: false, askId: 7, createdAt: CLOCK };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(CLOCK);
  for (const f of Object.values(api)) f.mockClear();
  api.asksLeft.mockResolvedValue(3);
  api.fetchMyPicks.mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AskStubby", () => {
  it("asks, makes Stubby think then stamp, and shows what he found", async () => {
    const onReact = vi.fn();
    api.askStubbyStream.mockResolvedValue({ found: 1, asksLeft: 2, error: null, askId: 7 });
    render(<Harness onReact={onReact} />);
    expect(await screen.findByText("3 asks left today")).toBeTruthy();
    api.fetchMyPicks.mockResolvedValue([pick]);
    fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: "pottery on Saturday" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    expect(await screen.findByText("Found 1 thing.")).toBeTruthy();
    expect(api.askStubbyStream).toHaveBeenCalledWith("pottery on Saturday", expect.anything());
    expect(screen.getByTestId("busy").textContent).toBe("false");
    expect(screen.getByTestId("outcome").textContent).toBe("found");
    expect(onReact).toHaveBeenCalledWith("stamped");
    expect(screen.getByText("2 asks left today")).toBeTruthy();
    expect(screen.getByText("Wheel night")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open/ }).getAttribute("href")).toBe("https://example.com/wheel");
    expect(screen.getByText("Price not listed")).toBeTruthy();
  });

  it("shrugs when nothing fits", async () => {
    const onReact = vi.fn();
    api.askStubbyStream.mockResolvedValue({ found: 0, asksLeft: 1, error: null, askId: 7 });
    render(<Harness onReact={onReact} />);
    fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: "underwater chess" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    await waitFor(() => expect(screen.getByTestId("outcome").textContent).toBe("nothing"));
    expect(onReact).toHaveBeenCalledWith("shrug");
    // Never a blank area: the results say so too, with the ways on.
    const empty = document.querySelector("[data-stubby-empty]")!;
    expect(empty.textContent).toContain("Nothing fit this time. Try asking another way.");
    expect([...empty.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["This weekend", "Surprise me", "Try different words"]);
  });

  it("tilts and says why when the ask fails", async () => {
    const onReact = vi.fn();
    api.askStubbyStream.mockResolvedValue({ found: 0, asksLeft: null, error: "The scout is switched off." });
    render(<Harness onReact={onReact} />);
    fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: "running" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    expect((await screen.findByRole("alert")).textContent).toBe("The scout is switched off.");
    expect(onReact).toHaveBeenCalledWith("tilt");
  });

  it("stops at 3 a day: the field and button are off, and the count is left to Stubby's line", async () => {
    api.asksLeft.mockResolvedValue(0);
    render(<Harness />);
    await waitFor(() => expect((screen.getByLabelText("What are you in the mood for?") as HTMLInputElement).disabled).toBe(true));
    expect((screen.getByRole("button", { name: "Ask Stubby" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/asks? left today/)).toBeNull();
  });

  it("a quick idea fills in the field and asks (one ask, like typing)", async () => {
    const onReact = vi.fn();
    api.askStubbyStream.mockResolvedValue({ found: 2, asksLeft: 2, error: null, askId: 7 });
    render(<Harness onReact={onReact} />);
    const chips = await screen.findByRole("group", { name: "Quick ideas" });
    expect(Array.from(chips.querySelectorAll("button")).map((b) => b.textContent)).toEqual(["Free tonight", "This weekend", "Something outdoors"]);
    fireEvent.click(screen.getByRole("button", { name: "This weekend" }));
    expect(await screen.findByText("Found 2 things.")).toBeTruthy();
    expect(api.askStubbyStream).toHaveBeenCalledTimes(1);
    expect(api.askStubbyStream).toHaveBeenCalledWith("This weekend", expect.anything());
    expect(onReact).toHaveBeenCalledWith("stamped");
  });

  it("hides the quick ideas at 0 asks left", async () => {
    api.asksLeft.mockResolvedValue(0);
    render(<Harness />);
    await waitFor(() => expect((screen.getByLabelText("What are you in the mood for?") as HTMLInputElement).disabled).toBe(true));
    expect(screen.queryByRole("group", { name: "Quick ideas" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Free tonight" })).toBeNull();
  });

  it("removes a pick", async () => {
    api.fetchMyPicks.mockResolvedValue([pick]);
    render(<Harness />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove: Wheel night" }));
    await waitFor(() => expect((api.removeMyPick.mock.calls[0] as unknown[] | undefined)?.[0]).toBe(9));
    expect(screen.queryByText("Wheel night")).toBeNull();
  });

  it("answers Stay in from their own Pursuits and Corners, never the search, and says so when there's nothing", async () => {
    api.askStubbyStream.mockResolvedValue({ found: 0, asksLeft: 3, error: null, question: "setting" });
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    expect(await screen.findByText("3 asks left today")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: "something fun" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    fireEvent.click(await screen.findByRole("button", { name: "Stay in" }));
    // No account in the test: nothing to go on, so the honest empty state with its ways on.
    expect(await screen.findByText("Nothing fit this time. Try asking another way.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Head out" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start a Pursuit" }).getAttribute("href")).toBe("/pursuits/new");
    expect(screen.getByRole("link", { name: "Go to Discover" })).toBeTruthy();
    // Only the first ask went out; Stay in used no search and no ask.
    expect(api.askStubbyStream).toHaveBeenCalledTimes(1);
    expect(screen.getByText("3 asks left today")).toBeTruthy();

    // Head out sends the same ask again, heading out.
    api.askStubbyStream.mockResolvedValue({ found: 0, asksLeft: 3, error: null });
    fireEvent.click(screen.getByRole("button", { name: "Head out" }));
    await waitFor(() => expect(api.askStubbyStream).toHaveBeenCalledTimes(2));
    expect(api.askStubbyStream.mock.calls[1]?.[0]).toBe("something fun");
    expect((api.askStubbyStream.mock.calls[1]?.[1] as { answers?: { setting?: string } }).answers?.setting).toBe("out");
  });

  it("an ask that says stay in skips the search too", async () => {
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    expect(await screen.findByText("3 asks left today")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: "a cozy night in" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    expect(await screen.findByText("Nothing fit this time. Try asking another way.")).toBeTruthy();
    expect(api.askStubbyStream).not.toHaveBeenCalled();
  });

  it("outside a verified country, the care card says to call the local emergency number, with nothing to tap", async () => {
    api.askStubbyStream.mockResolvedValue({ found: 0, asksLeft: null, error: null, care: { line: "That sounds really hard. You don’t have to handle it alone.", resources: [], emergency: { label: "Call your local emergency number", detail: "If you’re in danger right now", href: null }, friend: { label: "Message a friend", href: "/messages" } } });
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    expect(await screen.findByText("3 asks left today")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: "pottery tonight" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    expect(await screen.findByText("Call your local emergency number")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Call your local emergency number" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Someone to talk to" })).toBeNull();
    expect(screen.getByRole("link", { name: "Message a friend" }).getAttribute("href")).toBe("/messages");
  });

  it("shows the care card in place of picks, with someone to talk to and a way to message a friend", async () => {
    api.askStubbyStream.mockResolvedValue({ found: 0, asksLeft: null, error: null, care: { line: "That sounds really hard. You don’t have to handle it alone.", resources: [{ label: "Call 988", detail: "988 Suicide and Crisis Lifeline, any time", href: "tel:988" }], emergency: { label: "Call 911", detail: "If you’re in danger right now", href: "tel:911" }, friend: { label: "Message a friend", href: "/messages" } } });
    render(
      <MemoryRouter>
        <Harness />
      </MemoryRouter>,
    );
    expect(await screen.findByText("3 asks left today")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("What are you in the mood for?"), { target: { value: "pottery tonight" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Stubby" }));
    expect(await screen.findByText("That sounds really hard. You don’t have to handle it alone.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Call 988" }).getAttribute("href")).toBe("tel:988");
    expect(screen.getByRole("link", { name: "Message a friend" }).getAttribute("href")).toBe("/messages");
    expect(screen.getByRole("link", { name: "Call 911" }).getAttribute("href")).toBe("tel:911");
    // No ask was used, and no picks.
    expect(screen.getByText("3 asks left today")).toBeTruthy();
    expect(screen.getByTestId("outcome").textContent).toBe("null");
  });
});
