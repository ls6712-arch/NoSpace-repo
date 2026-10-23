import { describe, expect, it } from "vitest";
import { fillRows } from "./fillRows";

describe("fillRows", () => {
  it("shows 8 from 8 up, then 8 more at a time", () => {
    expect(fillRows(8, 0)).toEqual({ wideCount: 8, narrowCount: 8 });
    expect(fillRows(30, 0)).toEqual({ wideCount: 8, narrowCount: 8 });
    expect(fillRows(30, 1)).toEqual({ wideCount: 16, narrowCount: 16 });
    expect(fillRows(9, 1)).toEqual({ wideCount: 9, narrowCount: 9 });
  });

  it("takes whole rows at each width when there are fewer than 8", () => {
    expect(fillRows(4, 0)).toEqual({ wideCount: 4, narrowCount: 4 });
    expect(fillRows(5, 0)).toEqual({ wideCount: 4, narrowCount: 4 });
    expect(fillRows(7, 0)).toEqual({ wideCount: 4, narrowCount: 6 });
    expect(fillRows(3, 0)).toEqual({ wideCount: 3, narrowCount: 2 });
    expect(fillRows(1, 0)).toEqual({ wideCount: 1, narrowCount: 1 });
    expect(fillRows(0, 0)).toEqual({ wideCount: 0, narrowCount: 0 });
  });

  it("shows everything once Show more has been used", () => {
    expect(fillRows(5, 1)).toEqual({ wideCount: 5, narrowCount: 5 });
  });
});
