// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
  sendEmailCode: vi.fn(),
}));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => auth }));
const next = vi.hoisted(() => vi.fn());
vi.mock("../OnboardingContext", () => ({ useOnboarding: () => ({ next, redirectTo: "/discover" }) }));
vi.mock("../StepStubby", () => ({ StepStubby: () => <div /> }));

import { markPasswordOffer, readPasswordOffer } from "../../../lib/onboardingProgress";
import { SignUpScreen } from "./SignUpScreen";

const renderScreen = (url = "/") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <SignUpScreen />
    </MemoryRouter>,
  );

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  Object.values(auth).forEach((f) => f.mockReset());
  next.mockReset();
});
afterEach(cleanup);

describe("sign-up and the password offer", () => {
  it("sets the offer as soon as an email code is sent, before the code is accepted", async () => {
    // The account (and the name screen) exists the moment the code checks out, so the flag cannot wait for that.
    auth.sendEmailCode.mockResolvedValue({ error: null });
    renderScreen();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "mia@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(next).toHaveBeenCalled());
    expect(readPasswordOffer()).toBe(true);
  });

  it("never offers a password to someone going on with Google", async () => {
    markPasswordOffer(); // left over from an abandoned email sign-up
    auth.signInWithGoogle.mockResolvedValue({ error: null });
    renderScreen();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(auth.signInWithGoogle).toHaveBeenCalled());
    expect(readPasswordOffer()).toBe(false);
  });

  it("shows a wait, not an error, and does not move on or offer anything, when too many codes were asked for", async () => {
    auth.sendEmailCode.mockResolvedValue({ error: null, retryAfterSeconds: 45 });
    renderScreen();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "mia@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText("You can ask for another code in 45 seconds.")).toBeTruthy());
    expect(next).not.toHaveBeenCalled();
    expect(readPasswordOffer()).toBe(false);
  });
});

describe("sign-up email step", () => {
  it("says it is too many, with no time, when the hourly cap is hit", async () => {
    auth.sendEmailCode.mockResolvedValue({ error: null, tooMany: true });
    renderScreen();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "mia@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText("Too many codes for now. Try again in a little while.")).toBeTruthy());
    expect(next).not.toHaveBeenCalled();
  });

  it("comes back from 'Use a different email' with the address filled in and its text selected", async () => {
    // (selectionStart is null on an email input by spec, so the call to select() is what is checked.)
    const select = vi.spyOn(HTMLInputElement.prototype, "select");
    renderScreen("/?email=mia%40example.com");
    const input = screen.getByLabelText("Email") as HTMLInputElement;
    expect(input.value).toBe("mia@example.com");
    await waitFor(() => expect(select.mock.contexts).toContain(input));
    select.mockRestore();
  });
});
