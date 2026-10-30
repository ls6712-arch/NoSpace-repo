// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { clearLastFinished, readLastFinished, writeLastFinished } from "./onboardingProgress";

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
