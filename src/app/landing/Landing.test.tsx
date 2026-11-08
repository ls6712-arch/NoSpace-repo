// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// These tests cover Ask Stubby itself, so they run with it on (it is off on the live site, config.ts).
vi.mock("../config", async (orig) => ({ ...(await orig<typeof import("../config")>()), stubbyAskEnabled: true }));
import { Landing } from "./Landing";
import { LANDING_COPY as COPY } from "./copy";
import { ACTIVITY_EXAMPLES, LANDING_EXAMPLES, exampleFromEntry } from "./examples";
import { startContent } from "../lib/startContent";
vi.mock("motion/mini", () => ({ animate: vi.fn(() => ({ cancel: vi.fn() })) }));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const mount = () => render(<MemoryRouter><Landing/></MemoryRouter>);

describe("simplified landing", () => {
  it("uses the requested copy and keeps the hero to a photo, title and example switch", () => {
    mount();
    expect(screen.getByText(COPY.heroSub)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Soosh: Do the thing. Bring a friend. Keep the Stub.");
    const preview = screen.getByRole("group", { name: COPY.exampleLabel });
    expect(within(preview).getAllByRole("button").map(button => button.textContent)).toEqual([COPY.another]);
    expect(preview.querySelector("details")).toBeNull();
    expect(preview.querySelector("fieldset")).toBeNull();
    expect(preview.querySelector("img")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Keep the Stub" })).toBeTruthy();
    expect(document.querySelector(".lp")?.textContent).not.toMatch(/You may need to sign up to ask|These are examples|Illustrative progress|1 step complete|A selection of Corners|Complete account setup to invite someone|This weekend in NYC/);
  });
  it("fills the default grid with a real See all Corners destination and filters without duplicate Corners", () => {
    mount();
    const gallery = document.querySelector(".lp-activity-grid")!;
    expect(gallery.querySelectorAll("article")).toHaveLength(6);
    expect(screen.getByRole("link", { name: COPY.seeAllCorners }).getAttribute("href")).toBe("/corners");
    fireEvent.click(screen.getByRole("button", { name: "Spend time outside" }));
    expect(gallery.querySelectorAll("article")).toHaveLength(2);
    expect(gallery.querySelector('a[href="/corners/photography"]')).toBeTruthy();
    expect(gallery.querySelector('a[href="/corners/books"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "A little of everything" }));
    expect(gallery.querySelectorAll("article")).toHaveLength(6);
  });
  it("uses different photographs for the hero and Photography card", () => {
    mount();
    const hero = document.querySelector<HTMLImageElement>(".lp-photo-stage img")!;
    const gallery = document.querySelector<HTMLImageElement>('.lp-activity-grid img[alt="A pier over the water at sunset"]')!;
    expect(hero.src).toContain("photography-");
    expect(gallery.src).toContain("shelf-pier-");
    expect(gallery.src).not.toBe(hero.src);
    expect(document.querySelectorAll(".lp-wall-card img")).toHaveLength(3);
  });
  it("renders actual Stub artwork as labeled examples without reading private progress", () => {
    mount();
    expect(document.querySelectorAll(".lp-stub-grid figure")).toHaveLength(3);
    expect(screen.getByText(COPY.stubsExamples)).toBeTruthy();
    expect(screen.getByText(COPY.stubsLine)).toBeTruthy();
    expect(document.querySelector(".lp-stub-grid")?.textContent).toContain("Pizza night");
    expect(document.querySelector(".lp")?.textContent).not.toContain("Every time you do something");
  });
  it("keeps hash-router navigation, existing login and legal destinations intact", () => {
    const { container } = mount();
    expect(container.querySelectorAll('a[href^="#"]')).toHaveLength(0);
    expect(container.querySelector("main")).toBeNull();
    expect(screen.getByRole("link", { name: "Log in" }).getAttribute("href")).toBe("/login?mode=signin");
    expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("/privacy-policy");
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms");
    fireEvent.click(screen.getByRole("button", { name: COPY.heroSecondary }));
    expect(document.activeElement).toBe(document.getElementById("how-heading"));
  });
  it("cycles through all examples with a single control, across settings", () => {
    mount();
    const preview = within(screen.getByRole("group", { name: COPY.exampleLabel }));
    const start = LANDING_EXAMPLES.findIndex(example => example.id === "photo-walk");
    for (let i = 1; i <= LANDING_EXAMPLES.length; i++) {
      fireEvent.click(preview.getByRole("button", { name: COPY.another }));
      expect(preview.getByRole("heading", { name: LANDING_EXAMPLES[(start + i) % LANDING_EXAMPLES.length].title })).toBeTruthy();
    }
  });
  it("previews a gallery choice and moves focus without reintroducing details controls", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Preview activity: Music" }));
    const heading = screen.getByRole("heading", { name: "Play a song you know" });
    expect(document.activeElement).toBe(heading);
    expect(document.querySelector(".lp-example details")).toBeNull();
  });
  it("keeps source credits honest when a responsive photo cannot load", () => {
    mount();
    const preview = screen.getByRole("group", { name: COPY.exampleLabel });
    const image = preview.querySelector("img")!;
    expect(preview.querySelector(".lp-photo-credit")).toBeNull();
    fireEvent.load(image);
    expect(preview.querySelector(".lp-photo-credit")?.textContent).toContain("Alex Gorin");
    fireEvent.error(image); fireEvent.error(image);
    expect(preview.querySelector(".lp-photo-credit")).toBeNull();
    expect(preview.querySelector(".lp-photo-credit-row")).toBeTruthy();
  });
  it("does not write preferences, create accounts or ask the provider while exploring", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const write = vi.spyOn(Storage.prototype, "setItem");
    mount();
    fireEvent.click(screen.getByRole("button", { name: COPY.another }));
    fireEvent.click(screen.getByRole("button", { name: "Spend time outside" }));
    fireEvent.click(screen.getByRole("button", { name: "Cooking" }));
    expect(fetch).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    expect(screen.queryByText("What would you like to make more room for?")).toBeNull();
  });
  it.each([false, true])("enters the real request with an explicitly chosen draft only: %s", chosen => {
    function Destination() { const location = useLocation(); return <p>{exampleFromEntry(location.state)?.prompt ?? "Empty draft"}</p>; }
    render(<MemoryRouter><Routes><Route path="/" element={<Landing/>}/><Route path="/calendar" element={<Destination/>}/></Routes></MemoryRouter>);
    if (chosen) fireEvent.click(screen.getByRole("button", { name: COPY.another }));
    fireEvent.click(screen.getAllByRole("link", { name: COPY.heroCta })[0]);
    expect(screen.getByText(chosen ? "I’d like to cook at home with a friend." : "Empty draft")).toBeTruthy();
  });
});
describe("walls, guides and the repeated entry", () => {
  it("labels the walls as examples and shows both walls and Passed along", () => {
    mount();
    const walls = screen.getByRole("group", { name: COPY.wallsExample });
    for (const name of [COPY.stillMaking, COPY.madeIt, COPY.passedAlong]) expect(within(walls).getByRole("heading", { name })).toBeTruthy();
    expect(within(walls).getAllByText(COPY.makeYourVersion)).toHaveLength(3);
    expect(screen.getByText(COPY.membersOnly)).toBeTruthy();
  });
  it("links each guide to its static page", () => {
    mount();
    for (const g of COPY.guides) expect(screen.getByRole("link", { name: g.title }).getAttribute("href")).toBe(g.href);
    expect(screen.getByRole("link", { name: COPY.seeAllGuides }).getAttribute("href")).toBe("/hobbies/");
  });
  it("repeats one main action in the header, hero, walls and final card", () => {
    mount();
    expect(screen.getAllByRole("link", { name: COPY.heroCta })).toHaveLength(4);
  });
});
describe("editorial example compatibility", () => {
  it("keeps all examples attached to existing guides and explicit requirements", () => {
    for (const example of ACTIVITY_EXAMPLES) {
      expect(startContent(...example.corner)?.steps.length, example.id).toBeGreaterThan(0);
      expect(example.required.length, example.id).toBeGreaterThan(0);
    }
  });
  it("preserves old ids while rejecting arbitrary history text and prototype keys", () => {
    for (const state of [null, "sketch", [], { landingExample: "unknown" }, { landingExample: "__proto__" }, { draft: "send this" }]) expect(exampleFromEntry(state)).toBeUndefined();
    expect(exampleFromEntry({ landingExample: "sketch" })?.prompt).toBe("I’d like to try drawing at home.");
  });
});
