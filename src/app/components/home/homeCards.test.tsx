// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BestFitCard } from "./BestFitCard";
import { MoreWaysList } from "./MoreWaysList";
import { YourWeekCard } from "./YourWeekCard";
import { ADD_FREE_TIME_COPY } from "../../lib/homeCopy";
import type { HomeItem } from "../../lib/homeItems";
import type { WeekWindow } from "../../lib/homeWeek";

afterEach(cleanup);

const NOW = Date.parse("2026-11-05T22:00:00Z"); // Thursday 5 PM in New York

const event: HomeItem = {
  id: "event:7",
  kind: "event",
  refId: "7",
  title: "Bouldering night",
  corner: { key: "sports-fitness/climbing", name: "Climbing", spaceSlug: "sports-fitness", slug: "climbing" },
  spaceSlug: "boulder-club",
  detail: "Thu, 7:00 PM · Gowanus",
  reasons: ["fits_window", "friend_going"],
  why: "Fits your Thursday evening · Priya’s going",
  startsAt: Date.parse("2026-11-06T00:00:00Z"),
  score: 0.6,
};
const atHome: HomeItem = {
  id: "at_home:art-creative/drawing",
  kind: "at_home",
  refId: "art-creative/drawing",
  title: "Drawing",
  corner: { key: "art-creative/drawing", name: "Drawing", spaceSlug: "art-creative", slug: "drawing" },
  spaceSlug: null,
  detail: "At home · about 30 min",
  reasons: ["picked"],
  why: "One of your picks",
  startsAt: null,
  step: "Draw what is on your desk for ten minutes.",
  score: null,
};
const pursuit: HomeItem = { ...event, id: "open_pursuit:p1", kind: "open_pursuit", refId: "p1", title: "Wheel weekends", why: null };

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);
const noop = () => {};

describe("Best fit card", () => {
  it("shows the title, when and where, the why line, and the two actions, with no price", () => {
    wrap(<BestFitCard item={event} state="idle" onShown={noop} onOpen={noop} onPrimary={noop} onInvite={noop} />);
    expect(screen.getByRole("heading", { name: "Bouldering night" })).toBeTruthy();
    expect(screen.getByText("Thu, 7:00 PM · Gowanus")).toBeTruthy();
    expect(screen.getByText("Fits your Thursday evening · Priya’s going")).toBeTruthy();
    expect(screen.getByRole("button", { name: "I’m going" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Invite a friend" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\$|\bfree\b/i);
  });

  it("is Start for an at-home row, with the badge and the first step", () => {
    wrap(<BestFitCard item={atHome} state="idle" onShown={noop} onOpen={noop} onPrimary={noop} onInvite={noop} />);
    expect(screen.getByText("At home")).toBeTruthy();
    expect(screen.getByText("Your first step: Draw what is on your desk for ten minutes.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });

  it("is Ask to join for an open Pursuit and says Requested once asked", () => {
    const { rerender } = wrap(<BestFitCard item={pursuit} state="idle" onShown={noop} onOpen={noop} onPrimary={noop} onInvite={noop} />);
    expect(screen.getByRole("button", { name: "Ask to join" })).toBeTruthy();
    rerender(
      <MemoryRouter>
        <BestFitCard item={pursuit} state="requested" onShown={noop} onOpen={noop} onPrimary={noop} onInvite={noop} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Requested")).toBeTruthy();
  });

  it("calls the action handlers and stops taking taps once done", () => {
    const onPrimary = vi.fn();
    const onInvite = vi.fn();
    const { rerender } = wrap(<BestFitCard item={event} state="idle" onShown={noop} onOpen={noop} onPrimary={onPrimary} onInvite={onInvite} />);
    fireEvent.click(screen.getByRole("button", { name: "I’m going" }));
    fireEvent.click(screen.getByRole("button", { name: "Invite a friend" }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onInvite).toHaveBeenCalledTimes(1);
    rerender(
      <MemoryRouter>
        <BestFitCard item={event} state="done" onShown={noop} onOpen={noop} onPrimary={onPrimary} onInvite={onInvite} />
      </MemoryRouter>,
    );
    const done = screen.getAllByRole("button").find((b) => b.hasAttribute("disabled"));
    expect(done).toBeTruthy();
  });

  it("leaves out the why line when no reason has approved wording", () => {
    wrap(<BestFitCard item={{ ...event, why: null }} state="idle" onShown={noop} onOpen={noop} onPrimary={noop} onInvite={noop} />);
    expect(screen.queryByText(/Fits your/)).toBeNull();
  });
});

describe("More ways list", () => {
  it("lists each row with its time, why line and one action, and links to See all", () => {
    wrap(<MoreWaysList items={[event, atHome]} firstPosition={1} states={{}} onShown={noop} onOpen={noop} onPrimary={noop} />);
    expect(screen.getByRole("heading", { name: "More ways this week" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "See all" }).getAttribute("href")).toBe("/discover");
    expect(screen.getByText("At home · about 30 min")).toBeTruthy();
    expect(screen.getByRole("button", { name: "I’m going" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });

  it("reports the position of the row that is tapped", () => {
    const onPrimary = vi.fn();
    wrap(<MoreWaysList items={[event, atHome]} firstPosition={1} states={{}} onShown={noop} onOpen={noop} onPrimary={onPrimary} />);
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(onPrimary).toHaveBeenCalledWith(atHome, 2);
  });

  it("shows nothing for an empty list", () => {
    const { container } = wrap(<MoreWaysList items={[]} firstPosition={1} states={{}} onShown={noop} onOpen={noop} onPrimary={noop} />);
    expect(container.textContent).toBe("");
  });
});

describe("Your week card", () => {
  const left: WeekWindow[] = [
    { key: "thu-eve", day: "thu", slot: "eve", offset: 0, startMs: NOW, endMs: NOW + 3_600_000 },
    { key: "fri-eve", day: "fri", slot: "eve", offset: 1, startMs: NOW, endMs: NOW + 3_600_000 },
  ];

  it("shows the count line and the next days, and opens the calendar's Week view", () => {
    wrap(<YourWeekCard windows={["thu-eve", "fri-eve"]} left={left} plans={[{ title: "Bouldering night", startsAt: Date.parse("2026-11-06T00:00:00Z") }]} now={NOW} />);
    expect(screen.getByText("2 free windows left · 1 plan")).toBeTruthy();
    expect(screen.getByText("Bouldering night 7 PM")).toBeTruthy();
    expect(screen.getByText("Free evening")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/calendar?view=week");
  });

  it("asks for free time when none is saved, and opens the screen that saves it", () => {
    wrap(<YourWeekCard windows={[]} left={[]} plans={[]} now={NOW} />);
    expect(screen.getByText(ADD_FREE_TIME_COPY)).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/week/free");
  });
});
