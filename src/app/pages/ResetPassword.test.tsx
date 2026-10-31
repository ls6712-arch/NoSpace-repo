// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  loading: false,
  updatePassword: vi.fn(),
}));
const navigate = vi.hoisted(() => vi.fn());
vi.mock("react-router", () => ({ useNavigate: () => navigate }));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ ...auth, isConfigured: true }),
}));
vi.mock("motion/react", async () => {
  const React = await import("react");
  const motion = new Proxy({}, { get: (_t, tag: string) => React.forwardRef(({ whileTap: _w, transition: _t2, ...p }: Record<string, unknown>, ref) => React.createElement(tag, { ...p, ref })) });
  return { motion, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

import { EXPIRED_LINE, ResetPassword } from "./ResetPassword";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  auth.user = null;
  auth.loading = false;
  auth.updatePassword = vi.fn(async () => ({ error: null }));
  navigate.mockClear();
});
afterEach(cleanup);

describe("reset password screen", () => {
  it("asks for one new password and one button when the link is good", () => {
    auth.user = { id: "u1" };
    render(<ResetPassword />);
    expect(screen.getByLabelText("New password")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Save password" })).toBeTruthy();
  });

  it("saves the password and goes Home", async () => {
    auth.user = { id: "u1" };
    render(<ResetPassword />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a long enough one" } });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/my-space", { replace: true }));
    expect(auth.updatePassword).toHaveBeenCalledWith("a long enough one");
  });

  it("stays put and says why when the password is not accepted", async () => {
    auth.user = { id: "u1" };
    auth.updatePassword = vi.fn(async () => ({ error: "Your password needs at least 10 characters." }));
    render(<ResetPassword />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Save password" }));
    expect(await screen.findByText("Your password needs at least 10 characters.")).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("says the link has expired, with a button for a new one, when there is no session", () => {
    render(<ResetPassword />);
    expect(screen.getByText(EXPIRED_LINE)).toBeTruthy();
    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.getByRole("button", { name: "Send a new link" })).toBeTruthy();
  });

  it("treats a link Supabase already refused as expired even while signed in elsewhere", () => {
    sessionStorage.setItem("soosh.recovery", "expired");
    auth.user = { id: "u1" };
    render(<ResetPassword />);
    expect(screen.getByText(EXPIRED_LINE)).toBeTruthy();
  });

  it("opens the log in screen's reset step for a new link, and keeps no address", () => {
    render(<ResetPassword />);
    fireEvent.click(screen.getByRole("button", { name: "Send a new link" }));
    expect(navigate).toHaveBeenCalledWith("/login?mode=signin&view=reset", { replace: true });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("waits for the session before choosing", () => {
    auth.loading = true;
    render(<ResetPassword />);
    expect(screen.queryByText(EXPIRED_LINE)).toBeNull();
    expect(screen.queryByLabelText("New password")).toBeNull();
  });
});
