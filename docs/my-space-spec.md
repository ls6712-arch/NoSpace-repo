# My Space: full spec (self-contained)

Save this as `docs/my-space-spec.md`. It replaces the earlier My Space prompt and both amendments (own-Pursuits tracker, layout/responsive). Nothing else needs to be read to build this screen, other than the mockups and `docs/CLAUDE-redesign-brief.md` for tokens and vocabulary.

## 0. Setup

**Mockups (visual target).** Put the screenshots in `docs/mockups/`:
- `my-space-dark.png`: the dark My Space mockup (contact sheet, Moment panel, right rail with the Shelf bars).
- `my-space-light.png`: if there is no light version yet, the light theme uses the same layout with the light tokens.
- `profile-light.png` and `settings-light.png`: for reference only, not part of this task.

If a mockup is missing, stop and ask. Do not guess pixel values. Where the mockup and this text disagree, the **mockup wins for layout, spacing and type; this text wins for behavior.** Report every difference you choose to make.

**Branch:** `redesign/my-space` from `main`.

**First, inspect** the schema and existing queries for Moments, Pursuits, Updates, follows, reactions, bookmarks and the Shelf. Reuse what exists. Don't invent tables. Report anything missing before adding it.

**Rules (from the brief):** tokens only (no raw hex, no `text-white`), product name `Sushii` via `APP_NAME`, vocabulary as in the glossary (Moment, Pursuit, Space, Corner, Circle, Shelf, Reflection; no Clan; reactions are Love this / Count me in / Add a thought, icon-only, three across; Love this/Count me in counts are **public** as of Sept 24, 2026 — see `docs/moment-card-and-reactions-spec.md`'s STATUS block — Thoughts is the one count that stays maker-only; Bookmark is separate). No streaks, percentages, confetti, leaderboards or numeric badges. Accent only for primary actions and active states; gold only for tiny details (`--gold-text` for any gold text). See `docs/moment-card-and-reactions-spec.md` for the full reactions/counts model.

## 1. Layout

**Superseded by boards 4/5** (`docs/mockups/4-my-space-desktop.png`, `docs/mockups/5-my-space-mobile.png`, `docs/moment-card-and-reactions-spec.md`): the contact-sheet-strip-plus-single-Moment-panel layout below is retired. My Space is now one continuous feed built from the shared `MomentCard` — a lead card, then a 3-column row, then a 1.6fr/1fr row, six Moments per sheet, numbered 01-06. See section 2 for the current layout; sections 2-3 below (contact sheet, Moment panel) describe the retired design and are kept only as history until this doc gets a fuller rewrite.

**Grid.** CSS grid with named areas. Every grid child gets `min-w-0`. Use `dvh`, not `vh`. Respect `env(safe-area-inset-*)`.

| Breakpoint | Structure |
|---|---|
| lg >= 1024 (current) | columns `minmax(0,1fr) \| 280px` (320px at xl 1280+), hairline between feed and rail. Areas: `"header header" / "feed rail"`. Feed and rail each scroll independently in `calc(100dvh - nav - header)`. Boards 4/5 show no rail at all (single column, full width) — kept as a right sidebar here on an explicit product call, not the mockup's own layout. |
| 2xl >= 1536 | Same, content capped at `max-w-[1600px]`, centered, equal margins. |
| md 768-1023 | Single main column, whole page scrolls. Rail becomes a 2-column grid: [Shelf + Circles] \| [Pursuits still moving]. |
| base and sm < 768 | Single column, matching board 5. Margins 16px (20px on sm). Rail order: **Pursuits still moving**, then The Shelf, then Circles. |

**Nav.**
- lg and up: full nav as in the mockup (wordmark, MY SPACE / DISCOVER / MARKETPLACE / SETTINGS, search, "Add a Moment", avatar).
- Below lg: wordmark left; compact "Add a Moment" (icon + label from sm up, icon only on base) and avatar right. The four links move into a menu opened from a menu button (Sheet/Dialog primitive, focus-trapped, closes on Escape and on route change).
- Sticky with a hairline bottom border. No blur, no gradient.

**Header band.**
- lg and up: gold small-caps date eyebrow (`--gold-text`), serif "Good morning, {name}", muted one-line subtitle. Right side: `01-06` numeral + `TODAY'S SHEET`. Numeral in **foreground** color, not accent.
- Below lg: the numeral block moves under the subtitle, left-aligned, smaller, on one line: `01-06 . TODAY'S SHEET`.
- Fluid type with `clamp()`: greeting 28px (phone) to 40px (desktop); Moment caption 20px to 26px; body 15px.
- Use the person's saved timezone for the greeting and "today".

## 2. The sheet (current — replaces the retired contact sheet + Moment panel below)

**Content.** Moments since my last visit from people, Spaces and Circles I follow or joined, max 6 per sheet. **Exclude my own Moments.** Subtitle copy: "{N} Moments from the people and Spaces you follow." (the number is the real total unseen count, not just this sheet's 6).

**Layout, per board 4** — all cards are the shared `MomentCard` (`docs/moment-card-and-reactions-spec.md` §2), `surface="mySpace"`:
- Item 01: `size="lead"`, full width, numbered.
- Items 02-04: a 3-column row, `size="standard"`, numbered.
- Items 05-06: a 1.6fr/1fr row, `size="wide"` then `size="standard"`, numbered.
- Text-only Moments use MomentCard's own rotating color tiles, not a separate thumbnail treatment.
- Fewer than 6 unseen: whichever rows have items render; the rest are simply absent (no placeholder cards).

**Turn the page.** "Turn the page" moves to the *next distinct sheet* of 6 (re-slicing the same already-fetched unseen list — no fetch, never auto-load), not an accumulating "show more." `END OF THE SHEET / You're caught up / Add a Moment` always shows below whatever's currently on screen; "Turn the page" only shows above it when more unseen Moments exist beyond the current sheet.

**Opening one.** `?m=<id>` opens `MomentDetail` over the sheet as a dialog (deep-linkable, shareable) — it is not "which card is selected," since every Moment on the sheet is already its own visible card.

**Mobile:** one column, board 5 — the same responsive grid collapses naturally (Tailwind's `sm:` breakpoints), no separate mobile-only markup needed.

---

*Retired design, kept as history:*

### 2 (retired). Contact sheet

**Frames.**
- Numbered 01-06. Selected frame: accent border and accent name. No decoration on the corner (remove the stray arc).
- Photo Moments: square thumbnail. **Text-only Moments: a typographic thumbnail** (first 5-6 words in tiny Fraunces on a card-colored tile), not a quote icon.
- Meta line may wrap to two lines. **No ellipsis truncation** of meaningful text.
- Keyboard: up/down (left/right in the strip) moves selection, Enter opens. Selection is reflected in the URL (`?m=<id>`), so it survives refresh.

**As a strip below lg.**
- Horizontal scroller, `scroll-snap-type: x mandatory`, `snap-start`, scroll-padding equal to the page margin. Each frame about 200px wide: number and thumbnail left, name + two-line meta right.
- Selected frame stays scrolled into view. Fade on the trailing edge and a small-caps `01 / 06` position label. Hide the scrollbar visually but keep it scrollable by keyboard and touch.
- "END OF THE SHEET / You're caught up" is the last frame in the strip.

### 3 (retired). Moment panel

- Header: maker avatar, serif name, `{Pursuit} . {Corner}` (each links to its page). Right side: visibility label (PUBLIC or the Circle's name) and time.
- Media: full-width image, aspect 4/3 on phone, 3/2 on tablet, mockup ratio on xl. `object-cover`, radius 12px, max height 70dvh. **Text-only Moments:** the text as a large Fraunces italic pull-quote (scales with `clamp()`, left-aligned on phone).
- Italic serif caption under the media.
- Action row: Love this / Count me in / Add a thought (three icon buttons; Love this and Count me in show their public totals even on someone else's Moment — Sept 24, 2026 amendment), Bookmark icon, OPEN. Hover, pressed and active (accent) states; at least 44px touch targets.
- Phone: three equal-width reaction buttons on the first row, Bookmark and OPEN on a second row.

## 4. Right rail

**1. The Shelf.** The colored bars are books. Each spine is a Space I've made Moments in; height reflects my Moment count there. **Every spine has a visible small-caps label** (not hover-only), wrapping only if necessary. Remove the duplicate text list below it, or make the spines the list. A spine links to that part of my Shelf. If the Shelf and Pursuits feel redundant on screen, tell me and propose reducing the Shelf to a small link.

**2. Pursuits still moving** (own Pursuits only).
- Serif heading "Pursuits still moving", muted line "The ones you haven't set down yet."
- A Pursuit is still moving if it had a Moment in the last 60 days. Keep that constant in one place; reuse existing logic if it exists.
- Up to 5, most recently active first. A quiet "See all my Pursuits" link opens a simple list of every Pursuit (including paused ones) using the same component.

`PursuitTrack` component, one per Pursuit:
- Serif name. Small-caps meta: `{SPACE} . STARTED IN {MONTH}` (add the year if not the current one).
- A thin horizontal hairline trail with one small dot per Moment, oldest to newest, evenly spaced, showing the most recent 12. If there are more, show a faint "+ earlier" cue at the left end.
  - Latest dot: filled gold. Others: hollow, muted outline.
  - **Private Moments (Only you) get a dashed outline.** No other color change.
  - Each dot is keyboard focusable. Hover/focus shows date + first words in a small tooltip. Click opens that Moment.
- Muted line: "Last Moment 3 days ago". Neutral wording only: no color change, no warning or nudge after a long gap.
- If the person set a target when creating the Pursuit (for example "thirty bowls") **and that data already exists**, show plain text such as "Bowl 19 of 30". Never show percentages, progress rings, streaks or "days in a row".
- Clicking the name opens the Pursuit view: its Moments in date order, with the same trail across the top.
- Empty state: "No Pursuits yet. Start one from any Moment."
- Data: one query for the Pursuit list plus each one's last 12 Moment dates and visibility. No N+1. Filter by `user_id = current user`. This reads only my own data.
- Use `@container` queries: below about 280px width show the latest 8 dots, at wider widths 12. Names and meta wrap to two lines.

**3. Circles.** Joined and followed Circles: name and member count only. No STEADY/BUSY chips. Name and count on one line; wraps cleanly when narrow.

## 5. Motion

- Trail dots draw in left to right over 500ms, once.
- All of it is disabled (instant) under `prefers-reduced-motion`. No bounce, spring or confetti.
- The retired sheet-fade-in and cross-fade-on-selection animations (above) no longer apply — the current sheet is a static grid of MomentCards; there's no "selected Moment" to cross-fade into.

## 6. Done when

- Screenshots in light and dark at **320, 390, 768, 1024, 1440** (also check 360, 820, 1280, 1920, 200% zoom at 1440, and landscape phone 844x390). Save them to `docs/screenshots/` and show them to me.
- No horizontal page scroll from 320px to 2560px.
- Own Moments excluded; text-only thumbnails are typographic; no meaningful truncation. Test with a 60-character name and a 90-character caption.
- `PursuitTrack` correct for 0, 1, 5, 12 and 40 Moments; private dots visibly dashed.
- Touch targets at least 44px; focus rings visible in both themes; tab order follows visual order (strip, Moment, reactions, rail).
- Tokens only (show the grep for raw hex and `text-white`). Contrast checked in both themes.
- A list of anything you couldn't do because the data model lacks it, and every place you departed from the mockup.
