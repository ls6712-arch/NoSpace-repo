// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const verify = vi.hoisted(() => vi.fn());
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ verifyEmailCode: verify }) }));

import { CodeEntry } from "./CodeEntry";

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const seconds = async (n: number) => {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
};
const base = { email: "mia@example.com", hero: null, resend: vi.fn(), onWrong: vi.fn(), onVerified: vi.fn(), onDifferentEmail: vi.fn() };

describe("CodeEntry, sign-up stages (no password, no Get started link)", () => {
  it("has the same first stage as log in", () => {
    render(<CodeEntry {...base} />);
    expect(screen.getByRole("heading", { name: "Check your inbox at mia@example.com." })).toBeTruthy();
    expect(screen.getByText("Codes usually arrive in under a minute.")).toBeTruthy();
    expect(screen.getByText("Send a new code in 0:30")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New to Soosh? Get started" })).toBeNull();
  });

  it("offers two equal options after 30 seconds, and never the password", async () => {
    render(<CodeEntry {...base} />);
    await seconds(30);
    expect(screen.getByText("Still nothing? Check your spam folder.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send a new code" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use a different email" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Log in with password" })).toBeNull();
  });

  it("starts the 30 seconds again after a new code", async () => {
    base.resend.mockResolvedValue({ error: null });
    render(<CodeEntry {...base} />);
    await seconds(30);
    await act(async () => {
      screen.getByRole("button", { name: "Send a new code" }).click();
    });
    expect(base.resend).toHaveBeenCalledWith("mia@example.com");
    expect(screen.getByText("New code sent.")).toBeTruthy();
    expect(screen.getByText("Send a new code in 0:30")).toBeTruthy();
    expect(screen.queryByText("Still nothing? Check your spam folder.")).toBeNull();
  });
});

describe("CodeEntry, resend limit", () => {
  it("shows how long to wait, not an error, and holds the button until then", async () => {
    base.resend.mockResolvedValue({ error: null, retryAfterSeconds: 52 });
    render(<CodeEntry {...base} />);
    await seconds(30);
    await act(async () => {
      screen.getByRole("button", { name: "Send a new code" }).click();
    });
    expect(screen.getByText("You can ask for another code in 52 seconds.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Send a new code" }) as HTMLButtonElement).disabled).toBe(true);
    // Not an error: no failure wording, and nothing changes in the stage.
    expect(screen.queryByText(/Something went wrong|went wrong/)).toBeNull();
    expect(screen.getByText("Still nothing? Check your spam folder.")).toBeTruthy();
    // The line stays put while it counts down (a screen reader hears it once), then the button comes back.
    await seconds(10);
    expect(screen.getByText("You can ask for another code in 52 seconds.")).toBeTruthy();
    await seconds(43);
    expect(screen.queryByText(/You can ask for another code in/)).toBeNull();
    expect((screen.getByRole("button", { name: "Send a new code" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("CodeEntry, hourly cap", () => {
  const cap = { error: null, tooMany: true };

  it("says it is too many, with no time and no held button, and points at the password on log in", async () => {
    base.resend.mockResolvedValue(cap);
    render(<CodeEntry {...base} onPassword={() => {}} />);
    await seconds(30);
    await act(async () => {
      screen.getByRole("button", { name: "Send a new code" }).click();
    });
    expect(screen.getByText("Too many codes for now. Try again in a little while, or log in with your password.")).toBeTruthy();
    // No guessed time anywhere, and the button is not held for one.
    expect(screen.queryByText(/in \d+ (second|minute)/)).toBeNull();
    expect((screen.getByRole("button", { name: "Send a new code" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("leaves the password out of it on sign-up, where there is none", async () => {
    base.resend.mockResolvedValue(cap);
    render(<CodeEntry {...base} />);
    await seconds(30);
    await act(async () => {
      screen.getByRole("button", { name: "Send a new code" }).click();
    });
    expect(screen.getByText("Too many codes for now. Try again in a little while.")).toBeTruthy();
    expect(screen.queryByText(/password/)).toBeNull();
  });
});

describe("CodeEntry, Stubby thinks while waiting", () => {
  it("thinks as the screen opens, stops when the person starts typing, and again while a code is checked", async () => {
    const onThinking = vi.fn();
    verify.mockResolvedValue({ error: "x", wrong: true });
    render(<CodeEntry {...base} onThinking={onThinking} />);
    expect(onThinking.mock.calls).toEqual([[true]]);
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "1" } });
    expect(onThinking.mock.calls.at(-1)).toEqual([false]);
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "123456" } });
    await act(async () => {});
    expect(onThinking.mock.calls.at(-1)).toEqual([true]);
    // Then it is the caller's own reaction: a shrug for a wrong code.
    expect(base.onWrong).toHaveBeenCalled();
  });

  it("stops thinking when the 30 seconds are up", async () => {
    const onThinking = vi.fn();
    render(<CodeEntry {...base} onThinking={onThinking} />);
    await seconds(30);
    expect(onThinking.mock.calls.at(-1)).toEqual([false]);
  });
});

describe("CodeEntry, what a screen reader hears", () => {
  const liveParent = (el: HTMLElement) => el.closest('[aria-live="polite"]');

  it("announces the change at 30 seconds, politely, and not the countdown", async () => {
    render(<CodeEntry {...base} />);
    const countdown = screen.getByText("Send a new code in 0:30");
    // The ticking countdown is in no live region, so it is not read out every second.
    expect(liveParent(countdown)).toBeNull();
    // The live region is there from the start (so the change is announced), empty.
    expect(document.querySelector('[aria-live="polite"]:empty, [aria-live="polite"]')).toBeTruthy();
    await seconds(30);
    const stage = screen.getByText("Still nothing? Check your spam folder.");
    expect(liveParent(stage)).not.toBeNull();
    expect(liveParent(stage)?.getAttribute("aria-live")).toBe("polite");
  });
});
