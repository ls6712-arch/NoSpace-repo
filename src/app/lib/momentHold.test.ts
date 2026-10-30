import { describe, expect, it } from "vitest";
import { withShareNow } from "./momentHold";

describe("withShareNow", () => {
  const row = { caption: "hi", visibility: "public" };
  it("leaves the row alone by default, so the 2 hour hold applies", () => {
    expect(withShareNow(row, undefined)).toBe(row);
    expect(withShareNow(row, false)).toBe(row);
    expect("visible_at" in withShareNow(row, false)).toBe(false);
  });
  it("asks to be visible now when Share now is on", () => {
    expect(withShareNow(row, true, Date.UTC(2026, 9, 30, 12))).toEqual({ ...row, visible_at: "2026-10-30T12:00:00.000Z" });
  });
});
