// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getMomentHold: vi.fn(), releaseMoment: vi.fn() }));
vi.mock("../lib/profileApi", () => api);
const auth = vi.hoisted(() => ({ user: { id: "me" } }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../context/ContentContext", () => ({ isMissingCountColumn: () => false }));
vi.mock("../lib/momentMedia", () => ({ signMomentPaths: async () => new Map() }));

const db = vi.hoisted(() => {
  const insert = vi.fn();
  // A query builder: every step returns itself, and awaiting it gives the result.
  const chain = (result: unknown) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "order", "limit", "single"]) c[m] = () => c;
    c.insert = (row: unknown) => {
      insert(row);
      return c;
    };
    c.then = (resolve: (v: unknown) => void) => resolve(result);
    return c;
  };
  return {
    insert,
    client: {
      from: (table: string) =>
        table === "posts"
          ? chain({ data: [{ id: 42, caption: "Held one", media_paths: null, media_url: null }], error: null })
          : chain({ data: { status: "approved" }, error: null }),
    },
  };
});
vi.mock("../../lib/supabase", () => ({ supabase: db.client }));

import { AddMomentToSpaceDialog } from "./AddMomentToSpaceDialog";

const ok = <T,>(value: T) => Promise.resolve({ ok: true as const, value });
const order: string[] = [];

beforeEach(() => {
  order.length = 0;
  api.getMomentHold.mockReset();
  api.releaseMoment.mockReset().mockImplementation(() => {
    order.push("release");
    return ok(null);
  });
  db.insert.mockReset().mockImplementation(() => order.push("share"));
});
afterEach(cleanup);

const open = async () => {
  const onAdded = vi.fn();
  render(
    <MemoryRouter>
      <AddMomentToSpaceDialog spaceId="space-1" open onOpenChange={() => {}} onAdded={onAdded} />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /Held one/ }));
  return onAdded;
};

describe("Adding a held Moment to a Space", () => {
  it("asks first, and only after Share now releases it and then shares", async () => {
    api.getMomentHold.mockImplementation(() => ok("2026-10-30T20:00:00Z"));
    const onAdded = await open();
    expect(await screen.findByText("Share now?")).toBeTruthy();
    expect(screen.getByText("Anyone who can see your Moments will see this one too.")).toBeTruthy();
    expect(api.releaseMoment).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Share now" }));
    await waitFor(() => expect(db.insert).toHaveBeenCalledWith({ space_id: "space-1", post_id: 42 }));
    expect(api.releaseMoment).toHaveBeenCalledWith(42);
    expect(order).toEqual(["release", "share"]);
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
  });

  it("shares nothing and releases nothing when you cancel", async () => {
    api.getMomentHold.mockImplementation(() => ok("2026-10-30T20:00:00Z"));
    const onAdded = await open();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Share now?")).toBeNull());
    expect(api.releaseMoment).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("shares nothing when releasing fails, and says so", async () => {
    api.getMomentHold.mockImplementation(() => ok("2026-10-30T20:00:00Z"));
    api.releaseMoment.mockImplementation(() => Promise.resolve({ ok: false, message: "x" }));
    const onAdded = await open();
    fireEvent.click(await screen.findByRole("button", { name: "Share now" }));
    expect(await screen.findByText("Something went wrong. Try again.")).toBeTruthy();
    expect(db.insert).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });

  it("shares straight away when the Moment is already visible", async () => {
    api.getMomentHold.mockImplementation(() => ok(null));
    await open();
    await waitFor(() => expect(db.insert).toHaveBeenCalledWith({ space_id: "space-1", post_id: 42 }));
    expect(screen.queryByText("Share now?")).toBeNull();
    expect(api.releaseMoment).not.toHaveBeenCalled();
  });
});
