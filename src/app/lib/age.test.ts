import { describe, expect, it } from "vitest";
import { MIN_AGE, ageOn, checkBirthdate } from "./age";

const today = new Date(2026, 9, 30); // Oct 30, 2026

describe("age", () => {
  it("counts whole years and the birthday itself", () => {
    expect(ageOn("2008-10-30", today)).toBe(18);
    expect(ageOn("2008-10-31", today)).toBe(17);
    expect(ageOn("2008-11-01", today)).toBe(17);
    expect(ageOn("1990-01-01", today)).toBe(36);
  });

  it("does not read a date that is not real", () => {
    expect(ageOn("2008-02-30", today)).toBeNull();
    expect(ageOn("nope", today)).toBeNull();
    expect(ageOn("", today)).toBeNull();
  });

  it("allows exactly the minimum age", () => {
    expect(MIN_AGE).toBe(18);
    expect(checkBirthdate("2008-10-30", today)).toBe("ok");
    expect(checkBirthdate("2008-10-31", today)).toBe("under");
  });

  it("refuses the future and before 1900", () => {
    expect(checkBirthdate("2026-10-31", today)).toBe("invalid");
    expect(checkBirthdate("1899-12-31", today)).toBe("invalid");
    expect(checkBirthdate("2027-01-01", today)).toBe("invalid");
  });
});
