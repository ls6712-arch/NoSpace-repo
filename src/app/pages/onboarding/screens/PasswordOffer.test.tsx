// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ updatePassword: vi.fn() }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => auth }));
const react = vi.hoisted(() => vi.fn());
vi.mock("../OnboardingContext", () => ({ useOnboarding: () => ({ react }) }));
vi.mock("../StepStubby", () => ({ StepStubby: () => <div data-testid="stubby" /> }));
vi.mock("./NameScreen", () => ({ NameScreen: () => <h1>What should people call you?</h1> }));

import { clearPasswordOffer, markPasswordOffer, readPasswordOffer } from "../../../lib/onboardingProgress";
import { NameStep } from "./NameStep";

beforeEach(() => {
  sessionStorage.clear();
  auth.updatePassword.mockReset();
  react.mockReset();
});
afterEach(cleanup);

describe("the password offer", () => {
  it("is only shown after an email code, never to someone who came in with Google or Apple", () => {
    // Google and Apple never set the flag.
    render(<NameStep />);
    expect(screen.getByRole("heading", { name: "What should people call you?" })).toBeTruthy();
    expect(screen.queryByText("Want a password too?")).toBeNull();
  });

  it("asks once after a code, with both answers the same size", () => {
    markPasswordOffer();
    render(<NameStep />);
    expect(screen.getByRole("heading", { name: "Want a password too?" })).toBeTruthy();
    expect(screen.getByText("Optional. You can always log in with a code.")).toBeTruthy();
    const add = screen.getByRole("button", { name: "Add a password" });
    const skip = screen.getByRole("button", { name: "Skip for now" });
    expect(add.getAttribute("data-variant")).toBe(skip.getAttribute("data-variant"));
    expect(add.getAttribute("data-on-dark")).toBe(skip.getAttribute("data-on-dark"));
  });

  it("skips without saving anything and goes on to the name", async () => {
    markPasswordOffer();
    render(<NameStep />);
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "What should people call you?" })).toBeTruthy());
    expect(auth.updatePassword).not.toHaveBeenCalled();
    expect(readPasswordOffer()).toBe(false);
  });

  it("saves a password with updatePassword, then goes on", async () => {
    auth.updatePassword.mockResolvedValue({ error: null });
    markPasswordOffer();
    render(<NameStep />);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-long-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Add a password" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "What should people call you?" })).toBeTruthy());
    expect(auth.updatePassword).toHaveBeenCalledWith("a-long-password");
    expect(readPasswordOffer()).toBe(false);
  });

  it("does not save one that is too short, and says why", async () => {
    markPasswordOffer();
    render(<NameStep />);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Add a password" }));
    await waitFor(() => expect(screen.getByText("Your password needs at least 10 characters.")).toBeTruthy());
    expect(auth.updatePassword).not.toHaveBeenCalled();
    clearPasswordOffer();
  });

  it("keeps the offer when saving fails", async () => {
    auth.updatePassword.mockResolvedValue({ error: "Something went wrong. Try again." });
    markPasswordOffer();
    render(<NameStep />);
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-long-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Add a password" }));
    await waitFor(() => expect(screen.getByText("Something went wrong. Try again.")).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Want a password too?" })).toBeTruthy();
  });
});
