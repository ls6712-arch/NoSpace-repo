// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { RESUME_KEY, RETURN_KEY, saveReturn, signUpLanding, takeReturn } from "./signUpReturn";

afterEach(() => sessionStorage.clear());

const save = () => saveReturn({ trigger: "limit", method: "google", draft: "jazz tonight", blocked: true, guestMessages: 4 });

describe("signUpLanding", () => {
  it("is nothing for someone who is not coming back from signing up", () => {
    expect(signUpLanding()).toBeNull();
  });
  it("is Stubby while the return is waiting", () => {
    save();
    expect(signUpLanding()).toBe("/calendar");
  });
  it("is still Stubby once the return has been taken, until Stubby picks the ask back up", () => {
    save();
    takeReturn();
    expect(sessionStorage.getItem(RETURN_KEY)).toBeNull();
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ draft: "jazz tonight", send: true }));
    expect(signUpLanding()).toBe("/calendar");
    sessionStorage.removeItem(RESUME_KEY);
    expect(signUpLanding()).toBeNull();
  });
  it("lets go of a return older than 30 minutes", () => {
    save();
    expect(signUpLanding(Date.now() + 31 * 60_000)).toBeNull();
  });
});
