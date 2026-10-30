// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TransferButton } from "./TransferButton";

afterEach(cleanup);

describe("TransferButton", () => {
  it("is the signal button by default", () => {
    render(<TransferButton>Next</TransferButton>);
    const button = screen.getByRole("button", { name: "Next" });
    expect(button.getAttribute("data-on-dark")).toBe("false");
    expect(button.getAttribute("data-variant")).toBe("primary");
  });

  it("takes the dark treatment on navy screens", () => {
    render(<TransferButton onDark>Next</TransferButton>);
    expect(screen.getByRole("button", { name: "Next" }).getAttribute("data-on-dark")).toBe("true");
  });

  it("keeps its label when it is disabled", () => {
    render(<TransferButton disabled>Add your birthday</TransferButton>);
    const button = screen.getByRole("button", { name: "Add your birthday" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });
});
