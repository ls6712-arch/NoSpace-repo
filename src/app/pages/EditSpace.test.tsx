// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Answer = { data: unknown; error: unknown } | "throw";
const answers = vi.hoisted(() => ({ byTable: {} as Record<string, Answer> }));

// Every read in EditSpace is from(table) then a chain of filters, awaited directly or through
// maybeSingle(): one object that is both chainable and awaitable answers them all, per table.
vi.mock("../../lib/supabase", () => {
  const chain = (table: string) => {
    const answer = async () => {
      const a = answers.byTable[table];
      if (a === "throw") throw new Error("offline");
      return a;
    };
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      order: () => q,
      maybeSingle: answer,
      then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => answer().then(ok, bad),
    };
    return q;
  };
  return { supabase: { from: (table: string) => chain(table) } };
});
// One user object for the whole run, as the real context gives: a new one would re-run the load.
const auth = vi.hoisted(() => ({ user: { id: "u1" } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../context/CornersContext", () => ({ capitalizeCornerName: (n: string) => n }));
vi.mock("../components/SpaceForm", () => ({
  SpaceForm: (p: { initialCorners?: { name: string }[]; initialAddress?: string }) => (
    <p>
      Form with {p.initialCorners?.map((c) => c.name).join(",")} at {p.initialAddress}
    </p>
  ),
}));

import { EditSpace } from "./EditSpace";

const LOAD_ERROR = "Couldn’t load this. Try again.";
const good = (): Record<string, Answer> => ({
  spaces: { data: { id: "s1", slug: "clay-club" }, error: null },
  space_members: { data: { role: "host", status: "active" }, error: null },
  space_corners: { data: [{ corners: { slug: "pottery", name: "Pottery", space_slug: "crafts-making" } }], error: null },
  space_private_details: { data: { exact_address: "12 Kiln Lane" }, error: null },
});

const show = () =>
  render(
    <MemoryRouter initialEntries={["/space/clay-club/edit"]}>
      <Routes>
        <Route path="/space/:slug/edit" element={<EditSpace />} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  answers.byTable = good();
});
afterEach(cleanup);

describe("EditSpace", () => {
  it("opens the form with the Space's Corners and address", async () => {
    show();
    await waitFor(() => expect(screen.getByText("Form with Pottery at 12 Kiln Lane")).toBeTruthy());
  });

  it("says the Space doesn't exist only for a clean empty answer", async () => {
    answers.byTable.spaces = { data: null, error: null };
    show();
    await waitFor(() => expect(screen.getByText("That Space doesn’t exist")).toBeTruthy());
  });

  it("says only a host can edit only for a clean answer that is not a host", async () => {
    answers.byTable.space_members = { data: { role: "member", status: "active" }, error: null };
    show();
    await waitFor(() => expect(screen.getByText("Only a host can edit this Space")).toBeTruthy());
  });

  it.each(["spaces", "space_members", "space_corners", "space_private_details"])(
    "offers Try again, never a wrong fact or an emptied form, when reading %s fails",
    async (table) => {
      answers.byTable[table] = { data: null, error: { message: "boom" } };
      show();
      await waitFor(() => expect(screen.getByText(LOAD_ERROR)).toBeTruthy());
      expect(screen.queryByText("That Space doesn’t exist")).toBeNull();
      expect(screen.queryByText("Only a host can edit this Space")).toBeNull();
      expect(screen.queryByText(/^Form with/)).toBeNull();

      answers.byTable = good();
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await waitFor(() => expect(screen.getByText("Form with Pottery at 12 Kiln Lane")).toBeTruthy());
    },
  );

  it("treats a thrown read the same way", async () => {
    answers.byTable.space_corners = "throw";
    show();
    await waitFor(() => expect(screen.getByText(LOAD_ERROR)).toBeTruthy());
  });
});
