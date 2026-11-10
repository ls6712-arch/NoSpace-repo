// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("../lib/useSlowNavigation", () => ({ useSlowNavigation: () => false }));
const prefetch = vi.hoisted(() => vi.fn(() => () => {}));
vi.mock("../lib/prefetchTabs", () => ({ prefetchMainTabs: prefetch }));
vi.mock("../config", () => ({ sooshOnboardingEnabled: true }));
vi.mock("../components/Header", () => ({ Header: ({ hideWithRail }: { hideWithRail?: boolean }) => <header data-testid="header" data-hide-with-rail={String(!!hideWithRail)} /> }));
vi.mock("../components/nav/SideRail", () => ({ SideRail: () => <nav data-testid="rail" /> }));
vi.mock("../components/nav/SkipLink", () => ({ SkipLink: () => <a data-testid="skip" href="#main-content" /> }));
vi.mock("../components/CartDrawer", () => ({ CartDrawer: () => null }));
vi.mock("../components/WorldBackdrop", () => ({ WorldBackdrop: () => null }));
vi.mock("../components/BadgeUnlockToast", () => ({ BadgeUnlockToast: () => null }));
vi.mock("../components/AccountPrompts", () => ({ AccountPrompts: () => null }));
vi.mock("../components/BottomTabBar", () => ({ BottomTabBar: ({ railEligible }: { railEligible?: boolean }) => <nav data-testid="tabbar" data-rail-eligible={String(!!railEligible)} /> }));
vi.mock("../components/PreviewBanner", () => ({ PreviewBanner: () => null }));
vi.mock("../components/stubby/SignUpReturnEffect", () => ({ SignUpReturnEffect: () => null }));
vi.mock("../components/NetworkBanner", () => ({ NetworkBanner: () => null }));
vi.mock("../components/AccountStatusBanner", () => ({ AccountStatusBanner: () => null }));
vi.mock("../lib/truncation", () => ({ useTruncationReveal: () => undefined }));
vi.mock("../lib/useScrollMemory", () => ({ useScrollMemory: () => undefined }));
vi.mock("../lib/bookmarksRemote", () => ({ reconcileSaves: () => Promise.resolve() }));

import { Root } from "./Root";

const signedIn = (profile: Record<string, unknown> | null) => {
  auth.value = { user: { id: "u1" }, profile, loading: false, isConfigured: true };
};
const tabRoot = { kind: "tab" } as const;
const at = (path: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            element: <Root />,
            children: [
              { path: "/", element: <p>Home</p>, handle: tabRoot },
              { path: "/discover", element: <p>Discover</p>, handle: { kind: "tab", tab: "discover" } },
              { path: "/onboarding", element: <p>Onboarding</p>, handle: { kind: "flow", parent: () => "/my-space" } },
              { path: "/welcome", element: <p>Welcome</p>, handle: tabRoot },
              { path: "/corners", element: <p>Corners</p>, handle: { kind: "page", tab: "discover", parent: () => "/discover" } },
              { path: "/search", element: <p>Search</p>, handle: { kind: "page", parent: () => "/discover" } },
            ],
          },
        ],
        { initialEntries: [path] },
      )}
    />,
  );

afterEach(() => {
  cleanup();
  prefetch.mockClear();
});

describe("Root and onboarding", () => {
  it("fetches the main tab pages for a signed-in person, not for a visitor", () => {
    signedIn({ onboarding_completed: true, access: "active" });
    at("/");
    expect(prefetch).toHaveBeenCalledTimes(1);
    cleanup();
    prefetch.mockClear();
    auth.value = { user: null, profile: null, loading: false, isConfigured: true };
    at("/");
    expect(prefetch).not.toHaveBeenCalled();
  });

  it("never sends a finished person back into onboarding", () => {
    signedIn({ onboarding_completed: true, access: "active" });
    at("/");
    expect(screen.getByText("Home")).toBeTruthy();
    cleanup();
    at("/discover");
    expect(screen.getByText("Discover")).toBeTruthy();
    expect(screen.queryByText("Onboarding")).toBeNull();
  });

  it("sends someone who has not finished to onboarding, with where they were going", () => {
    signedIn({ onboarding_completed: false, access: "active" });
    at("/discover");
    expect(screen.getByText("Onboarding")).toBeTruthy();
  });

  it("does not send them in a loop once they are on it", () => {
    signedIn({ onboarding_completed: false, access: "active" });
    at("/onboarding");
    expect(screen.getByText("Onboarding")).toBeTruthy();
  });
});

describe("the left rail", () => {
  it("is offered to a signed-in person on an app page, with the skip link, and the header and bottom bar step aside from 744px", () => {
    signedIn({ onboarding_completed: true, access: "active" });
    at("/discover");
    expect(screen.getByTestId("rail")).toBeTruthy();
    expect(screen.getByTestId("skip")).toBeTruthy();
    expect(screen.getByTestId("header").getAttribute("data-hide-with-rail")).toBe("true");
    expect(screen.getByTestId("tabbar").getAttribute("data-rail-eligible")).toBe("true");
    const main = document.querySelector("main")!;
    expect(main.id).toBe("main-content");
    expect(main.className).toContain("rail:pl-[72px]");
    expect(main.className).toContain("railwide:pl-[240px]");
  });

  it("lets a signed-out visitor see Discover instead of sending them to the landing page", () => {
    auth.value = { user: null, profile: null, loading: false, isConfigured: true };
    at("/discover");
    expect(screen.getByText("Discover")).toBeTruthy();
  });

  it("is not offered to a signed-out visitor, who keeps the top header and the bottom bar as before", () => {
    auth.value = { user: null, profile: null, loading: false, isConfigured: true };
    at("/corners");
    expect(screen.queryByTestId("rail")).toBeNull();
    expect(screen.getByTestId("header").getAttribute("data-hide-with-rail")).toBe("false");
    expect(screen.getByTestId("tabbar").getAttribute("data-rail-eligible")).toBe("false");
  });

  it("is not offered on the invite arrival and the door screen, which keep the top header", () => {
    signedIn({ onboarding_completed: true, access: "active" });
    at("/welcome");
    expect(screen.queryByTestId("rail")).toBeNull();
    expect(screen.getByTestId("header").getAttribute("data-hide-with-rail")).toBe("false");
  });

  it("is not on onboarding, which hides all navigation", () => {
    signedIn({ onboarding_completed: false, access: "active" });
    at("/onboarding");
    expect(screen.queryByTestId("rail")).toBeNull();
    expect(screen.queryByTestId("header")).toBeNull();
  });
});

describe("the back chevron", () => {
  it("is drawn by the shell on a pushed page, with no text", () => {
    signedIn({ onboarding_completed: true, access: "active" });
    at("/search");
    const back = screen.getByRole("button", { name: "Back" });
    expect(back.textContent).toBe("");
    expect(back.querySelector("svg")).not.toBeNull();
    expect(back.className).toContain("size-11");
  });

  it("is not drawn on a tab root or a flow", () => {
    signedIn({ onboarding_completed: true, access: "active" });
    for (const path of ["/discover", "/onboarding"]) {
      at(path);
      expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
      cleanup();
    }
  });

  it("is drawn for a signed-out visitor on a Corners page too", () => {
    auth.value = { user: null, profile: null, loading: false, isConfigured: true };
    at("/corners");
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });
});

describe("Stubby", () => {
  it("never floats over a page: no dock and no Stubby on any route that used to have one", () => {
    signedIn({ onboarding_completed: true, access: "active" });
    for (const path of ["/", "/discover", "/corners"]) {
      at(path);
      expect(document.querySelector("[data-stubby-dock]")).toBeNull();
      expect(document.querySelector("[data-stubby-state]")).toBeNull();
      expect(screen.queryByRole("button", { name: "Ask Stubby" })).toBeNull();
      cleanup();
    }
  });
});
