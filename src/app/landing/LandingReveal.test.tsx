// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LandingMotionProvider } from "./LandingMotion";
import { HookLine, SplitWord, StepNumber } from "./LandingReveal";
import { MaxxingRibbon } from "./ribbon/MaxxingRibbon";
import { LANDING_COPY } from "./copy";

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

  it("shows the maxxing words as a flat band, hidden from screen readers, without WebGL2", () => {
    setReduced(false);
    render(<LandingMotionProvider><MaxxingRibbon/></LandingMotionProvider>);
    const ribbon = document.querySelector(".lp-ribbon")!;
    expect(ribbon.getAttribute("aria-hidden")).toBe("true");
    expect(ribbon.textContent).toBe(LANDING_COPY.maxxing.join(" · "));
    expect(LANDING_COPY.maxxing[0]).toBe("Sooshmaxxing");
  });
});
