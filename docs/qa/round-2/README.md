# Round 2 QA

Screenshots at 390 x 844 (deviceScaleFactor 2), full page, against the visual harness fixtures. Retake with:

    node scripts/visual/qa-shots.ts --out docs/qa/round-2

`qa-report.tsv` lists horizontal overflow per page (all 0px). The tab bar and sticky header can appear mid-page in a full-page capture; that is the capture, not a layout bug.

| File | Screen |
|---|---|
| 01-landing | Landing page, signed out |
| 02-home | Home |
| 03-discover | Discover |
| 04-shelf-own | Your Shelf |
| 05-shelf-other | Someone else's Shelf |
| 06-pursuit | Pursuit page |
| 07-log-from-nav | Log a Moment from the main button |
| 08-log-from-pursuit | Log a Moment from a Pursuit (Pursuit, Corner and amount pre-filled) |
| 09-log-from-corner | Log a Moment from a Corner link |
| 10-log-saved | The one success screen |
| 11-space | A Space |
| 12-search-results / 13-search-none | Search with results, and with none |
| 14-messages | Messages |
| 15-notifications | Inbox |
| 16-settings | Settings |
| 17-empty-state | An empty state |
| 18-error-state | An error state (posts request returns 500) |

Other files: `strings.md` (every string changed), `privacy-check.md` (R6), `pursuit-flow.md` (V3).

Not covered by these screenshots: emails (sent by Supabase Auth and not in this repo), and the live database (the harness uses fixtures).
