/**
 * The two page widths every page uses (there are no others; `PageShell` and `PageContainer` use the same numbers):
 *   PAGE_X     browsable pages: content at most 1040px wide, centred.
 *   READING_X  forms, long text and one-column flows: content at most 680px wide, centred.
 * Gutters are 16px on a phone, 24px from tab and 32px from desk. The widths include the gutters' room, so the
 * content itself is 1040px or 680px at desk. Sections are 40px apart on a phone and 48px from tab; a section's
 * title sits 16px above its content.
 */
export const PAGE_X = "mx-auto w-full max-w-[calc(1040px+2rem)] tab:max-w-[calc(1040px+3rem)] desk:max-w-[calc(1040px+4rem)] px-4 tab:px-6 desk:px-8";
export const READING_X = "mx-auto w-full max-w-[calc(680px+2rem)] tab:max-w-[calc(680px+3rem)] desk:max-w-[calc(680px+4rem)] px-4 tab:px-6 desk:px-8";
export const SECTION_GAP = "mb-10 tab:mb-12";
export const TITLE_GAP = "mb-4";
