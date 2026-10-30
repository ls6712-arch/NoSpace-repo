// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth.value }));

import { Week } from "./Week";
import { WEEK_PLACEHOLDER, WEEK_SIGNED_OUT } from "../lib/homeCopy";

afterEach(cleanup);
const show = () => render(<MemoryRouter><Week /></MemoryRouter>);

describe("Week", () => {
  it("is a placeholder with a link back to Home", () => {
    auth.value = { user: { id: "u1" }, isConfigured: true };
    show();
    expect(screen.getByRole("heading", { name: WEEK_PLACEHOLDER.title })).toBeTruthy();
    expect(screen.getByRole("link", { name: WEEK_PLACEHOLDER.back }).getAttribute("href")).toBe("/my-space");
  });

  it("asks someone who is signed out to make an account", () => {
    auth.value = { user: null, isConfigured: true };
    show();
    expect(screen.getByRole("heading", { name: WEEK_SIGNED_OUT.title })).toBeTruthy();
  });
});
