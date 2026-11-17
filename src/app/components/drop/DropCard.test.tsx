// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DropCard } from "./DropCard";
import type { Drop } from "../../lib/drops";

afterEach(cleanup);

const NOW = Date.parse("2026-11-25T15:00:00Z");
const drop: Drop = {
  id: 7,
  slug: "make-one-give-one",
  title: "Make one, give one",
  blurb: "Make one small gift by hand, with one other person.",
  cornerKey: "crafts-making/paper-crafts",
  targetMoments: 1,
  opensAt: Date.parse("2026-11-25T00:00:00Z"),
  closesAt: Date.parse("2026-12-07T04:59:00Z"),
  maxEditions: null,
  palette: ["#ff7ab6", "#ffd36e"],
  peopleIn: 12,
  finished: 4,
};
const show = (props: Partial<Parameters<typeof DropCard>[0]> = {}) =>
  render(
    <MemoryRouter>
      <DropCard drop={drop} mine={null} joining={false} onJoin={async () => ({ pursuitId: "p1", error: null })} now={NOW} {...props} />
    </MemoryRouter>,
  );

describe("DropCard", () => {
  it("shows the drop, when it closes and the real counts", () => {
    show();
    expect(screen.getByRole("heading", { name: "Make one, give one" })).toBeTruthy();
    expect(screen.getByText("Closes Sun, Dec 6, 11:59 PM · 12 people in · 4 Stubs kept")).toBeTruthy();
  });

  it("offers I’m in before you join, and joins on tap", async () => {
    const onJoin = vi.fn(async () => ({ pursuitId: "p1", error: null }));
    show({ onJoin });
    fireEvent.click(screen.getByRole("button", { name: "I’m in" }));
    await waitFor(() => expect(onJoin).toHaveBeenCalledTimes(1));
  });

  it("offers Log a Moment once you are in", () => {
    show({ mine: { pursuitId: "p1", edition: null, stubId: null } });
    expect(screen.getByRole("button", { name: "Log a Moment" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "I’m in" })).toBeNull();
  });

  it("shows your number and Bring someone once you have finished", () => {
    show({ mine: { pursuitId: "p1", edition: 3, stubId: 9 } });
    expect(screen.getByText("You’re No. 003")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bring someone" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Log a Moment" })).toBeNull();
  });

  it("leaves the counts out when they cannot be read", () => {
    show({ drop: { ...drop, peopleIn: null, finished: null } });
    expect(screen.getByText("Closes Sun, Dec 6, 11:59 PM")).toBeTruthy();
  });
});
