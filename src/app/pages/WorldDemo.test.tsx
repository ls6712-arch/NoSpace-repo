// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorldDemo } from "./WorldDemo";
import { STORAGE_KEY } from "../world/demo/worldDemoStore";

describe("WorldDemo", () => {
  beforeEach(() => window.localStorage.clear());

  it("walks from saying a thing to a keepsake on the Shelf, in this browser only", () => {
    render(<WorldDemo />);

    // Pick the pet.
    fireEvent.click(screen.getByRole("button", { name: "Cat" }));
    fireEvent.click(screen.getByRole("button", { name: "This is them" }));

    // Say two things; each becomes a trail.
    fireEvent.change(screen.getByLabelText("Say what you want to do"), { target: { value: "learn chess and bake bread" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByLabelText("Trail for learn chess")).toBeTruthy();
    expect(screen.getByLabelText("Trail for bake bread")).toBeTruthy();

    // Pack one, with a friend.
    fireEvent.click(screen.getByRole("button", { name: "Pack a bag" }));
    fireEvent.click(screen.getByRole("button", { name: "bake bread" }));
    fireEvent.change(screen.getByLabelText(/Come along\?/), { target: { value: "Priya" } });
    fireEvent.click(screen.getByRole("button", { name: "Pack it" }));
    expect(screen.getByText("Bag's by the door.")).toBeTruthy();

    // Unpack and bring it home: a joined keepsake, and the lamp is lit.
    fireEvent.click(screen.getByRole("button", { name: "Unpack" }));
    fireEvent.change(screen.getByLabelText("One thing about it"), { target: { value: "Burnt the bottom" } });
    fireEvent.click(screen.getByRole("button", { name: "Bring it home" }));
    expect(screen.getByText("Half's with you. Half's with Priya.")).toBeTruthy();
    expect(screen.getByText(/You lit the lamp tonight/)).toBeTruthy();

    // It is on the Shelf and saved in this browser.
    fireEvent.click(screen.getByRole("button", { name: "See it on your Shelf" }));
    expect(screen.getByText("1 keepsake brought home")).toBeTruthy();
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(saved.keepsakes).toHaveLength(1);
    expect(saved.bag).toBeNull();
  });

  it("counts something done without a bag", () => {
    render(<WorldDemo />);
    fireEvent.click(screen.getByRole("button", { name: "This is them" }));
    fireEvent.change(screen.getByLabelText("Did something today without planning it?"), { target: { value: "Went swimming" } });
    fireEvent.click(screen.getByRole("button", { name: "I did this" }));
    fireEvent.click(screen.getByRole("button", { name: "Bring it home" }));
    expect(screen.getByText(/Uncovered so far: Went swimming/)).toBeTruthy();
  });
});
