// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, Outlet } from "react-router";
import { RouteError } from "./RouteError";
import { ERROR_LINE } from "../lib/stateCopy";

function Boom(): never {
  throw new Error("boom");
}

function Shell() {
  return (
    <div>
      <nav>shell nav</nav>
      <Outlet />
    </div>
  );
}

describe("RouteError", () => {
  it("shows the error screen inside the shell when a page throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const router = createMemoryRouter(
      [
        {
          path: "/",
          Component: Shell,
          ErrorBoundary: RouteError,
          children: [{ ErrorBoundary: RouteError, children: [{ path: "x", Component: Boom }] }],
        },
      ],
      { initialEntries: ["/x"] },
    );
    render(<RouterProvider router={router} />);
    expect((await screen.findByRole("alert")).textContent).toContain(ERROR_LINE);
    expect(screen.getByText("shell nav")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText(/Unexpected Application Error/)).toBeNull();
  });
});
