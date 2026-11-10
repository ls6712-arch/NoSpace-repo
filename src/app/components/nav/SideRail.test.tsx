// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chats = vi.hoisted(() => ({ n: 0 }));
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" }, profile: { display_name: "Mia Chen", avatar_url: null }, signOut: vi.fn() }),
}));
vi.mock("../../context/CategoriesContext", () => ({ useCategories: () => ({ isAdmin: false }) }));
vi.mock("../../context/ThemeContext", () => ({ useTheme: () => ({ preference: "system", setPreference: vi.fn() }) }));
vi.mock("./useChatsBadge", () => ({ useChatsBadge: () => chats.n }));
vi.mock("./GlobalSearchBox", () => ({ GlobalSearchBox: () => <input aria-label="Search Moments, people, Spaces" /> }));
vi.mock("../NotificationsMenu", () => ({
  NotificationsMenu: ({ open, onOpenChange }: { open?: boolean; onOpenChange?: (o: boolean) => void }) => (
    <button type="button" aria-label="Notifications (3 unread)" aria-expanded={open} onClick={() => onOpenChange?.(!open)}>
      Notifications
    </button>
  ),
}));

import { SideRail } from "./SideRail";
import { RouterAt } from "../../lib/testRoutes";
import { SkipLink } from "./SkipLink";

beforeEach(() => {
  chats.n = 0;
});
afterEach(cleanup);

const at = (path: string) =>
  render(<RouterAt path={path} element={<SideRail />} />);

describe("the left rail", () => {
  it("lists every destination in order, with the same labels as the bottom bar", () => {
    at("/my-space");
    const nav = screen.getByRole("navigation", { name: "Main" });
    const names = within(nav)
      .getAllByRole("link")
      .map((a) => a.getAttribute("aria-label"));
    expect(names).toEqual(["Soosh", "Home", "Discover", "Log a Moment", "Stubby", "Chats", "You"]);
    expect(within(nav).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/my-space", "/my-space", "/discover", "/create", "/calendar", "/messages", "/you"]);
    // The things that open something are buttons.
    expect(within(nav).getByRole("button", { name: "Search" })).toBeTruthy();
    expect(within(nav).getByRole("button", { name: "Notifications (3 unread)" })).toBeTruthy();
    expect(within(nav).getByRole("button", { name: "More" })).toBeTruthy();
  });

  it("puts words on every item for the 1280px layout and a tooltip for the icon-only one", () => {
    at("/my-space");
    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const word of ["Home", "Discover", "Search", "Log", "Stubby", "Chats", "You", "More"]) {
      // One copy as the visible label (wide), one as the tooltip (narrower).
      expect(within(nav).getAllByText(word).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("marks the item for the page you are on, including the free time screen and Chats", () => {
    const current = () => {
      const nav = screen.getByRole("navigation", { name: "Main" });
      return within(nav)
        .getAllByRole("link")
        .filter((a) => a.getAttribute("aria-current") === "page")
        .map((a) => a.getAttribute("aria-label"));
    };
    at("/my-space");
    expect(current()).toEqual(["Home"]);
    cleanup();
    at("/week/free");
    expect(current()).toEqual(["Stubby"]);
    cleanup();
    at("/corners/pottery");
    expect(current()).toEqual(["Discover"]);
    cleanup();
    at("/create");
    expect(current()).toEqual(["Log a Moment"]);
  });

  it("shows the unread number on Chats, and keeps it for the accessible name", () => {
    chats.n = 4;
    at("/my-space");
    const link = screen.getByRole("link", { name: "Chats (4 unread)" });
    expect(link.textContent).toContain("4");
  });

  it("opens More as the account menu: Settings, Theme and Log out", () => {
    at("/my-space");
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("href")).toBe("/settings");
    expect(screen.getByText("Theme")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
    // You is the avatar on the rail, so the menu does not repeat it.
    expect(screen.queryAllByRole("link", { name: "You" })).toHaveLength(1);
  });

  it("opens Search beside the rail and closes it with Escape; only one panel is open", () => {
    at("/my-space");
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(screen.getByRole("textbox", { name: "Search Moments, people, Spaces" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Log out" })).toBeNull();
  });

  it("only exists from 744px: it is hidden by default and shown on the rail breakpoint", () => {
    at("/my-space");
    const nav = screen.getByRole("navigation", { name: "Main", hidden: true });
    expect(nav.className).toContain("hidden");
    expect(nav.className).toContain("rail:flex");
    expect(nav.className).toContain("w-[72px]");
    expect(nav.className).toContain("wide:w-[240px]");
  });
});

describe("the skip link", () => {
  it("is first, says what it does, and moves focus to the page instead of changing the route", () => {
    document.body.innerHTML = '<div id="root"></div>';
    const main = document.createElement("main");
    main.id = "main-content";
    main.tabIndex = -1;
    document.body.appendChild(main);
    render(<SkipLink />, { container: document.getElementById("root")! });
    const link = screen.getByText("Skip to content", { selector: "a" });
    fireEvent.click(link);
    expect(document.activeElement).toBe(main);
    expect(link.className).toContain("rail:block");
  });
});

describe("the rail item for /calendar is Stubby: his mark and his name", () => {
  const calendarLink = () => within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: "Stubby" });

  it("draws the Stubby mark (eyes only), decorative, in place of the calendar icon, named Stubby", () => {
    at("/my-space");
    const link = calendarLink();
    const icon = link.querySelector("[data-stubby-nav-icon]") as HTMLElement;
    expect(icon).not.toBeNull();
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.classList.contains("stubby-nav-icon")).toBe(true);
    const svg = icon.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 240 150");
    expect(svg.getAttribute("width")).toBe("22");
    // The mark: two eyes, no brows, mouth, stamp slot or "Admit one".
    expect(svg.querySelectorAll("rect[rx='8']")).toHaveLength(2);
    expect(svg.querySelector("text")).toBeNull();
    expect(link.querySelector(".lucide-calendar-days, .lucide-calendar")).toBeNull();
    expect(link.getAttribute("aria-label")).toBe("Stubby");
    expect(within(link).getAllByText("Stubby").length).toBeGreaterThanOrEqual(1);
  });

  it("is inactive off Calendar and active on it (and on the free time screen)", () => {
    at("/my-space");
    expect(calendarLink().getAttribute("aria-current")).toBeNull();
    expect(calendarLink().className).toContain("text-foreground");
    cleanup();
    at("/calendar");
    expect(calendarLink().getAttribute("aria-current")).toBe("page");
    expect(calendarLink().className).toContain("text-accent-text");
    expect(calendarLink().querySelector("[data-stubby-nav-icon]")).not.toBeNull();
    cleanup();
    at("/week/free");
    expect(calendarLink().getAttribute("aria-current")).toBe("page");
  });

  it("theme.css: an outline in the rail's colour off its page, the full coral mark on it", async () => {
    const fs = await import("node:fs");
    const css = fs.readFileSync(`${process.cwd()}/src/styles/theme.css`, "utf8");
    const rule = (selector: string) => {
      const at = css.indexOf(`${selector} {`);
      expect(at, selector).toBeGreaterThanOrEqual(0);
      return css.slice(at, css.indexOf("}", at));
    };
    const off = rule(".stubby-nav-icon");
    expect(off).toContain("--stubby-body: transparent");
    expect(off).toContain("--stubby-tab: transparent");
    expect(off).toContain("--stubby-ink: currentColor");
    const on = rule('[aria-current="page"] .stubby-nav-icon');
    for (const v of ["--stubby-body: inherit", "--stubby-tab: inherit", "--stubby-ink: inherit"]) expect(on).toContain(v);
  });

  it("shares the Stubby destination with the phone bar", async () => {
    const { TAB_DESTINATIONS, CALENDAR } = await import("./navItems");
    expect(TAB_DESTINATIONS.map((d) => d.label)).toEqual(["Home", "Discover", "Log", "Stubby", "You"]);
    expect(TAB_DESTINATIONS).toContain(CALENDAR);
  });
});
