// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APP_NAME, SUPPORT_CONTACT } from "../../config";
import { ADULT_AGE, MIN_AGE } from "../../lib/age";
import { BIRTHDAY_COPY } from "../../lib/guestCopy";

const setMyBirthday = vi.fn();
vi.mock("../../lib/birthday", () => ({ setMyBirthday: (...a: unknown[]) => setMyBirthday(...a) }));
const refreshProfile = vi.fn(async () => undefined);
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ refreshProfile }) }));

import { AdultPrompt, Under18Screen } from "./Birthday";

function openSheet(onAdded = vi.fn()) {
  render(
    <MemoryRouter>
      <AdultPrompt onAdded={onAdded} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: BIRTHDAY_COPY.add }));
  return onAdded;
}
const enterDate = (v: string) => fireEvent.change(screen.getByLabelText(BIRTHDAY_COPY.label), { target: { value: v } });
const submit = () => fireEvent.click(screen.getAllByRole("button", { name: BIRTHDAY_COPY.add }).at(-1)!);

beforeEach(() => {
  setMyBirthday.mockReset();
  refreshProfile.mockClear();
});
afterEach(cleanup);

describe("Add your birthday to see 21+ picks", () => {
  it("says the age from lib/age.ts, never one written into the copy", () => {
    render(
      <MemoryRouter>
        <AdultPrompt onAdded={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(`Add your birthday to see ${ADULT_AGE}+ picks.`)).toBeTruthy();
  });

  it("an adult birthday is saved once, and the prompt goes", async () => {
    setMyBirthday.mockResolvedValue("ok");
    const onAdded = openSheet();
    expect(screen.getByText(BIRTHDAY_COPY.hint)).toBeTruthy();
    enterDate("1990-05-01");
    submit();
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1));
    expect(setMyBirthday).toHaveBeenCalledWith("1990-05-01");
    expect(refreshProfile).not.toHaveBeenCalled();
  });

  it("under 18: the calm line with the age, the account stays, and only Done hands back", async () => {
    setMyBirthday.mockResolvedValue("under_18");
    const onAdded = openSheet();
    enterDate("2015-05-01");
    submit();
    await screen.findByText(`${APP_NAME} is for people ${MIN_AGE} and over for now.`);
    expect(screen.getByText(BIRTHDAY_COPY.under18Note)).toBeTruthy();
    expect(onAdded).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: BIRTHDAY_COPY.done }));
    expect(onAdded).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(refreshProfile).toHaveBeenCalledTimes(1));
  });

  it("a birthday already on file: locked, with the support link from config", async () => {
    setMyBirthday.mockResolvedValue("locked");
    openSheet();
    enterDate("1990-05-01");
    submit();
    await screen.findByText(BIRTHDAY_COPY.locked);
    const link = screen.getByRole("link", { name: SUPPORT_CONTACT.label });
    expect(link.getAttribute("href")).toBe(SUPPORT_CONTACT.href);
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("a date that isn't real is caught before sending; a failure says try again", async () => {
    openSheet();
    // The field's own min and max stop most bad dates in the browser; past that, our check says so.
    enterDate("2999-01-01");
    fireEvent.submit(document.querySelector("[data-birthday-sheet]")!);
    expect(await screen.findByText(BIRTHDAY_COPY.badDate)).toBeTruthy();
    expect(setMyBirthday).not.toHaveBeenCalled();
    setMyBirthday.mockResolvedValue("error");
    enterDate("1990-05-01");
    submit();
    expect(await screen.findByText(BIRTHDAY_COPY.saveFailed)).toBeTruthy();
  });
});

describe("an under-18 account on a members-only page", () => {
  it("says so calmly, with the way back to Stubby", () => {
    render(
      <MemoryRouter>
        <Under18Screen />
      </MemoryRouter>,
    );
    expect(screen.getByText(`${APP_NAME} is for people ${MIN_AGE} and over for now.`)).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/calendar");
    expect(screen.getByRole("button", { name: BIRTHDAY_COPY.backToStubby })).toBeTruthy();
  });
});
