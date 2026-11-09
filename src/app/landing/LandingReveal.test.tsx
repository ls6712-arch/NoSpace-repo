// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LandingMotionProvider } from "./LandingMotion";
import { CornerTicker, HookLine, SplitWord, StepNumber } from "./LandingReveal";

const setReduced = (reduced: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: reduced && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null })) as typeof window.matchMedia;
};

describe("landing motion", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("keeps the wordmark and hook as plain readable text while animating", () => {
    setReduced(false);
    render(<LandingMotionProvider><h1><SplitWord className="lp-wordmark" text="Soosh"/><HookLine index={0}>Do the thing. </HookLine><HookLine index={1} last>Keep the Stub.</HookLine></h1></LandingMotionProvider>);
    expect(screen.getByRole("heading").textContent).toBe("SooshDo the thing. Keep the Stub.");
    expect(document.querySelectorAll(".lp-split-char")).toHaveLength(5);
  });

  it("shows every step number and leaves letters whole when motion is reduced", () => {
    setReduced(true);
    render(<LandingMotionProvider><SplitWord text="Soosh"/><StepNumber n={3}/></LandingMotionProvider>);
    expect(document.querySelectorAll(".lp-split-char")).toHaveLength(0);
    expect(screen.getByLabelText("3")).toBeTruthy();
  });

  it("hides the Corner ticker from screen readers and repeats it for a seamless loop", () => {
    setReduced(false);
    render(<LandingMotionProvider><CornerTicker names={["Karaoke", "Surfing"]}/></LandingMotionProvider>);
    const ticker = document.querySelector(".lp-ticker")!;
    expect(ticker.getAttribute("aria-hidden")).toBe("true");
    expect(ticker.querySelectorAll(".lp-ticker-item")).toHaveLength(4);
  });
});
