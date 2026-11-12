// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const next = vi.fn();
const savePrivate = vi.fn();
const hasBirthdayOnFile = vi.fn();

vi.mock("../OnboardingContext", () => ({ useOnboarding: () => ({ next, setStubby: vi.fn() }) }));
vi.mock("../StepStubby", () => ({ StepStubby: () => null }));
vi.mock("../../../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, signOut: vi.fn() }) }));
vi.mock("../../../lib/onboardingRemote", () => ({ savePrivate: (...a: unknown[]) => savePrivate(...a), removeUnderageAccount: vi.fn() }));
vi.mock("../../../lib/birthday", () => ({ hasBirthdayOnFile: (...a: unknown[]) => hasBirthdayOnFile(...a) }));

import { BirthdayScreen } from "./BirthdayScreen";
import { ERROR_LINE } from "../../../lib/stateCopy";

const submit = () => {
  fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "2000-11-12" } });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
};

describe("BirthdayScreen", () => {
  beforeEach(() => {
    next.mockReset();
    savePrivate.mockReset();
    hasBirthdayOnFile.mockReset();
  });
  afterEach(cleanup);

  it("moves on when the save is refused because a birthday is already on file", async () => {
    savePrivate.mockResolvedValue({ error: "refused" });
    hasBirthdayOnFile.mockResolvedValue(true);
    render(<MemoryRouter><BirthdayScreen /></MemoryRouter>);
    submit();
    await waitFor(() => expect(next).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(ERROR_LINE)).toBeNull();
  });

  it("still shows the error when nothing is on file", async () => {
    savePrivate.mockResolvedValue({ error: "refused" });
    hasBirthdayOnFile.mockResolvedValue(false);
    render(<MemoryRouter><BirthdayScreen /></MemoryRouter>);
    submit();
    await waitFor(() => expect(screen.getByText(ERROR_LINE)).toBeTruthy());
    expect(next).not.toHaveBeenCalled();
  });
});
