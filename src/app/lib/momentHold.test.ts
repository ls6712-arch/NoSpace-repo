import { describe, expect, it } from "vitest";
import { MOMENT_HOLD_MS, withHold } from "./momentHold";

describe("withHold", () => {
  const row = { caption: "hi", visibility: "public" };
  const now = Date.UTC(2026, 10, 9, 23, 0);
  it("shows the Moment to others right away by default", () => {
    expect(withHold(row, undefined, now)).toEqual({ ...row, visible_at: "2026-11-09T23:00:00.000Z" });
    expect(withHold(row, false, now)).toEqual({ ...row, visible_at: "2026-11-09T23:00:00.000Z" });
  });
  it("asks for 2 hours later when Post in 2 hours is on", () => {
    expect(withHold(row, true, now)).toEqual({ ...row, visible_at: "2026-11-10T01:00:00.000Z" });
    expect(MOMENT_HOLD_MS).toBe(2 * 60 * 60 * 1000);
  });
});
