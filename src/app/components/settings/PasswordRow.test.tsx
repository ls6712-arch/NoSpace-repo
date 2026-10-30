// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: null as unknown, updatePassword: vi.fn() }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth }));
const signInWithPassword = vi.hoisted(() => vi.fn());
vi.mock("../../../lib/supabase", () => ({ supabase: { auth: { signInWithPassword } }, isSupabaseConfigured: true }));

import { PasswordChangeRow } from "./AccountSection";

beforeEach(() => {
  auth.updatePassword.mockReset();
  signInWithPassword.mockReset();
});
afterEach(cleanup);

describe("Settings > Account password row", () => {
  it("says Add a password for an account without one (code, Google or Apple)", () => {
    auth.user = { email: "mia@example.com", app_metadata: { provider: "google" }, user_metadata: {} };
    render(<PasswordChangeRow />);
    expect(screen.getByRole("button", { name: "Add a password" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change password" })).toBeNull();
  });

  it("says Change password for an account that has one", () => {
    auth.user = { email: "mia@example.com", app_metadata: { provider: "email" }, user_metadata: { has_password: true } };
    render(<PasswordChangeRow />);
    expect(screen.getByRole("button", { name: "Change password" })).toBeTruthy();
  });

  it("adds a password without asking for a current one", async () => {
    auth.user = { email: "mia@example.com", app_metadata: { provider: "email" }, user_metadata: {} };
    auth.updatePassword.mockResolvedValue({ error: null });
    render(<PasswordChangeRow />);
    fireEvent.click(screen.getByRole("button", { name: "Add a password" }));
    expect(screen.queryByLabelText("Current password")).toBeNull();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a-long-password" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "a-long-password" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add a password" }).at(-1)!);
    await waitFor(() => expect(auth.updatePassword).toHaveBeenCalledWith("a-long-password"));
    // No re-login with a current password was attempted.
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("still checks the current password before changing one", async () => {
    auth.user = { email: "mia@example.com", app_metadata: { provider: "email" }, user_metadata: { has_password: true } };
    signInWithPassword.mockResolvedValue({ error: { message: "bad" } });
    render(<PasswordChangeRow />);
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "wrong-password" } });
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-long-password" } });
    fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "a-long-password" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Change password" }).at(-1)!);
    await waitFor(() => expect(screen.getByText("Your current password isn’t right.")).toBeTruthy());
    expect(auth.updatePassword).not.toHaveBeenCalled();
  });
});
