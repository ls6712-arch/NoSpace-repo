// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { peekResume, RESUME_KEY, RETURN_KEY, saveResume, saveReturn, signUpLanding, takeResume, takeReturn } from "./signUpReturn";

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
    saveResume("jazz tonight", true);
    expect(signUpLanding()).toBe("/calendar");
    sessionStorage.removeItem(RESUME_KEY);
    expect(signUpLanding()).toBeNull();
  });
  it("lets go of a return older than 30 minutes", () => {
    save();
    expect(signUpLanding(Date.now() + 31 * 60_000)).toBeNull();
  });
});

describe("the resume note", () => {
  const MIN = 60_000;
  it("is read back once: the ask and whether to send it", () => {
    saveResume("jazz tonight", true);
    expect(takeResume()).toEqual({ draft: "jazz tonight", send: true });
    expect(takeResume()).toBeNull();
    expect(sessionStorage.getItem(RESUME_KEY)).toBeNull();
  });
  it("is still there just inside 30 minutes", () => {
    const t = Date.now();
    saveResume("jazz tonight", false, t);
    expect(peekResume(t + 29 * MIN)).toEqual({ draft: "jazz tonight", send: false });
  });
  it("lapses after 30 minutes, like the return note, and is dropped", () => {
    const t = Date.now();
    saveResume("jazz tonight", true, t);
    expect(peekResume(t + 31 * MIN)).toBeNull();
    expect(sessionStorage.getItem(RESUME_KEY)).toBeNull();
  });
  it("does not send an old ask for them: takeResume returns nothing once it has lapsed", () => {
    const t = Date.now();
    saveResume("jazz tonight", true, t);
    expect(takeResume(t + 45 * MIN)).toBeNull();
  });
  it("a note with no time on it, or one that does not read, is dropped", () => {
    sessionStorage.setItem(RESUME_KEY, JSON.stringify({ draft: "x", send: true }));
    expect(peekResume()).toBeNull();
    expect(sessionStorage.getItem(RESUME_KEY)).toBeNull();
    sessionStorage.setItem(RESUME_KEY, "not json");
    expect(peekResume()).toBeNull();
  });
  it("no longer sends someone to Stubby once it has lapsed", () => {
    const t = Date.now();
    saveResume("jazz tonight", true, t);
    expect(signUpLanding(t + 10 * MIN)).toBe("/calendar");
    expect(signUpLanding(t + 31 * MIN)).toBeNull();
  });
});
