import { describe, expect, it } from "vitest";
import { blockBox } from "./TimeGrid";
import { nyTimeToMs } from "../../lib/homeWeek";
import { weekDays } from "../../lib/weekView";
it.each([
  [3, 8],
  [11, 1],
])("positions 9 AM on the 9 AM row on %s/%s", (m, d) => {
  const at = nyTimeToMs(2026, m, d, 9);
  const day = weekDays(at, 1)[0];
  expect(blockBox(day, at, nyTimeToMs(2026, m, d, 10))).toEqual({
    top: 96,
    height: 48,
  });
});
