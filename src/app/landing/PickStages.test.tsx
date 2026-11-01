// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoStage, HeroStage } from "./PickStages";
import { LANDING_COPY as COPY } from "./copy";

// Reduced motion keeps Stubby still, so these tests are about the tickets.
vi.mock("motion/react", () => ({ useReducedMotion: () => true }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const T = COPY.ticket;

describe("hero ticket", () => {
  it("says yes, shows the stamp, hides the other buttons, and undoes", () => {
    render(<HeroStage />);
    const first = COPY.heroPicks[0];
    expect(screen.getByRole("button", { name: T.going }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: T.going }));
    expect(screen.getByRole("button", { name: T.gone }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByText(T.stamp).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: T.nah })).toBeNull();
    expect(screen.queryByRole("button", { name: T.plus })).toBeNull();
    expect(screen.getByText(T.yesSolo)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: T.undo }));
    expect(screen.getByRole("button", { name: T.going })).toBeTruthy();
    expect(screen.getByText(first.caption)).toBeTruthy();
  });

  it("Nah moves to the next of three picks and loops", () => {
    render(<HeroStage />);
    const [a, b, c] = COPY.heroPicks;
    fireEvent.click(screen.getByRole("button", { name: T.nah }));
    expect(screen.getByText(b.title)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: T.nah }));
    expect(screen.getByText(c.title)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: T.nah }));
    expect(screen.getByText(a.title)).toBeTruthy();
  });

  it("Bring someone toggles Admit one and Admit two", () => {
    render(<HeroStage />);
    // Stubby's own tab also says "Admit one", so look at the ticket's stub.
    const stub = () => document.querySelector(".lp-t-stub")?.textContent ?? "";
    expect(stub()).toContain(T.admitOne);
    fireEvent.click(screen.getByRole("button", { name: T.plus }));
    expect(stub()).toContain(T.admitTwo);
    expect(screen.getByRole("button", { name: T.plusOn }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: T.plusOn }));
    expect(stub()).toContain(T.admitOne);
  });

  it("keeps the caption in an aria-live polite region", () => {
    render(<HeroStage />);
    expect(screen.getByText(COPY.heroPicks[0].caption).getAttribute("aria-live")).toBe("polite");
  });
});

describe("demo ticket", () => {
  it("changes the pick with the answers, and Bring someone switches Who", () => {
    render(<DemoStage />);
    expect(screen.getByText("Jazz at the bar")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Saturday" }));
    expect(screen.getByText("Bouldering session")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: T.plus }));
    expect(screen.getByRole("button", { name: "A friend" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Wheel-throwing taster")).toBeTruthy();
    expect(document.querySelector(".lp-t-stub")?.textContent).toContain(T.admitTwo);
  });

  it("Nah tells you to change an answer above", () => {
    render(<DemoStage />);
    fireEvent.click(screen.getByRole("button", { name: T.nah }));
    expect(screen.getByText(T.demoNah)).toBeTruthy();
  });

  it("every combination of answers has a pick", () => {
    for (const when of ["tonight", "sat"]) for (const b of ["free", "25"]) for (const who of ["solo", "friend"]) {
      expect((COPY.demoPicks as Record<string, unknown>)[`${when}|${b}|${who}`]).toBeTruthy();
    }
  });
});
