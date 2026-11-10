// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const corners = [
  { spaceSlug: "home-garden", slug: "gardening", name: "Gardening", momentCount: 0, momentCount30d: 0 },
  { spaceSlug: "home-garden", slug: "vegetable-gardening", name: "Vegetable gardening", momentCount: 0, momentCount30d: 0 },
  { spaceSlug: "food-cooking", slug: "cooking", name: "Cooking", momentCount: 4, momentCount30d: 0 },
  { spaceSlug: "crafts-making", slug: "pottery", name: "Pottery", momentCount: 0, momentCount30d: 0 },
];
vi.mock("../../context/CornersContext", () => ({
  useCorners: () => ({ allCorners: corners }),
  matchCorners: (list: typeof corners, q: string) => list.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())),
}));

import { CornerPickerSheet } from "./CornerPickerSheet";

afterEach(cleanup);

function setup(over: Partial<Parameters<typeof CornerPickerSheet>[0]> = {}) {
  const onPickCorner = vi.fn();
  const onPickPursuit = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <CornerPickerSheet
      open
      onOpenChange={onOpenChange}
      pursuits={[{ id: "p1", title: "Bake 10 loaves" }]}
      yourCorners={[{ spaceSlug: "food-cooking", slug: "cooking", name: "Cooking" }]}
      pickedPursuitId=""
      pickedCorner=""
      onPickPursuit={onPickPursuit}
      onPickCorner={onPickCorner}
      {...over}
    />,
  );
  return { onPickCorner, onPickPursuit, onOpenChange };
}

describe("CornerPickerSheet", () => {
  it("lists your Pursuits, your Corners and every other Corner as plain rows, no dropdown", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Your Pursuits")).toBeTruthy();
    expect(within(dialog).getByText("Your Corners")).toBeTruthy();
    expect(within(dialog).getByText("All Corners")).toBeTruthy();
    // Cooking shows once, under Your Corners, not again under All Corners.
    expect(within(dialog).getAllByRole("button", { name: "Cooking" })).toHaveLength(1);
    expect(within(dialog).getByRole("button", { name: "Vegetable gardening" })).toBeTruthy();
    expect(within(dialog).queryByRole("listbox")).toBeNull();
  });

  it("filters by search and picks a Corner with one tap, then closes", () => {
    const { onPickCorner, onOpenChange } = setup();
    fireEvent.change(screen.getByLabelText("Search Corners"), { target: { value: "veg" } });
    expect(screen.queryByRole("button", { name: "Pottery" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Vegetable gardening" }));
    expect(onPickCorner).toHaveBeenCalledWith({ spaceSlug: "home-garden", slug: "vegetable-gardening", name: "Vegetable gardening" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("picks a Pursuit", () => {
    const { onPickPursuit } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Bake 10 loaves" }));
    expect(onPickPursuit).toHaveBeenCalledWith("p1");
  });

  it("says so when nothing matches", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Search Corners"), { target: { value: "zzz" } });
    expect(screen.getByText("No Corner matches that.")).toBeTruthy();
  });
});
