// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const result = vi.hoisted(() => ({ value: { data: null, error: null } as { data: unknown; error: unknown } | "throw" }));
vi.mock("../../lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (result.value === "throw") throw new Error("offline");
            return result.value;
          },
        }),
      }),
    }),
  },
}));
vi.mock("../context/CategoriesContext", () => ({ useCategories: () => ({ categories: [] }) }));
vi.mock("./SpacePage", () => ({ SpacePage: () => <p>Space page</p> }));
vi.mock("./NotFound", () => ({ NotFound: () => <p>Not found</p> }));

import { SpaceRoute } from "./SpaceRoute";

const show = () =>
  render(
    <MemoryRouter initialEntries={["/space/clay-club"]}>
      <Routes>
        <Route path="/space/:slug" element={<SpaceRoute />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(cleanup);

describe("SpaceRoute", () => {
  it("shows the Space when it loads", async () => {
    result.value = { data: { id: "s1", slug: "clay-club" }, error: null };
    show();
    await waitFor(() => expect(screen.getByText("Space page")).toBeTruthy());
  });

  it("says not found only for a clean empty answer", async () => {
    result.value = { data: null, error: null };
    show();
    await waitFor(() => expect(screen.getByText("Not found")).toBeTruthy());
  });

  it("offers Try again, not not found, when the load fails", async () => {
    result.value = { data: null, error: { message: "boom" } };
    show();
    await waitFor(() => expect(screen.getByText("Couldn’t load this. Try again.")).toBeTruthy());
    expect(screen.queryByText("Not found")).toBeNull();
    result.value = { data: { id: "s1", slug: "clay-club" }, error: null };
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByText("Space page")).toBeTruthy());
  });

  it("treats a thrown load the same way", async () => {
    result.value = "throw";
    show();
    await waitFor(() => expect(screen.getByText("Couldn’t load this. Try again.")).toBeTruthy());
  });
});
