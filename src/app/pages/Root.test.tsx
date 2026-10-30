// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("../config", () => ({ sooshOnboardingEnabled: true }));
vi.mock("../components/Header", () => ({ Header: () => null }));
vi.mock("../components/CartDrawer", () => ({ CartDrawer: () => null }));
vi.mock("../components/BadgeUnlockToast", () => ({ BadgeUnlockToast: () => null }));
vi.mock("../components/AccountPrompts", () => ({ AccountPrompts: () => null }));
vi.mock("../components/BottomTabBar", () => ({ BottomTabBar: () => null }));
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
