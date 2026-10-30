// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { readLoginMethod, rememberLoginMethod } from "./loginMethod";

beforeEach(() => localStorage.clear());

describe("loginMethod", () => {
  it("is the code until a password has been used", () => {
    expect(readLoginMethod()).toBe("code");
  });

  it("remembers the last method on the device", () => {
    rememberLoginMethod("password");
    expect(readLoginMethod()).toBe("password");
    rememberLoginMethod("code");
    expect(readLoginMethod()).toBe("code");
  });

  it("ignores a value it does not know", () => {
    localStorage.setItem("soosh.login.method", "fax");
    expect(readLoginMethod()).toBe("code");
  });
});
