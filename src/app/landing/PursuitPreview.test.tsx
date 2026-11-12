// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PursuitPreview, PURSUIT_EXAMPLES, pursuitSignupHref } from "./PursuitPreview";
import { LANDING_COPY as COPY } from "./copy";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("public Pursuit preview", () => {
  it("carries the selected goal and Corner through signup to the current creation route", () => {
    render(<MemoryRouter><PursuitPreview/></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Drawing" }));
    expect(screen.getByRole("heading", { name: "Make a collection of drawings" })).toBeTruthy();
    const href = screen.getByRole("link", { name: COPY.pursuitCta }).getAttribute("href")!;
    const signup = new URL(href, "https://example.test");
    expect(signup.pathname).toBe("/onboarding");
    const destination = new URL(signup.searchParams.get("redirect")!, "https://example.test");
    expect(destination.pathname).toBe("/pursuits/new");
    expect(Object.fromEntries(destination.searchParams)).toEqual({ title: "Make a collection of drawings", hobby: "art-creative", sub: "drawing" });
    expect(screen.getByText(COPY.pursuitExample)).toBeTruthy();
  });
  it("does not create accounts, write progress or send personal information when exploring goals", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const write = vi.spyOn(Storage.prototype, "setItem");
    const gtag = vi.fn(); Object.assign(window, { gtag });
    render(<MemoryRouter><PursuitPreview/></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Cooking" }));
    expect(screen.getByRole("heading", { name: "Learn a few recipes" })).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: COPY.pursuitCta }));
    expect(fetch).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    expect(gtag).toHaveBeenCalledWith("event", "landing_action_clicked", { action: "pursuit", placement: "pursuit" });
    delete (window as unknown as { gtag?: unknown }).gtag;
  });
  it("never carries illustrative completion into creation", () => {
    for (const goal of PURSUIT_EXAMPLES) {
      const href = pursuitSignupHref(goal);
      const query = new URL(new URL(href, "https://example.test").searchParams.get("redirect")!, "https://example.test").searchParams;
      expect([...query.keys()].sort()).toEqual(["hobby", "sub", "title"]);
    }
  });
});
