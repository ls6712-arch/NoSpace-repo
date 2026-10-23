/** Moments shown at a time after the lead. 8 fills whole rows 2 across (a phone) and 4 across (md and up). */
export const ROW_PAGE = 8;

/**
 * How many tiles to show after a lead Moment so the last row is always full.
 * From 8 up it is 8, then 8 more per "Show more". Below 8 the first view takes
 * the largest whole-row count at each width (4 across from md, 2 across below)
 * and "Show more" brings in the rest.
 */
export function fillRows(total: number, morePages: number): { wideCount: number; narrowCount: number } {
  const grown = Math.min(total, ROW_PAGE + morePages * ROW_PAGE);
  if (morePages > 0 || total >= ROW_PAGE) return { wideCount: grown, narrowCount: grown };
  return {
    wideCount: total >= 4 ? total - (total % 4) : total,
    narrowCount: total >= 2 ? total - (total % 2) : total,
  };
}
