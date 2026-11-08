// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = { user: { id: "u" } as { id: string } | null };
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../landing/Landing", () => ({ Landing: () => <p>landing</p> }));

import { Home } from "./Home";
import { RESUME_KEY } from "../lib/signUpReturn";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  auth.user = { id: "u" };
});

const at = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/my-space" element={<p>home feed</p>} />
        <Route path="/calendar" element={<p>stubby</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("Home", () => {
  it("sends a signed-in person to the Home feed", () => {
    at();
    expect(screen.getByText("home feed")).toBeTruthy();
  });
  it("sends someone back from signing up from Stubby to Stubby, not the feed", () => {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ draft: "x", send: true }));
    at();
    expect(screen.getByText("stubby")).toBeTruthy();
  });
  it("shows the landing page to a visitor", () => {
    auth.user = null;
    at();
    expect(screen.getByText("landing")).toBeTruthy();
  });
});
