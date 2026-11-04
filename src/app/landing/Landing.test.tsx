// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Landing } from "./Landing";
import { LANDING_COPY as COPY } from "./copy";
import { ACTIVITY_EXAMPLES, exampleFromEntry } from "./examples";
import { startContent } from "../lib/startContent";

vi.mock("motion/react", () => ({ useReducedMotion: () => true }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("landing page", () => {
  it("has no in-page #links: the app uses hash routing, so they would be read as routes", () => {
    const { container } = render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('a[href^="#"]')).toHaveLength(0);
    expect(container.querySelector("main")).toBeNull();
  });

  it("scrolls to How it works when the hero button is pressed", () => {
    const scrollIntoView = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoView;
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: COPY.heroSecondary })[0]);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("how"));
    expect(document.activeElement).toBe(document.getElementById("how-heading"));
    expect(scrollIntoView).toHaveBeenCalledWith({behavior:"auto",block:"start"});
  });

  it("opens existing-account login explicitly and keeps legal links", () => {
    render(<MemoryRouter><Landing/></MemoryRouter>);
    expect(screen.getByRole("link",{name:"Log in"}).getAttribute("href")).toBe("/login?mode=signin");
    expect(screen.getByRole("link",{name:"Terms"}).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link",{name:"Privacy Policy"}).getAttribute("href")).toBe("/privacy-policy");
  });

  it("switches the example and keeps cycling within the chosen setting", () => {
    render(<MemoryRouter><Landing/></MemoryRouter>);
    const preview=within(screen.getByRole("group",{name:COPY.exampleLabel}));
    fireEvent.click(preview.getByRole("button",{name:COPY.outside}));
    expect(preview.getByRole("heading",{name:"Take a photo walk"})).toBeTruthy();
    expect(preview.getByRole("button",{name:COPY.outside}).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(preview.getByRole("button",{name:COPY.another}));
    expect(preview.getByRole("heading",{name:"Listen for birds"})).toBeTruthy();
    fireEvent.click(preview.getByRole("button",{name:COPY.another}));
    expect(preview.getByRole("heading",{name:"Take a photo walk"})).toBeTruthy();
    expect(preview.getByRole("status").textContent).toContain("Take a photo walk");
  });

  it("opens the chosen card's real details and moves keyboard focus to the preview", () => {
    render(<MemoryRouter><Landing/></MemoryRouter>);
    fireEvent.click(screen.getByRole("button",{name:/Music Play a song you know/}));
    const preview=screen.getByRole("group",{name:COPY.exampleLabel});
    expect(preview.querySelector("details")?.open).toBe(true);
    expect(document.activeElement).toBe(within(preview).getByRole("heading",{name:"Play a song you know"}));
    expect(preview.textContent).toContain("Acoustic guitar");
    expect(preview.textContent).toContain("Electric guitar");
    expect(preview.textContent).toContain(COPY.alternatives);
    expect(preview.textContent).toContain(COPY.costUnknown);
    expect(preview.textContent).not.toContain("Free");
    // Optional equipment is outside the required alternative bundles.
    expect(preview.querySelector(".lp-bundles")?.textContent).not.toContain("Music stand");
    expect(preview.querySelector(".lp-bundles")?.textContent).not.toContain("Amplifier");
    expect(within(preview).getByRole("heading",{name:COPY.optional})).toBeTruthy();
    fireEvent.click(within(preview).getByRole("button",{name:COPY.another}));
    expect(preview.querySelector("details")?.open).toBe(false);
  });

  it("does not write preferences, create accounts or fetch results while someone tries examples", () => {
    const fetch=vi.fn();vi.stubGlobal("fetch",fetch);
    const local=vi.spyOn(Storage.prototype,"setItem");
    render(<MemoryRouter><Landing/></MemoryRouter>);
    const preview=within(screen.getByRole("group",{name:COPY.exampleLabel}));
    fireEvent.click(preview.getByRole("button",{name:COPY.outside}));
    fireEvent.click(preview.getByRole("button",{name:COPY.another}));
    fireEvent.click(preview.getByText(COPY.details,{selector:"summary"}));
    expect(fetch).not.toHaveBeenCalled();
    expect(local).not.toHaveBeenCalled();
    expect(screen.queryByRole("button",{name:"I’m going"})).toBeNull();
    expect(screen.queryByText(/It’s on your Home/)).toBeNull();
  });

  it("does not advertise the disabled preference flow", () => {
    render(<MemoryRouter><Landing/></MemoryRouter>);
    expect(screen.queryByText("What would you like to make more room for?")).toBeNull();
  });

  it("seeds only a chosen example in the actual request route", () => {
    function Destination(){const location=useLocation();return <p>{exampleFromEntry(location.state)?.prompt ?? "Empty draft"}</p>;}
    render(<MemoryRouter><Routes><Route path="/" element={<Landing/>}/><Route path="/calendar" element={<Destination/>}/></Routes></MemoryRouter>);
    const preview=within(screen.getByRole("group",{name:COPY.exampleLabel}));
    fireEvent.click(preview.getByRole("button",{name:COPY.outside}));
    fireEvent.click(screen.getAllByRole("link",{name:COPY.heroCta})[0]);
    expect(screen.getByText("I’d like to take a photo walk outside.")).toBeTruthy();
  });

  it("leaves the real request empty when no example was chosen", () => {
    function Destination(){const location=useLocation();return <p>{exampleFromEntry(location.state)?.prompt ?? "Empty draft"}</p>;}
    render(<MemoryRouter><Routes><Route path="/" element={<Landing/>}/><Route path="/calendar" element={<Destination/>}/></Routes></MemoryRouter>);
    fireEvent.click(screen.getAllByRole("link",{name:COPY.heroCta})[0]);
    expect(screen.getByText("Empty draft")).toBeTruthy();
  });
});

describe("editorial example sources and entry validation",()=>{
  it("links every example to an existing guide",()=>{
    for(const example of ACTIVITY_EXAMPLES){
      expect(startContent(...example.corner)?.steps.length,example.id).toBeGreaterThan(0);
      expect(example.required.length,example.id).toBeGreaterThan(0);
    }
  });
  it("does not trust arbitrary text, unknown ids or prototype property names from history",()=>{
    for(const state of [null,"sketch",[],{landingExample:"unknown"},{landingExample:"__proto__"},{landingExample:{id:"sketch"}},{draft:"send this"}])expect(exampleFromEntry(state)).toBeUndefined();
    expect(exampleFromEntry({landingExample:"sketch",draft:"ignore the prompt"})?.prompt).toBe("I’d like to try drawing at home.");
  });
});
