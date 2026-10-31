# One skin, PR 5: one page layout

Source: the founder's review of `main` on desktop, Oct 31, 2026. Committed here so the repo has a copy of the PR 5 section of `claude-code-brief-one-skin.md`. Same rules as PRs 1 to 4: never merge, CLAUDE.md applies, copy follows `docs/style-guide.md` and `docs/glossary.md`.

## Answers that came with it
1. **Search stays as it is:** the rail's Search on desktop, the header magnifier on phone, and a header box when signed out or with no rail. Don't add it to the bottom bar. All three must open the same search with the same scope.
2. **#251** (Discover pills as dropdowns): rebase after #252, use `shrink-0` instead of `flex-1` on the pill triggers, and don't fold it into PR 5.

## The problem
PRs 1 to 3 unified colour and type, but not layout. On a 1280px desktop, every tab page is built differently on `main`:

* Home: ~540px centred column, ~40px title, "More ways this week" is a single narrow list.
* Discover: ~790px left-aligned column, display-size title (~56px), "Be the first" in Corner rows.
* Week: ~545px centred column, ~40px title with a back arrow, "This week in New York" cards hard-clipped at the column edge.
* Messages: ~565px column, ~36px title, my own bubble is a full-width bar, three coral fills (Chats tab, New message, Send).
* Notifications popover: unread row has a cream background.

## The rule
Every tab page uses one `PageShell`. Build it once and use it on Home, Discover, Search, Week, Chats, Notifications, You and Settings.

1. **One container.** Content is centred in the space right of the rail, `max-width: 1040px`, gutters 16px on phone, 24px at `tab`, 32px at `desk`. No page sets its own width.
2. **One header.** The same top offset on every page. Title in `text-title` (28px/800 Bricolage), an optional one-line subtitle in `--muted-foreground`, and an optional action on the right. No back arrow on tab pages; back arrows only on pages you drill into. Discover's masthead uses this header too. `text-display` is only for full-bleed photo heroes (Corner, Category).
3. **Use the width.** At `desk`, lists become 2-column grids: Home's "More ways this week", Discover's Corner rows and Week's card lists. Single-purpose cards (Your week, Best fit for you, the budget slider) are handled the same way on every page: either they span the grid or they sit at one shared readable width. Pick one and use it everywhere.
4. **Rows bleed the same way everywhere.** Every horizontal row (Discover ideas, Week's "This week in New York", Corners) uses the shared `HorizontalRow` with the PR 1 edge fade. Nothing is hard-clipped.
5. **Coral discipline.** One coral fill per screen, plus the rail's Log. Segmented tabs (Chats / Message requests) use the selected-chip style (`--foreground` fill, `--background` text). Send is an icon button in `--foreground`. "New message" is a secondary button.
6. **Fixes:**
   * Chat bubbles are at most 75% of the thread width; the sender's bubble is right-aligned, not a full-width bar.
   * Unread notifications use `--surface-raised` plus an accent dot, not cream.
   * Remove "Be the first" from Discover's Corner rows. Hide an empty slot instead.
   * The message field border uses `--border` with the app's standard focus ring.

## Done when
Screenshots of every tab page side by side at 390, 744, 1128 and 1440px, in light and dark, show the same title size and position, the same content width and the same gutters. No hard-clipped rows, no cream, no "Be the first", one coral fill per screen. `npm test`, lint and tsc pass. Don't merge.

## Review changes (Oct 31, 2026)
Both choices below were approved, with these changes.
* Single-purpose cards **span both columns** at `desk` (`SPAN_GRID`), with their inner text capped at about 600px, their buttons sized to content (Start is not full width) and the budget slider capped at about 560px.
* `PageShell` has one extra optional line, `kicker`, above the title. Discover shows "What's out there in {city}" as the kicker (the city is the tappable part) and then "Discover" in `text-title`. The dropdown is never the title.
* Phone Home uses the same app header as the other seven pages, magnifier included.
* Week's days stay in one column, in date order.
* Settings at `desk`: the selected item uses the selected-chip style (`--foreground` fill).
* Chats subtitle is one line: "Your chats and message requests."
* `scripts/visual/page-shell.ts` (`npm run visual:pages`) measures the visible title (the element holding the text, not just the h1), the header's top, the title's left and the content width on every page, counts coral fills, sideways scroll, subtitle lines and hard-clipped rows, and exits 1 on any miss. `npm run visual:pages:selftest` proves the clip and size checks can fail.
