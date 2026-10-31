// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("../config", () => ({ sooshOnboardingEnabled: true }));
vi.mock("../components/Header", () => ({ Header: ({ hideWithRail }: { hideWithRail?: boolean }) => <header data-testid="header" data-hide-with-rail={String(!!hideWithRail)} /> }));
vi.mock("../components/nav/SideRail", () => ({ SideRail: () => <nav data-testid="rail" /> }));
vi.mock("../components/nav/SkipLink", () => ({ SkipLink: () => <a data-testid="skip" href="#main-content" /> }));
vi.mock("../components/CartDrawer", () => ({ CartDrawer: () => null }));
vi.mock("../components/BadgeUnlockToast", () => ({ BadgeUnlockToast: () => null }));
vi.mock("../components/AccountPrompts", () => ({ AccountPrompts: () => null }));
vi.mock("../components/BottomTabBar", () => ({ BottomTabBar: ({ railEligible }: { railEligible?: boolean }) => <nav data-testid="tabbar" data-rail-eligible={String(!!railEligible)} /> }));
vi.mock("../components/PreviewBanner", () => ({ PreviewBanner: () => null }));
vi.mock("../components/NetworkBanner", () => ({ NetworkBanner: () => null }));
vi.mock("../components/AccountStatusBanner", () => ({ AccountStatusBanner: () => null }));
vi.mock("../lib/truncation", () => ({ useTruncationReveal: () => undefined }));
vi.mock("../lib/useScrollMemory", () => ({ useScrollMemory: () => undefined }));
vi.mock("../lib/bookmarksRemote", () => ({ reconcileSaves: () => Promise.resolve() }));

import { Root } from "./Root";

const signedIn = (profile: Record<string, unknown> | null) => {
  auth.value = { user: { id: "u1" }, profile, loading: false, isConfigured: true };
};
const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Root />}>
          <Route path="/" element={<p>Home</p>} />
          <Route path="/discover" element={<p>Discover</p>} />
          <Route path="/onboarding" element={<p>Onboarding</p>} />
          <Route path="/welcome" element={<p>Welcome</p>} />
          <Route path="/corners" element={<p>Corners</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

afterEach(cleanup);

describe("Root and onboarding", () => {
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
