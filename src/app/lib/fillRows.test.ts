import { describe, expect, it } from "vitest";
import { fillRows } from "./fillRows";

describe("fillRows", () => {
  it("shows 6 from 6 up, then 6 more at a time", () => {
    expect(fillRows(6, 0)).toEqual({ lgCount: 6, smCount: 6 });
    expect(fillRows(20, 0)).toEqual({ lgCount: 6, smCount: 6 });
    expect(fillRows(20, 1)).toEqual({ lgCount: 12, smCount: 12 });
    expect(fillRows(7, 1)).toEqual({ lgCount: 7, smCount: 7 });
  });

  it("takes whole rows at each width when there are fewer than 6", () => {
    expect(fillRows(4, 0)).toEqual({ lgCount: 3, smCount: 4 });
    expect(fillRows(5, 0)).toEqual({ lgCount: 3, smCount: 4 });
    expect(fillRows(3, 0)).toEqual({ lgCount: 3, smCount: 2 });
    expect(fillRows(1, 0)).toEqual({ lgCount: 1, smCount: 1 });
    expect(fillRows(0, 0)).toEqual({ lgCount: 0, smCount: 0 });
  });

  it("shows everything once Show more has been used", () => {
    expect(fillRows(5, 1)).toEqual({ lgCount: 5, smCount: 5 });
  });
});
