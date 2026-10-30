// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ verifyEmailCode: vi.fn() }) }));

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
