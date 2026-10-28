# Soosh visual spec v1: "After hours" (for Claude Code)

Approved by the founder on Oct 22, 2026. **This replaces every visual decision in `#179` and `#181` on Discover**, and sets the look for the rest of the app. Follow it exactly. Do not interpret, soften or add your own touches. If something here is impossible, stop and ask; do not substitute.

All CLAUDE.md rules still apply: one PR, never merge, copy rules, no member counts.

> **Oct 28, 2026 note:** `claude-code-brief-core-loop-v1` and `docs/design/core-loop/` now set the screens for Discover, Corner pages and the core loop. This spec still sets the tokens: colours, fonts, type scale, shape and motion basics. Where the two differ on a screen's layout, the core loop wins.

---

## 1. Global

### 1.1 Theme
- **Dark is the default for the whole app** whenever the person's preference is "system". Remove the per-page `setDarkByDefault` from #179, so the app never flips between pages.
- Light stays as an explicit choice in Settings, using the light values below.

### 1.2 Colour tokens (put in `src/styles/theme.css`, replace the old values)

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `--background` | `#0E0D0C` | `#F7F5F2` | Page |
| `--surface` (`--card`) | `#171514` | `#FFFFFF` | Cards, sheets, inputs |
| `--surface-raised` | `#201D1B` | `#FFFFFF` | Hover, menus |
| `--border` | `rgba(255,255,255,0.08)` | `rgba(14,13,12,0.10)` | Hairlines only |
| `--foreground` | `#F4EFE8` | `#0E0D0C` | Text |
| `--muted-foreground` | `#A39A90` | `#6B635B` | Secondary text |
| `--accent` | `#FF6B4A` | `#FF6B4A` | Primary buttons and the active tab only |
| `--accent-foreground` | `#0E0D0C` | `#0E0D0C` | Text on accent. Never white: white on coral fails contrast |
| `--accent-text` | `#FF6B4A` | `#C2391B` | Accent-coloured text links. Check that light is ≥ 4.5:1 and darken if not |
| `--ink` | `#0E0D0C` | `#0E0D0C` | Text on category colours, both themes |

**Category colours**: vivid, the same in both themes. Text on them is always `--ink`; every pair below is ≥ 6:1. (See the v1.1 addendum for the current values.)

| Token | Hex |
|---|---|
| `--cat-rose` | `#FF5C8A` |
| `--cat-orange` | `#FF8A3D` |
| `--cat-violet` | `#9B7BFF` |
| `--cat-blue` | `#4C93FF` |
| `--cat-amber` | `#FFB224` |
| `--cat-lime` | `#B6E04A` |
| `--cat-teal` | `#22C7B0` |
| `--cat-pink` | `#F27BD1` |

**Category to colour** (set so that no two neighbours in a 4-column grid match):

| # | Category | Colour |
|---|---|---|
| 1 | Yarn and fabric | rose |
| 2 | Crafts and DIY | orange |
| 3 | Art and design | violet |
| 4 | Tech and tinkering | blue |
| 5 | Food and drink | amber |
| 6 | Running and fitness | lime |
| 7 | Sports and martial arts | teal |
| 8 | Dance and stage | pink |
| 9 | Outdoors and adventure | teal |
| 10 | Home and garden | rose |
| 11 | Games and puzzles | blue |
| 12 | Music and sound | violet |
| 13 | Photo and film | orange |
| 14 | Reading and writing | violet |
| 15 | Skills and side projects | lime |
| 16 | Collecting and style | pink |
| 17 | Culture and community | blue |
| 18 | Rest and ritual | teal |

A Corner uses its category's colour. **Delete** the old muted palette (slate blue, plum, forest, mustard), every 12% pastel tint, and the per-Corner `cornerColorFor` hues on Discover.

### 1.3 Fonts
- **Display: Bricolage Grotesque** (Google Fonts, variable, weights 600 to 800). Use it for page titles, section titles, tile names and the Corner title. Load it the same way the app loads its current fonts, with fallback `ui-sans-serif, system-ui, sans-serif`.
- **Text and UI: Inter**, already loaded. Use it for everything else.
- **Remove Instrument Serif and Fraunces from Discover and Corner pages.** Leave other pages for a later PR, but use no serif anywhere new.
- No italics, no monospace, no uppercase.

### 1.4 Type scale (map onto the existing seven size tokens)

| Token | Mobile | Desktop | Font | Weight | Line height | Tracking |
|---|---|---|---|---|---|---|
| `text-display` (page title, Corner title) | 36px | 56px | Bricolage | 800 | 1.0 | -0.02em |
| `text-title` (section titles) | 24px | 28px | Bricolage | 700 | 1.15 | -0.01em |
| `text-lead` (tile names, the step on cards) | 18px | 20px | Bricolage | 700 | 1.2 | -0.01em |
| `text-body` | 15px | 16px | Inter | 400 | 1.5 | 0 |
| `text-small` (names, meta) | 14px | 14px | Inter | 500 | 1.4 | 0 |
| `text-caption` (chips, labels) | 12px | 13px | Inter | 600 | 1.3 | 0.01em |

Nothing goes below 12px.

### 1.5 Shape, space, depth
- Radius: `rounded-card` = **16px** (cards, tiles, photos), `rounded-control` = **12px** (buttons, inputs, chips). Avatars stay round. (The core loop brief makes primary buttons and chips full pills.)
- Spacing on a 4px grid. Page side padding is 16px on mobile and 32px on desktop. The content max-width is 1200px, centred.
- Gaps: **48px between sections on desktop and 40px on mobile.** 16px between a section title and its content. 12px between cards on mobile and 16px on desktop.
- No shadows in dark mode. Light mode cards get `0 1px 2px rgba(14,13,12,0.06)`.

### 1.6 Motion (`motion`, already installed)
- **Press:** anything tappable scales to 0.97 on press, using a spring with `stiffness: 500, damping: 30`.
- **Hover (desktop):** tiles and cards scale to 1.02 with the same spring. No lift shadows.
- **Section entry:** fade from 0 to 1 and rise 12px to 0 over 280ms, `ease-out`, with a 40ms stagger between items. Once only, never on scroll back.
- **Remove `BlurText`.** Keep `BlurFade` only if it matches the entry above; otherwise replace it.
- Under `prefers-reduced-motion`, everything becomes opacity-only or none.

---

## 2. Discover (Corners tab), top to bottom

*Superseded for layout by the core loop (screen 02). Kept for the card and tile rules.*

### 2.1 Header
- **One search only:** the one in the top bar. Delete the big underlined search on Discover. On mobile, where there's no top-bar search, keep one 44px search field: `--surface` fill, 12px radius, no underline.
- The tabs (Corners, Spaces, People) stay as they are: Inter 15px 600, with a 2px `--accent` underline on the active tab.
- Delete the "Popular Moments from across Soosh" kicker line above Spotlight.

### 2.2 Got 15 minutes?
- Title: "Got 15 minutes?" (`text-title`).
- A horizontal scroll row with snap. The last card peeks in on the right.
- **Card:** 280×184 on desktop, 248×176 on mobile.
  - `--surface` fill, 1px `--border`, 16px radius, 20px padding.
  - **Top:** an 8px dot in the Corner's category colour, 8px gap, then the Corner name in `text-caption`, `--foreground`.
  - **Bottom, pinned:** the step in `text-lead` (Bricolage 700), `--foreground`, at most 3 lines. Don't truncate; pick steps that fit.
  - Optional: a 4px bar in the category colour across the top edge of the card.
- No two cards of the same category next to each other.
- Use a non-breaking space between a number and its unit ("1 minute", "15 minutes").

### 2.3 Spotlight
- Title "Spotlight" on the left, "See all" on the right (`text-small`, `--accent-text`).
- Row of cards: 4:5 ratio, 240px wide on mobile, 4 across on desktop, 16px radius.
- **Photo Moments:** the photo fills the card. A bottom scrim, `linear-gradient(to top, rgba(14,13,12,0.85), transparent 55%)`, with the caption (`text-small` 600, `#F4EFE8`, 2 lines max) and the maker's avatar (20px) and name (`text-caption`, `#A39A90`) over it, 14px from the edges.
- **Text-only Moments:** the card fill is the Moment's category colour. The text is in Bricolage 700 at 22px, `--ink`, left-aligned, up to 6 lines. The maker's name is underneath in `--ink` at 70% opacity. **No more black boxes.**

### 2.4 Browse
- Title "Browse" on the left, "See all" on the right. It shows the first 8 categories; "See all" shows all 18.
- **Grid:** 4 columns on desktop, 2 on mobile. Gap 16px desktop, 12px mobile.
- **Tile:** height 132px on desktop and 112px on mobile. 16px radius, and `overflow: hidden`.
  - **Fill:** the solid category colour.
  - **Name:** top-left, 16px in, `text-lead` (Bricolage 700), `--ink`, up to 2 lines.
  - **No description line.** Delete it, and its "…".
  - **Art:** the category's lucide icon at **64px**, `--ink` at 22% opacity, rotated 15°, anchored bottom-right so it bleeds about 12px off both edges. Later this becomes the newest Moment photo, tilted the same way.
  - **Delete** the coloured rule lines and the small corner icons.
- Tapping a tile opens the category page, with the tile-to-header view transition from Step 7.

### 2.5 Everything below Browse (All Moments)
Use the same Spotlight card rules in a grid: 2 across on mobile and 4 across on desktop.

---

## 3. Corner page (same rules)

*Superseded for layout by the core loop (screen 03). Kept for the header band rules.*

- **Header band:** full width, in the category colour, with 32px padding (48px on desktop).
  - A back link in `--ink` at 70% opacity, `text-small`.
  - The Corner name in `text-display`, `--ink`.
  - The description in `text-body`, `--ink` at 80% opacity.
- **First-step card:**
  - `--surface`, 20px padding.
  - The step in `text-lead`.
  - "Start a Pursuit" fills the width on mobile: 48px tall, `--accent` with `--accent-foreground`.
  - "Log a Moment" is a 48px secondary button: 1px `--border` and `--foreground` text.
- **Moments:** the newest one is full width at 4:5 on mobile and 16:9 on desktop. The rest use the Spotlight card grid.

---

## 4. Done when

1. Light vs dark: 0 hex values outside `theme.css`, and `npm run lint` passes.
2. Screenshots: Discover and the Crochet Corner at 390px and 1440px, dark and light, with real data **and** with the example-data preview.
3. Text: no "…" anywhere on Discover, no text under 12px, no serif or italic on these two pages, one search field.
4. Contrast: every text and background pair in §1.2 checked by script and listed in the PR. All ≥ 4.5:1, or ≥ 3:1 for text 24px and up.
5. Then stop for review. Don't roll the look out to other pages yet.

---

# v1.1 addendum (Oct 22, 2026): moods and calmer colours

Applies on top of v1. It needs PR #184 merged first, because #184 adds the data in `src/app/data/moods.ts`.

## A. "What are you in the mood for?" replaces the single "Got 15 minutes?" row

**Why.** Discover only offered "Got 15 minutes?". The founder's idea was recommendations by mood, time and type. The activity library already records facts about each activity, so the moods are built from those facts. They name what you'd be doing, never how it will make you feel (trust rules 2 and 3).

**Layout:** at the same position as the old row.
- **Title:** "What are you in the mood for?" (`text-title`).
- **Chip row:** directly under the title. It scrolls horizontally, with no wrapping and no scrollbar.
  - **Chips, in this order:**
    1. "15 minutes" (selected by default; it uses `quickGuides()`)
    2. "Make something"
    3. "Move"
    4. "Be around people"
    5. "Some time to yourself"
    6. "Get outside"
    7. "Learn something"
    8. "Play a game"
    9. "Start with what you have"
  - **Chip:** 40px tall, 16px side padding, `rounded-control`, Inter 14px 600.
    - Off: `--surface` fill, 1px `--border`, `--foreground` text.
    - On: `--foreground` fill, `--background` text.
    - Press spring as in §1.6.
- **Card row:** under the chips, 16px gap. It uses exactly the v1 §2.2 card (dot, Corner name, step in Bricolage). It shows the selected mood's Corners from `cornersForMood()`, at most 10, never two of the same category next to each other.
  - Switching chips cross-fades the row (150ms opacity) and scrolls it back to the start.
  - Remember the chosen chip across Back with `useHistoryState("discover.mood")`.
- **Tapping a card** opens the Corner. It opens the Step 3 sheet once that exists.
- **Glossary:** the title and the eight chip labels are new wording. Add them to `docs/glossary.md` in this PR, under a "Moods" heading. Founder approval is given by this spec.
- **Do not** add mood words anywhere else, show counts on chips, or save moods to the database.

## B. Calmer, even category colours

**Why.** In v1 the eight colours have uneven intensity. Lime and pink shout and blue recedes, which reads as candy, especially in light mode. These replacements have the same lightness and saturation (OKLCH L 0.74, C 0.13), so no tile outshouts another. Text stays `--ink`, and every pair is ≥ 7.9:1.

| Token | v1 | **v1.1** |
|---|---|---|
| `--cat-rose` | `#FF5C8A` | **`#EF869B`** |
| `--cat-orange` | `#FF8A3D` | **`#EE8F63`** |
| `--cat-amber` | `#FFB224` | **`#D7A03D`** |
| `--cat-lime` | `#B6E04A` | **`#93BA5C`** |
| `--cat-teal` | `#22C7B0` | **`#04C5B5`** |
| `--cat-blue` | `#4C93FF` | **`#6BAFFA`** |
| `--cat-violet` | `#9B7BFF` | **`#B199F4`** |
| `--cat-pink` | `#F27BD1` | **`#E488BE`** |

Keep the category-to-colour map from v1. Don't change anything else.

## C. Done when
- Screenshots of Discover at 390 and 1440, in dark **and** light, with "15 minutes" selected and with "Make something" selected.
- The contrast script is re-run for the new colours, with results in the PR.
- Then stop for review.
