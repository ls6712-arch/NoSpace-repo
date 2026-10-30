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

  it("never creates an account for an email nobody has", async () => {
    auth.sendSignInCode.mockResolvedValue({ error: null, noAccount: true });
    renderAt("/login?mode=signin&view=email");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send me a code" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "No Soosh account for that email yet." })).toBeTruthy());
    expect(auth.sendSignInCode).toHaveBeenCalledWith("new@example.com");
    // Neither the sign-up code call nor the password sign-up was made.
    expect(auth.sendEmailCode).not.toHaveBeenCalled();
    expect(auth.signUp).not.toHaveBeenCalled();
    // Get started goes to the sign-up screen with the email already typed.
    fireEvent.click(screen.getByRole("button", { name: "Get started" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/onboarding?step=signup&email=new%40example.com&redirect=%2F"));
  });

  it("moves to the code screen when the email has an account", async () => {
    auth.sendSignInCode.mockResolvedValue({ error: null });
    renderAt("/login?mode=signin&view=email");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "mia@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send me a code" }));
    await waitFor(() => expect(screen.getByLabelText("Code")).toBeTruthy());
    expect(screen.getByText("We sent a 6-digit code to mia@example.com.")).toBeTruthy();
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
