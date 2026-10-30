// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { clearLastFinished, clearPasswordOffer, markPasswordOffer, readPasswordOffer, isRealRedirect, laterStep, peekRedirect, readEmail, readLastFinished, rememberEmail, rememberRedirect, takeRedirect, writeLastFinished } from "./onboardingProgress";

describe("onboarding progress", () => {
  beforeEach(() => localStorage.clear());

  it("reads nothing before anything is saved", () => {
    expect(readLastFinished("u1")).toBeNull();
    expect(readLastFinished(undefined)).toBeNull();
  });

  it("saves per person", () => {
    writeLastFinished("u1", "birthday");
    expect(readLastFinished("u1")).toBe("birthday");
    expect(readLastFinished("u2")).toBeNull();
  });

  it("only moves forward", () => {
    writeLastFinished("u1", "where");
    writeLastFinished("u1", "name");
    expect(readLastFinished("u1")).toBe("where");
    writeLastFinished("u1", "picks");
    expect(readLastFinished("u1")).toBe("picks");
  });

  it("ignores a value it does not know", () => {
    localStorage.setItem("soosh.onboarding.step.u1", "nonsense");
    expect(readLastFinished("u1")).toBeNull();
  });

  it("clears", () => {
    writeLastFinished("u1", "card");
    clearLastFinished("u1");
    expect(readLastFinished("u1")).toBeNull();
  });
});

describe("laterStep", () => {
  it("takes the later of two steps, and whichever exists", () => {
    expect(laterStep("name", "where")).toBe("where");
    expect(laterStep("where", "name")).toBe("where");
    expect(laterStep(null, "name")).toBe("name");
    expect(laterStep("name", null)).toBe("name");
    expect(laterStep(null, null)).toBeNull();
  });
});

describe("redirect and email memory", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("keeps a real destination once, and ignores the site root", () => {
    rememberRedirect("/");
    expect(takeRedirect()).toBeNull();
    rememberRedirect("/join/abc");
    expect(peekRedirect()).toBe("/join/abc");
    expect(peekRedirect()).toBe("/join/abc");
    expect(takeRedirect()).toBe("/join/abc");
    expect(takeRedirect()).toBeNull();
  });

  it("does not keep a destination that is not a path", () => {
    rememberRedirect("https://example.com");
    expect(takeRedirect()).toBeNull();
    expect(isRealRedirect("//evil.test")).toBe(false);
    expect(isRealRedirect("/\\evil.test")).toBe(false);
    expect(isRealRedirect("/join/abc")).toBe(true);
  });

  it("remembers the email for this tab", () => {
    expect(readEmail()).toBe("");
    rememberEmail("a@b.co");
    expect(readEmail()).toBe("a@b.co");
  });
});

describe("password offer flag", () => {
  beforeEach(() => sessionStorage.clear());

  it("is off until a code has been accepted, and clears once answered", () => {
    expect(readPasswordOffer()).toBe(false);
    markPasswordOffer();
    expect(readPasswordOffer()).toBe(true);
    clearPasswordOffer();
    expect(readPasswordOffer()).toBe(false);
  });
});
