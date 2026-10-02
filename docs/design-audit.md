# Design audit — P0 Foundations, Phase 0 (Oct 1, 2026)

Read-only inventory of every raw design value the token pass will replace.
Re-run with `python3 scripts/design-audit.py` (`--files` for per-file detail).
Scope: `src/**/*.{ts,tsx,css}` (259 TS/TSX files + 6 CSS files). Counts are
class *occurrences* (one `className` with `sm:rounded-xl rounded-xl` counts
twice), including variant-prefixed ones (`hover:`, `sm:`, `data-[…]:`).
Comments are excluded where they produced false hits (noted below).

## 0. Setup

- **Tailwind v4.1.12** via `@tailwindcss/vite`. There is no `tailwind.config.*`.
  Tokens live in `@theme inline { … }` in `src/styles/theme.css`. Raw values
  sit on `:root`, and dark values sit on **`.dark`** (a class on `<html>`, set
  by an inline script in `index.html` and by `ThemeContext.tsx`). Phase 1
  uses the same mechanism.
- CSS entry: `index.css` imports `fonts.css`, `tailwind.css`, `theme.css` and
  `my-space.css` in that order.
- Two scoped themes override the semantic tokens: `.ns-paper-theme`
  (You/Studio/PublicProfile, which has a `.dark .ns-paper-theme` block) and
  `.ns-space-theme` (the Space page, which has **no dark block**).
- **Tokens that already exist** and overlap with the plan:
  `--radius-btn: 8px` (`rounded-btn`, 21 uses), `--radius-card: 12px`
  (`rounded-card`, 3 uses), `--radius-moment: 22px` (5 uses, MomentCard spec),
  `--radius: 0.875rem` (drives `rounded-sm/md/lg/xl` = 6/10/14/20px), and the
  semantic colors `--foreground`, `--muted-foreground` (alias
  `--foreground-muted`), `--background`, `--surface`, `--card`, `--border`
  (alias `--hairline`), `--accent` and `--input-border`.
- **The `dark:` variant is not wired to `.dark`.** In v4, `dark:` defaults to
  `prefers-color-scheme`, and there's no `@custom-variant dark` in the CSS. The
  one use (`dark:shadow-none` in `ui/card.tsx`) currently follows the OS, not
  the in-app theme toggle.

## 1. Summary

| Area | Count | Breakdown |
|---|---|---|
| **Radius** (TSX classes) | **521** | `rounded-full` 182 · `rounded-2xl` 139 · `rounded-xl` 91 · `rounded-lg` 29 · `rounded-btn` 21 · `rounded-md` 16 · `rounded-3xl` 16 · `rounded` 10 · `rounded-[var(--radius-moment)]` 5 · `rounded-card` 3 · `rounded-t-2xl` 2 · `rounded-none` 2 · arbitrary `[calc(1.5rem-1.5px)]` 2, `[20px]` 1, `[6px]` 1, `t-[4px]` 1 |
| Radius (CSS `border-radius`) | 13 | all in theme.css: `999px` ×6, `0` ×3, `1.75rem` ×2, `0.25rem` ×1, organic `50% 45% 50% 40%` ×1 (wordmark) |
| **Font size** (TSX classes) | **1,148** | Tailwind: `text-sm` 401 · `text-xs` 373 · `text-lg` 43 · `text-2xl` 40 · `text-base` 28 · `text-4xl` 26 · `text-3xl` 22 · `text-xl` 18 · `text-5xl` 12 · `text-6xl` 1 · `text-8xl` 1. Arbitrary (184): `[11px]` 106 · `[10px]` 40 · `[9px]` 7 · `[1.05rem]` 4 · `[19px]` 3 · `[12.5px]` 3 · `[17px]` 3 · `[11.5px]` 2 · `[1.9rem]` 2 · `[1.75rem]` 2 · `[8px]`, `[14.5px]`, `[15px]`, `[2rem]`, `[22px]`, `[42px]`, `[48px]`, `[76px]` 1 each · 3 `clamp()` |
| Font size (CSS) | 25 | theme.css: 0.55, 0.56, 0.6 ×2, 0.62, 0.65, 0.72 ×2, 0.75 ×2, 0.85 ×2, 0.875, 1.6, 2rem; `var(--text-base)` ×4; html `16px`. my-space.css: 1.125rem, 1.375rem |
| **Raw black/white** | **151** | `text-white` 80 (+ `/50…/85` ×13) · `text-black` 2 (+`/40` 1) · `bg-white` 7 (+ opacity ×8) · `bg-black` 1 (+ `/20…/70` ×25) · `border-white/*` 10 · `fill-white` 3 · gradient stops `from/via-black/*` 5 |
| **Color literals** outside theme.css | **49** | 32 hex + 17 rgb/rgba, in 11 files (table §4) |
| **Shadows** | **25 utility + 22 CSS** | Utilities: `shadow-xl` 7 · `shadow-2xl` 5 · `shadow-sm` 3 · `shadow-md` 1 · `shadow-lg` 1 · `shadow-xs` 2 · bare `shadow` 2 · arbitrary ×4. `shadow-none` ×4 not counted. theme.css `box-shadow` ×22, plus 1 `drop-shadow` filter chain (MomentCard icon legibility) |
| **Motion** | see §6 | `duration-*` 31 · `transition*` 217 · CSS/inline ms or s values 63 · 3 `motion` springs |
| **Section spacing** | see §7 | 62 `<section>` tags. Section-scale (≥24px) gap, space-y and margin values use 12 distinct steps |

## 2. Radius

**Containers vs. controls** (a heuristic based on the element tag or an
`onClick` handler, to be confirmed by eye in Phase 2):

| class | container/other | control | img/media |
|---|---|---|---|
| `rounded-2xl` | 119 | 20 | – |
| `rounded-3xl` | 15 | 1 | – |
| `rounded-xl` | 55 | 34 | 2 |
| `rounded-lg` | 5 | 20 | 4 |
| `rounded-md` | 7 | 2 | 7 |

**`rounded-full` (182)**, with the same heuristic:

| bucket | count | notes |
|---|---|---|
| button / link | 76 | 22 of these are **circular icon buttons** (`size-N`, no horizontal padding): CameraCapture ×4, MomentCard ×2, PursuitCard ×2, PursuitItem ×2, Log ×3, Messages ×2, Studio ×2, plus MediaAttachPicker, ProfileLinks, QuietMilestones, WelcomeBanner and AddMoment |
| chip / badge / tag (mostly non-interactive) | 30 | `ui/badge.tsx`, Admin status pills, Space "Host" tag, media-count overlays, QuickLog inline select + input (h-6) |
| icon circles (decorative `size-8…16` containers) | ~30 | Log, BePart, QuietMilestones, Header menu icons, Login, Messages empty state … |
| count badges (notification dots with a number) | 5 | Header ×2, NotificationsMenu, Messages, SpaceHomeTab |
| status dots / progress | 9 | |
| toggle knobs / switch tracks | 8 | `ui/switch`, `pursuit/ui`, GoalDialog ×2, Log ×2 (hand-rolled switches) |
| avatars | 4 + avatar stacks | `ui/avatar` ×2, Thoughts, SpaceHomeTab; overlap stacks in SpacePage and SpaceHomeTab |
| spinners | 3 | Root, PublicProfile, Studio |
| radio dots | 3 | `ui/radio-group`, CreatePursuit ×2 |
| search inputs | 2 | People, SearchResults |
| segmented tablist | 1 | Discover |
| dialog/sheet close buttons | 2 | `ui/dialog`, `ui/sheet` |
| blurred background blobs | 3 | DiscoverHeroArt, GeneratedArt, WorldIllustration |

CSS `999px` pills: `.ns-hero-claims li`, `.ns-hero-secondary-link`,
`.ns-world-card-dot`, `.ns-you-avatar-icon-row button`, `.ns-you-tags a/button`,
`.ns-pill`. CSS `1.75rem` (28px): `.ns-hero-worlds-art`, `.ns-world-card`.

## 3. Type

The proposed scale is 11 / 13 / 16 / 18 / 22 / 28. Mapping today's usage onto it:

| today | uses | nearest step | change |
|---|---|---|---|
| 8–10px (`[8px]` `[9px]` `[10px]`) | 48 | caption 11 | +1 to +3px |
| 11px (`[11px]`), 11.5px | 108 | caption 11 | exact |
| **12px (`text-xs`)**, 12.5px | **376** | caption 11 *or* small 13 | **tie**, ±1px |
| **14px (`text-sm`)**, 14.5px | **402** | small 13 | **−1px** |
| 15–16px (`text-base`, `[15px]`) | 29 | body 16 | |
| 17–19px (`text-lg`, `[17px]`, `[1.05rem]`=16.8, `[19px]`) | 53 | lead 18 | |
| 20px (`text-xl`) | 18 | lead 18 *or* title 22 | **tie**, ±2px |
| 22–24px (`text-2xl`, `[22px]`) | 41 | title 22 | |
| 28–32px (`text-3xl`, `[1.75rem]`, `[1.9rem]`, `[2rem]`) | 27 | display 28 | |
| **36px and up** (`text-4xl`…`8xl`, `[42/48/76px]`, 3 `clamp()`) | **44** | display 28 | **−8 to −48px** |

Large sizes are page titles on ~25 pages (Home ×6, SpacePage ×3, Inbox ×3, and
2 each on the Admin, Shop, People and Log pages …) plus the landing-page hero.

**Form fields:** 124 text inputs, textareas and selects. 6 render below 16px:
`ui/input.tsx` and `ui/textarea.tsx` (`md:text-sm`, so 14px from 768px up,
**including iPad**), QuickLog's `SelectTrigger` (`text-[11px]`), AdminCorners
`<select>`, SpacePage `<textarea>` and `<select>` (`text-sm`). CSS:
`.ns-you-links-row input` is 0.85rem.

**Root size:** `html { font-size: var(--font-size) }` with `--font-size: 16px`.
A px root ignores the browser/OS default-font-size setting, which defeats the
point of rem tokens.

## 4. Color literals outside theme.css

| file | hex | rgb(a) | what they are |
|---|---|---|---|
| `components/subart/palette.ts` | 13 | – | JS copy of the `--gen-art-*` illustration palette (light values only). `DENIM_LIGHT #89A6BC` has no CSS counterpart |
| `settings/AppearanceSection.tsx` | 9 | – | System/Light/Dark preview swatches. They are literal copies of the light and dark `--background`/`--card`/`--accent` values |
| `MomentCard.tsx` | 3 | 3 | `#fff` icon/text color over media ×3; `rgb(0 0 0/…)` drop-shadow chain ×3 (icon legibility on photos) |
| `WorldIllustration.tsx` | 4 | – | `#1b2733`, bronze `#8A6A49` and `#6B4E35` (= `--wood-light`/`--wood`), `#8B5A3C` (= `--gen-art-skin-3`) |
| `pages/Onboarding.tsx` | – | 4 | photo scrim gradient ×3 stops, chip border `rgba(255,255,255,.4)` |
| `CoverEditor.tsx` | – | 3 | overlay fills and borders on the cover photo |
| `pages/Studio.tsx` | – | 3 | photo scrim gradient |
| `GeneratedArt.tsx` | 2 | – | `#B9A4CE` (lavender, no token), `#8B5A3C` (= skin-3) |
| `space/SpaceHomeTab.tsx` | – | 2 | inside arbitrary `shadow-[…]` |
| `HobbyShelf.tsx` | 1 | – | `INK = "#3A2A1F"` (= `--gen-art-ink`) |
| `PursuitItem.tsx` | – | 2 | inside arbitrary `shadow-[…]` (rest + hover) |

theme.css itself also has raw `rgba()` inside `box-shadow`s (`.glow-*`,
`.ns-value-card`, `.ns-world-card`, `.ns-discover-space-card`,
`.ns-hero-worlds-art`). Those are in scope for the shadow sweep, not the hex
sweep.

## 5. Shadows — 25 utility sites + 22 CSS declarations

| target | sites |
|---|---|
| **overlay** (popovers, menus, dialogs, sheets, tooltips) | `ui/dialog` 2xl · `ui/sheet` 2xl · `ui/select` 2xl · QuickLogGlobalSheet 2xl · Header mobile menu 2xl · Header dropdown lg · PersonActionsMenu xl · NotificationsMenu xl · PursuitDialog xl · CornerTagField, InterestField, TagsField, PursuitField suggestion lists xl ×4 · PursuitTrack tooltip sm · MomentCard tooltip md |
| **card** | `ui/card` (already uses the brief's value as an arbitrary + `dark:shadow-none`) · PursuitItem arb · SpaceHomeTab arb ×2 · MomentCard kicker sm |
| **controls, which are neither card nor overlay** | `ui/switch` root xs + knob sm · `ui/radio-group` xs · `pursuit/ui` knob · Messages "new messages" pill |
| **CSS (theme.css)** | 22 declarations across ~20 `.ns-*` and `.glow-*` rules (cards, value cards, world cards, discover cards, hero art, marquee, invitation spark, paper panels). Most are violet-tinted leftovers from the retired theme |

## 6. Motion

- **`duration-*` (31):** 150 ×2 · 200 ×8 · 300 ×10 · 500 ×7 · 700 ×1 ·
  `[700ms]` ×3 (image zoom on HobbyCategoryCard ×2 and WorldIllustration).
- **`transition*` (217):** `transition-colors` 148 · `transition-transform` 23 ·
  `transition` 12 · `transition-opacity` 11 · `transition-all` 6 · arbitrary
  property lists 13 · `transition-none` 4. Most rely on Tailwind's default 150ms.
- **Easing:** `ease-out` 15, `ease-in-out` 1. CSS uses `cubic-bezier(.22,.61,.36,1)`
  ×8 (enter/reveal/cards) and `ease`/`ease-out` elsewhere.
- **CSS ms values (theme.css, 56):** hover 180ms ×6, 260ms ×3, 280ms ×5, 300ms ×2,
  340ms ×2. Enter/reveal `.62s`, `.7s` ×2, `.5s` ×2, with stagger delays of
  45–220ms. Theme cross-fade 400ms ×7. Ambient infinite loops 1.6s–34s ×17
  (breathe, sway, drift, twinkle, marquee, float).
- **Inline in TSX:** HoldToShareButton `120ms` (progress fill), You.tsx `280ms`
  + `200ms` (accordion), PursuitTrack `ns-rise 500ms` + 30ms stagger,
  ThemeContext `setTimeout(…, 420)` (paired with the 400ms cross-fade).
- **`motion` library:** 3 spring transitions (Onboarding, Log, Studio). They
  have no duration and already zero out under reduced motion in Onboarding.
- **Hover:** v4 already wraps `hover:` utilities (252 uses) in
  `@media (hover: hover)`. The ~15 hand-written `:hover` rules in theme.css are
  **not** wrapped.
- Reduced motion: theme.css already has two `prefers-reduced-motion` blocks,
  including a global `transition-duration: .01ms`.

## 7. Section spacing

Spacing on the 62 `<section>` wrappers: `py-20` ×5 / `lg:py-28` ×5 (landing),
`mb-6` ×4, `mb-10` ×4, `mb-8` ×2, `pt-7` ×2, then one each of `py-10`, `py-12`,
`sm:py-12`, `sm:py-14`, `pt-6`, `pt-8`, `pt-14`, `pt-16`, `lg:pt-20`, `pb-4`,
`pb-24`, `mb-11`, `mb-14`, `mb-16`, `lg:pb-8`.

Section-scale values (≥24px) anywhere: `mb-6` 59 · `mb-8` 22 · `mt-6` 19 ·
`mb-10` 12 · `gap-6` 8 · `mt-8` 8 · `mb-7` 5 · `space-y-8` 4 · `mb-14` 4 ·
`gap-y-8` 4 · `space-y-6` 3 · `mt-10` 3 · `gap-10` 3 · `space-y-10` 2 ·
`mb-16` 2 · `lg:mb-12` 2 · `gap-8` 2 · plus singletons `mb-9`, `mb-11`, `mb-12`,
`mt-7`, `mt-12`, `space-y-7`, `lg:gap-12`, `md:gap-20`. That is **12 distinct
steps** (24, 28, 32, 36, 40, 44, 48, 56, 64, 80, 96, 112px, counting section padding), against the brief's
8px base (24/32/48/64/96). my-space.css uses `2rem`, `24px` and `32px` gaps.

## 8. Cross-device baseline (today)

- Viewport meta: `width=device-width, initial-scale=1.0`. **No `viewport-fit=cover`.**
- No `text-size-adjust` and no font-smoothing rules.
- Heights: `min-h-screen` ×36 (100vh), one `100vh` in CSS (`.ns-worlds-sticky`),
  and `100dvh` ×2 (my-space.css).
- Safe-area insets are used in only 4 files (BottomTabBar, PreviewBanner,
  AddMoment, CreatePursuit). Another 13 files render `fixed` elements without
  them (dialog, sheet, QuickLogGlobalSheet, BadgeUnlockToast,
  HoldToShareButton, CoverEditor, Home, You, Log, Onboarding …).
- Fonts: one Google Fonts `@import` with `display=swap` loads **7 families**
  (Space Grotesk, Inter, JetBrains Mono, Fraunces, Work Sans, Caveat,
  Instrument Serif). Fallbacks are generic only (`'Inter', sans-serif`), with
  no metric-matched fallback stack.

## 9. Ambiguous mappings — decisions needed before Phase 1/2

1. **Type scale vs. the two dominant sizes.** `text-sm` (14px, 401) and
   `text-xs` (12px, 373) make up 67% of all sizes, and neither is on the scale.
   As proposed, 14→13 shrinks 401 sites, and 12px is equidistant from 11 and 13.
   **Proposal (no 7th step):** caption **12px / 0.75rem**, small
   **14px / 0.875rem**. Then 774 sites map exactly, and everything at 8–11px
   bumps up, which follows the "don't shrink back down" rule. The trade-off is
   that the 11px tier (108 sites) grows by 1px. Alternative: keep 11/13 and
   decide the tie (12→13 is the non-shrinking choice).
2. **`text-xl` (20px, 18 sites)** sits exactly between lead 18 and title 22.
   Suggest title (no shrink).
3. **Display sizes above 28px (44 sites).** Landing hero and page titles at
   36–76px would drop to 28px. Map them all to `text-display`, or keep a
   fluid `clamp()` for the marketing hero only?
4. **Existing `rounded-btn` (21) vs. the new `rounded-control`.** Replace it
   (and delete `--radius-btn`), or keep it as an alias?
5. **`--radius-moment: 22px`** (MomentCard media, set by
   `docs/moment-card-and-reactions-spec.md`). Fold it into `rounded-card`, or
   keep it as a spec'd exception?
6. **`rounded-full` outside the three allowed uses:** 22 circular icon buttons,
   ~30 decorative icon circles, 5 count badges, 30 chips/badges/tags, 3
   spinners, 3 radio dots, 2 search inputs, the Discover segmented tablist, the
   dialog/sheet close buttons, and 3 blurred blobs. The literal rule makes all
   of them 8px squares. Suggest keeping `rounded-full` for spinners, radio
   dots, count badges and blobs (geometry, not "pills"). Icon buttons, chips,
   search inputs and the tablist would go to `rounded-control`. Icon circles
   are your call.
7. **Shadows: 25 + 22 sites, not 19.** Switch/radio `shadow-xs`, the toggle
   knobs and the Messages pill are neither card nor overlay. Suggest dropping
   control shadows (or treating knobs as the knob exception). The 22 CSS
   shadows on the legacy `.ns-*` landing rules are mostly violet-tinted. Map
   them to `shadow-card`, or leave the landing page for its own pass?
8. **`text-white` on accent fills (~46 of 95).** Most sit on
   `bg-[var(--coral-deep)]` or `--gradient-brand`, not on `--accent`. The
   semantic swap is `text-accent-foreground`, but that token is dark in dark
   mode while `--coral-deep` doesn't change, so the swap would put dark text
   on coral. Either repoint these fills to `bg-accent` at the same time, or add
   an `--on-coral` token. (~26 more are over media and ~23 need a look,
   mostly CameraCapture, CoverEditor, HobbyCategoryCard, Onboarding and Studio
   photo overlays, which will go to `text-on-media`.)
9. **Color reuse names.** `--fg/--fg-muted/--bg` already exist as
   `--foreground/--muted-foreground/--background`, so Phase 1 adds no new
   names for them. `--surface` and `--card` are both live; plan: `--surface`
   is canonical and `--card` stays an alias.
10. **`bg-scrim` is a gradient**, so it can't be a `--color-*` token. Phase 1
    will add it as an `@utility bg-scrim { background-image: var(--scrim) }`
    instead. Flagging it so it isn't a surprise.
11. **Hex list is wider than the brief's four files.** Also present:
    `subart/palette.ts` (13, a JS mirror of `--gen-art-*`), MomentCard (6),
    Onboarding (4), CoverEditor (3), Studio (3), and shadow arbitraries in
    SpaceHomeTab (2) and PursuitItem (1). Include them in sweep 5?
12. **Motion durations.** `docs/CLAUDE-redesign-brief.md` §73 says
    500–700ms for page/panel transitions, but this task says 250ms. I'll
    follow this task unless told otherwise. Out of scope as I read it: ambient
    infinite loops (1.6–34s), the 400ms theme cross-fade (specified in the
    brief), the motion-library springs, and the 700ms image zoom (move it to
    `duration-base`?).
13. **Section spacing has no token in Phase 1.** The task inventories it but
    defines no spacing scale. Add `--space-section` (e.g. 32px mobile and
    48px desktop) to Phase 1, or leave spacing for a later pass?
14. **Root font size.** Change `--font-size: 16px` on `html` to `100%`, so rem
    tokens follow the browser/OS default size? This changes rendering for
    users with a non-default setting, which is the intent.
15. **`dark:` variant.** Add `@custom-variant dark (&:where(.dark, .dark *));`
    in Phase 1 so `dark:` follows the app toggle. It touches one existing use.
16. **`.ns-space-theme` has no dark values.** "Identical in both modes"
    doesn't hold on the Space page today. In scope here, or a separate pass
    ("Spaces stays out of this round" per theme.css)?
17. **Locking the scale.** After Phase 2, reset Tailwind's defaults
    (`--text-*: initial`, `--radius-*: initial`, `--shadow-*: initial`) so
    off-scale classes stop compiling? It can't happen in Phase 1 without
    breaking every unswept screen.

## 10. Phase 4 lint guard — rule list

`scripts/design-audit.py` stays a counter. The guard is a separate Phase 4
deliverable that fails CI; these are the rules it has to enforce (one per
decision above). Not implemented yet.

| rule | flags | allowed |
|---|---|---|
| viewport height | `h-screen`, `min-h-screen`, `max-h-screen` in TS/TSX | `h-viewport`, `min-h-viewport` |
| viewport height | any `100vh` in TS/TSX | — |
| viewport height | a CSS `100vh` height/min-height | only as the fallback line directly before a matching `100dvh` line |
| type scale | `text-xs/sm/base/lg/xl/2xl…9xl`, `text-[Npx]`, `text-[Nrem]` | `text-caption/small/body/lead/title/display` |
| hero type | `text-hero` | `src/app/pages/Home.tsx` only |
| radius | `rounded-sm/md/lg/xl/2xl/3xl/btn`, `rounded-[…]` (media up to 96px square is control, larger is card; see the brief) | `rounded-card`, `rounded-control`, `rounded-full` (avatars, dots, knobs, spinners, radio dots, count badges, blobs, decorative icon circles), `rounded-none` |
| shadow | `shadow-xs…2xl`, bare `shadow`, `shadow-[…]` | `shadow-card`, `shadow-overlay`, `shadow-none` |
| raw color | `text-white/black`, `bg-white/black` (+ opacity), `border-white/*`, hex/rgb/hsl literals outside theme.css | `text-on-media`, `text-on-brand`, semantic tokens |
| motion | `duration-<n>` / `[Nms]`, inline ms values | `duration-fast`, `duration-base`; lines marked `// design-token-ignore: <reason>` |

## 11. Phase 2 outcome (Oct 2, 2026)

Counts from `scripts/design-audit.py`, at the start of Phase 2 and now:

| | start | now |
|---|---|---|
| raw `text-white/black`, `bg-white/black`, `border-white`, `fill-white` | 151 | **0** |
| hex literals outside theme.css | 32 | **0** |
| rgb/hsl literals outside theme.css | 17 | **0** |
| raw text sizes (`text-xs…9xl`, `text-[Npx]`, CSS `font-size`) | 1,148 | **0** (all on the scale) |
| off-scale radius classes | ~450 | **0** (228 card, 214 control, 70 round) |
| raw shadows (utility, arbitrary, CSS) | 37 | **0** (24 `shadow-card`/`shadow-overlay`) |
| raw `duration-<n>` and inline durations | 31 + ms values | **0** (25 fast, 12 base; marked exceptions only) |
| interactive elements below 44×44 on touch (375px) | 444 | **0** |

### Tokens added beyond the Phase 1 spec

- `--scrim-solid` (pure black, strength set per use: `bg-scrim-solid/60`) for
  chips and buttons over media, modal backdrops, the viewfinder. The `--scrim`
  gradient is for full-bleed text overlays.
- `--theme-{light,dark}-{bg,card,accent}`: the two themes' key colours, declared
  once; `:root`, `.dark` and the Settings > Appearance swatches all read them.
- `--gen-art-denim-light`, `--gen-art-lavender`, `--gen-art-night` (with dark
  values). The illustration palette lives in CSS only; `subart/palette.ts` is
  `var()` references and `GeneratedArt.tsx` re-exports them.
- `@utility` `min-h-viewport`, `h-viewport` (100dvh, 100vh fallback), `icon-halo`.
- A dark-elevation base rule: `.dark :is(.shadow-card, .shadow-overlay)` gets
  `--surface` and a 1px `--border`.
- A touch-target base rule under `(pointer: coarse)`: a 44×44 invisible `::after`.

### Rules decided during the sweep

- Media up to 96px square is `rounded-control`; larger is `rounded-card`.
- Dark shadow tokens are `0 0 #0000`, never `none` (Tailwind composes shadows in
  a list, where `none` invalidates the whole declaration).
- Text-only Moment tile captions are `text-lead`, not `text-title`: 22px showed
  50–56% of a typical note on the smallest tiles, 18px shows 56–71%.
- Every truncated string carries a `title` with its full text.
- Explicit exceptions carry `design-token-ignore: <reason>`: the camera shutter
  and library buttons, the shelf spine, the 400ms theme cross-fade and its
  timer, every ambient loop, stagger delays, and the three motion springs.

### Touch targets: neighbouring hit areas that overlap

All elements have a 44×44 hit area. Where two are closer than that, their areas
overlap and the later one in the DOM wins the overlap. Measured at 375px; this
is the list to review by hand on a device.

| overlap | between |
|---|---|
| 20px | You header: "LOG A MOMENT" and "PUBLIC SCRAPBOOK ↗" (stacked 17px caption links) |
| 17px | Log form: "Everyone" and the inline "Open the full form" link |
| 15px | Log form: "Add a Corner" / "Followers", and "Only you" / "Everyone" (23px chips) |
| 14px | Header: avatar link and "Account menu" chevron |
| 14px | You header: "Change photo" and "Take photo" (26px buttons) |
| 11px | Log form: "Pursuit" select and "Add a Corner" |
| 9px | You tags: "pottery" and "Add a tag" |
| 5px | Discover filters: "New today" and "Pursuits in progress" |
| 4px | Pursuit actions: "Full form", "Reached it", "Rest it", "Send to…", "Make private"; Space events: "RSVP" and "Cancel event" |
| 2px | Header: "Notifications" and avatar link; Pursuit cadence: "Weekly" and "Never" |

Inline text links inside a paragraph are exempt (44px around a line of prose
would cover the lines above and below).
