// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../lib/useIncomingFollowRequests", () => ({ useIncomingFollowRequests: () => [] }));

import { BottomTabBar, TABS } from "./BottomTabBar";
import { RouterAt } from "../lib/testRoutes";

afterEach(cleanup);

const at = (path: string) =>
  render(<RouterAt path={path} element={<BottomTabBar />} />);

describe("bottom tab bar", () => {
  it("reads Home, Discover, Log, Stubby, You, in that order", () => {
    expect(TABS.map((t) => t.label)).toEqual(["Home", "Discover", "Log", "Stubby", "You"]);
    at("/my-space");
    const nav = screen.getByRole("navigation", { name: "Main" });
    const names = within(nav).getAllByRole("link").map((a) => a.getAttribute("aria-label") ?? a.textContent);
    expect(names).toEqual(["Home", "Discover", "Log a Moment", "Stubby", "You"]);
    expect(within(nav).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/my-space", "/discover", "/create", "/calendar", "/you"]);
  });

  it("marks the tab for the page you are on", () => {
    at("/discover");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByText("Discover").closest("a")?.getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByText("Home").closest("a")?.getAttribute("aria-current")).toBeNull();
  });

  it.each(["/calendar", "/week/free"])("marks Stubby active on %s", (path) => {
    at(path);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const stubby = within(nav).getByRole("link", { name: "Stubby" });
    expect(stubby.getAttribute("href")).toBe("/calendar");
    expect(stubby.getAttribute("aria-current")).toBe("page");
    expect(stubby.querySelector("[data-stubby-nav-icon]")).not.toBeNull();
    expect(within(nav).getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page")).toEqual([stubby]);
  });

  it("gives every tab an icon", () => {
    at("/my-space");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.querySelectorAll("a svg").length).toBe(5);
  });
});
