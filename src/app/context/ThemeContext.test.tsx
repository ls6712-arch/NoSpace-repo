// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ profile: null as { theme_preference: string } | null }));
vi.mock("./AuthContext", () => ({ useAuth: () => ({ profile: auth.profile, updateProfile: vi.fn() }) }));

import { ThemeProvider } from "./ThemeContext";

const KEY = "soosh-theme-preference";

function osIsDark(dark: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: dark && q.includes("prefers-color-scheme: dark"),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

const isDark = () => document.documentElement.classList.contains("dark");
const mount = () => render(<ThemeProvider>{null}</ThemeProvider>);

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  auth.profile = null;
});
afterEach(cleanup);

describe("theme preference", () => {
  it("is light when nothing is stored, even on a dark device", () => {
    osIsDark(true);
    mount();
    expect(isDark()).toBe(false);
  });

  it("is dark only when Dark is picked", () => {
    osIsDark(false);
    localStorage.setItem(KEY, "dark");
    mount();
    expect(isDark()).toBe(true);
  });

  it("follows the device when System was picked", () => {
    localStorage.setItem(KEY, "system");
    osIsDark(true);
    mount();
    expect(isDark()).toBe(true);
    cleanup();
    document.documentElement.classList.remove("dark");
    osIsDark(false);
    mount();
    expect(isDark()).toBe(false);
  });

  it("ignores the server's default System, so a fresh account is light on a dark device", () => {
    osIsDark(true);
    auth.profile = { theme_preference: "system" };
    mount();
    expect(isDark()).toBe(false);
  });

  it("takes an explicit Dark from the server", () => {
    osIsDark(false);
    auth.profile = { theme_preference: "dark" };
    mount();
    expect(isDark()).toBe(true);
  });
});
