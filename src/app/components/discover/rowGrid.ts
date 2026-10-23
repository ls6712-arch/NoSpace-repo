/**
 * One grid for Discover's three sections (Got 15 minutes?, Spotlight, Browse).
 * Below sm the rows bleed to the screen edge and scroll; from sm they sit on
 * the page's own column and size their items to the Browse grid's columns
 * (2 across at sm, 4 across at lg, 1rem apart), so every section ends at the
 * same right edge and "See all" sits on it.
 */
export const GRID_GAP = "sm:gap-4";

/** The scrolling row itself: back inside the column from sm. */
export const ROW_GRID = "sm:mx-0 sm:px-0 sm:gap-4";

/** One item of a row: exactly one Browse column wide from sm. */
export const ROW_ITEM = "sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-3rem)/4)]";
