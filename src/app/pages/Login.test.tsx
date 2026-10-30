// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const flag = vi.hoisted(() => ({ on: true }));
vi.mock("../config", async (orig) => ({
  ...(await orig<typeof import("../config")>()),
  get sooshOnboardingEnabled() {
    return flag.on;
  },
}));

const auth = vi.hoisted(() => ({
  user: null as null | { id: string },
  profile: null as null | { onboarding_completed: boolean },
  loading: false,
  isConfigured: true,
  signUp: vi.fn(),
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
  sendEmailCode: vi.fn(),
  sendSignInCode: vi.fn(),
  verifyEmailCode: vi.fn(),
  resendConfirmation: vi.fn(),
  resetPassword: vi.fn(),
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));

// Stubby's own motion is covered by its tests; here only the state it is told to show matters.
vi.mock("../components/stubby/Stubby", () => ({
  Stubby: ({ state }: { state: string }) => <div data-testid="stubby" data-state={state} />,
}));

import { Login } from "./Login";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{`${l.pathname}${l.search}`}</p>;
}
function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}
const stubby = () => screen.getByTestId("stubby").getAttribute("data-state");

beforeEach(() => {
  flag.on = true;
  Object.assign(auth, { user: null, profile: null, loading: false, isConfigured: true });
  for (const k of ["signUp", "signIn", "sendEmailCode", "sendSignInCode", "signInWithGoogle", "resetPassword"] as const) auth[k].mockReset();
  auth.signInWithGoogle.mockResolvedValue({ error: null });
  sessionStorage.clear();
});
afterEach(cleanup);

describe("log in routes", () => {
  it("sends ?mode=signup (and a bare /login) to the onboarding", async () => {
    renderAt("/login?mode=signup&redirect=%2Fjoin%2Fabc");
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/onboarding?redirect=%2Fjoin%2Fabc"));
    cleanup();
    renderAt("/login");
    await waitFor(() => expect(screen.getByTestId("where").textContent).toMatch(/^\/onboarding/));
  });

  it("opens Welcome back for ?mode=signin", () => {
    renderAt("/login?mode=signin");
    expect(screen.getByRole("heading", { name: "Welcome back." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with email" })).toBeTruthy();
    // Apple is behind appleSignInEnabled, which is off.
    expect(screen.queryByRole("button", { name: "Continue with Apple" })).toBeNull();
  });

  it("renders the old page when the flag is off", () => {
    flag.on = false;
    renderAt("/login?mode=signin");
    expect(screen.queryByRole("heading", { name: "Welcome back." })).toBeNull();
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.queryByTestId("stubby")).toBeNull();
  });
});

describe("log in screens", () => {
  it("starts Stubby asleep and wakes it on the first tap", () => {
    renderAt("/login?mode=signin");
    expect(stubby()).toBe("sleep");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Continue with email" }));
    expect(stubby()).toBe("idle");
    fireEvent.click(screen.getByRole("button", { name: "Continue with email" }));
  });

  it("shows the password only behind 'Use my password instead'", async () => {
    renderAt("/login?mode=signin&view=email");
    expect(screen.queryByLabelText("Password")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use my password instead" }));
    await waitFor(() => expect(screen.getByLabelText("Password")).toBeTruthy());
  });

  it("treats an email nobody has exactly like one that has an account", async () => {
    // The auth layer answers both the same way (see sendSignInCode); the screen must not differ either.
    auth.sendSignInCode.mockResolvedValue({ error: null });
    renderAt("/login?mode=signin&view=email");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send me a code" }));
    await waitFor(() => expect(screen.getByLabelText("Code")).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Check your inbox at new@example.com." })).toBeTruthy();
    expect(auth.sendSignInCode).toHaveBeenCalledWith("new@example.com");
    // Nothing says the person is new, and nothing was created.
    expect(screen.queryByText(/No Soosh account|might be new|If there’s a Soosh account/)).toBeNull();
    expect(auth.sendEmailCode).not.toHaveBeenCalled();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("moves to the code screen when the email has an account", async () => {
    auth.sendSignInCode.mockResolvedValue({ error: null });
    renderAt("/login?mode=signin&view=email");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "mia@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send me a code" }));
    await waitFor(() => expect(screen.getByLabelText("Code")).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Check your inbox at mia@example.com." })).toBeTruthy();
  });

  it("shrugs at a wrong password and says so", async () => {
    auth.signIn.mockResolvedValue({ error: "Invalid login credentials" });
    renderAt("/login?mode=signin&view=password");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "mia@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(screen.getByText("That email and password didn’t match.")).toBeTruthy());
    expect(stubby()).toBe("shrug");
  });

  it("waits to be signed in on 'Signing you in…' and leaves for the right place", async () => {
    auth.user = { id: "u1" };
    auth.profile = { onboarding_completed: false };
    renderAt("/login?mode=signin&redirect=%2Fjoin%2Fabc");
    await act(async () => {});
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/onboarding?redirect=%2Fjoin%2Fabc"));
  });

  it("sends a finished account where it was going", async () => {
    auth.user = { id: "u1" };
    auth.profile = { onboarding_completed: true };
    renderAt("/login?mode=signin&redirect=%2Fpursuit%2Fabc");
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/pursuit/abc"));
  });
});

describe("the code screen, in stages", () => {
  const openCode = async () => {
    auth.sendSignInCode.mockResolvedValue({ error: null });
    renderAt("/login?mode=signin&view=email");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "mia@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send me a code" }));
    await waitFor(() => expect(screen.getByLabelText("Code")).toBeTruthy());
  };

  it("shows the inbox line, the promise and a countdown for the first 30 seconds", async () => {
    await openCode();
    expect(screen.getByText("Codes usually arrive in under a minute.")).toBeTruthy();
    expect(screen.getByText("Send a new code in 0:30")).toBeTruthy();
    expect(screen.queryByText("Still nothing? Check your spam folder.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Log in with password" })).toBeNull();
    // The code field is a one-time-code field.
    expect(screen.getByLabelText("Code").getAttribute("autocomplete")).toBe("one-time-code");
    // "New to Soosh? Get started" is there from the start.
    expect(screen.getByRole("button", { name: "New to Soosh? Get started" })).toBeTruthy();
  });

  it("counts down, then offers three equal options and keeps the footer link", async () => {
    // Fake clock from the start, so the countdown begins on it (it still advances on its own for waitFor).
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await openCode();
      // One second at a time: each tick schedules the next only after React has re-rendered.
      const seconds = async (n: number) => {
        for (let i = 0; i < n; i++) {
          await act(async () => {
            await vi.advanceTimersByTimeAsync(1000);
          });
        }
      };
      await seconds(10);
      expect(screen.getByText("Send a new code in 0:20")).toBeTruthy();
      await seconds(20);
      expect(screen.getByText("Still nothing? Check your spam folder.")).toBeTruthy();
      expect(screen.queryByText(/Send a new code in/)).toBeNull();
      expect(screen.queryByText("Codes usually arrive in under a minute.")).toBeNull();
      const options = ["Send a new code", "Log in with password", "Use a different email"].map((name) => screen.getByRole("button", { name }));
      // Equal: the same kind of button, none of them the primary one.
      expect(new Set(options.map((o) => o.getAttribute("data-variant")))).toEqual(new Set(["plain"]));
      expect(screen.getByRole("button", { name: "New to Soosh? Get started" })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("never uses the old wording that hints at an account", async () => {
    await openCode();
    expect(screen.queryByText(/No code\? You might be new here/)).toBeNull();
    expect(screen.queryByText(/If there’s a Soosh account for/)).toBeNull();
  });

  it("opens sign-up with the email typed from the footer link", async () => {
    await openCode();
    fireEvent.click(screen.getByRole("button", { name: "New to Soosh? Get started" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/onboarding?step=signup&email=mia%40example.com&redirect=%2F"));
  });
});
