// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LandingMotionProvider, useLandingMotion } from "./LandingMotion";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("follows device preference changes during a visit and removes its listener", () => {
  let matches = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({
    get matches() { return matches; },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  }));
  function Probe() {
    const { enabled } = useLandingMotion();
    return <output>{enabled ? "on" : "off"}</output>;
  }
  const { unmount } = render(<LandingMotionProvider><Probe/></LandingMotionProvider>);
  expect(screen.getByRole("status").textContent).toBe("on");
  act(() => { matches = true; listeners.forEach(listener => listener()); });
  expect(screen.getByRole("status").textContent).toBe("off");
  act(() => { matches = false; listeners.forEach(listener => listener()); });
  expect(screen.getByRole("status").textContent).toBe("on");
  unmount();
  expect(listeners.size).toBe(0);
});
