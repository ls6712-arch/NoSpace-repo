import { describe, expect, it } from "vitest";
import { firstNameOf, isValidUsername, usernameFromName } from "./onboardingRemote";

describe("usernameFromName", () => {
  it("lowercases and keeps letters, numbers and underscores", () => {
    expect(usernameFromName("Sushmitha")).toBe("sushmitha");
    expect(usernameFromName("Mary-Ann O’Neil")).toBe("maryannoneil");
    expect(usernameFromName("Jo_9")).toBe("jo_9");
  });

  it("drops accents", () => {
    expect(usernameFromName("José")).toBe("jose");
  });

  it("is empty when there is too little to make a username from", () => {
    expect(usernameFromName("Al")).toBe("");
    expect(usernameFromName("李")).toBe("");
    expect(usernameFromName("")).toBe("");
  });

  it("stops at 20 characters", () => {
    expect(usernameFromName("a".repeat(40))).toHaveLength(20);
  });
});

describe("isValidUsername", () => {
  it("accepts 3 to 20 lowercase letters, numbers and underscores", () => {
    expect(isValidUsername("sush_ny")).toBe(true);
    expect(isValidUsername("ab")).toBe(false);
    expect(isValidUsername("a".repeat(21))).toBe(false);
    expect(isValidUsername("Has Space")).toBe(false);
    expect(isValidUsername("UPPER")).toBe(false);
  });
});

describe("firstNameOf", () => {
  it("takes the first word", () => {
    expect(firstNameOf("  Sushmitha   Lekkala ")).toBe("Sushmitha");
    expect(firstNameOf("")).toBe("");
  });
});
