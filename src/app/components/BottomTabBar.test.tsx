// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../lib/useIncomingFollowRequests", () => ({ useIncomingFollowRequests: () => [] }));

import { BottomTabBar, TABS } from "./BottomTabBar";

afterEach(cleanup);

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomTabBar />
    </MemoryRouter>,
  );

describe("bottom tab bar", () => {
  it("reads Home, Discover, Log, Week, You, in that order", () => {
    expect(TABS.map((t) => t.label)).toEqual(["Home", "Discover", "Log", "Week", "You"]);
    at("/my-space");
    const nav = screen.getByRole("navigation", { name: "Main" });
    const names = within(nav).getAllByRole("link").map((a) => a.getAttribute("aria-label") ?? a.textContent);
    expect(names).toEqual(["Home", "Discover", "Log a Moment", "Week", "You"]);
    expect(within(nav).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/my-space", "/discover", "/create", "/week", "/you"]);
  });

  it("marks the tab for the page you are on", () => {
    at("/week");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByText("Week").closest("a")?.getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByText("Home").closest("a")?.getAttribute("aria-current")).toBeNull();
  });

  it("keeps Week active on the free time screen", () => {
    at("/week/free");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByText("Week").closest("a")?.getAttribute("aria-current")).toBe("page");
  });

  it("gives every tab an icon", () => {
    at("/my-space");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.querySelectorAll("a svg").length).toBe(5);
  });
});
