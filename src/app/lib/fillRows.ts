/** Plates shown at a time. 6 fills whole rows both 2 across (below lg) and 3 across (from lg). */
export const ROW_PAGE = 6;

/**
 * How many plates to show after a lead Moment so the last row is always full.
 * From 6 up it is 6, then 6 more per "Show more". Below 6 the first view takes
 * the largest whole-row count at each width (3 across from lg, 2 across below)
 * and "Show more" brings in the rest.
 */
export function fillRows(total: number, morePages: number): { lgCount: number; smCount: number } {
  const grown = Math.min(total, ROW_PAGE + morePages * ROW_PAGE);
  if (morePages > 0 || total >= ROW_PAGE) return { lgCount: grown, smCount: grown };
  return {
    lgCount: total >= 3 ? total - (total % 3) : total,
    smCount: total >= 2 ? total - (total % 2) : total,
  };
}
