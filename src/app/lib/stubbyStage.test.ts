// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { HELLO_KEY, takeHello } from "./stubbyStage";

describe("the hello", () => {
  afterEach(() => window.sessionStorage.clear());

  it("plays once a session", () => {
    expect(takeHello()).toBe(true);
    expect(takeHello()).toBe(false);
    expect(window.sessionStorage.getItem(HELLO_KEY)).toBe("1");
  });
});
