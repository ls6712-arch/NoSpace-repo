# My Space rebuild — deviations and data-model gaps

Per `docs/my-space-spec.md` section 6's "Done when": everywhere this build
departed from the mockup or spec text, and everything it couldn't do
because the data model doesn't have it yet. Compiled from every stage's
commit notes.

## Departures from the mockup / spec text

- **Nav below `lg` (spec section 1).** No hamburger/menu nav was built. The
  app already has a working answer for "reach every section on a small
  screen" — the global `BottomTabBar` (`Root.tsx`, rendered on every page) —
  so this doesn't duplicate that chrome with a second nav pattern.
- **Sticky reaction row (spec section 3).** Implemented as the spec's own
  named fallback: a normal inline/two-row layout (three equal buttons on
  their own row on phone, one wrapping row from `sm` up), not
  `position: fixed`. A truly sticky bar would compete with `BottomTabBar`
  for the same viewport edge on phone.
- **Container queries (spec section 4.2, "use `@container` queries").**
  Implemented with a `ResizeObserver`-based `useNarrow` hook
  (`PursuitTrack.tsx`) instead of literal CSS `@container`, since the same
  measurement also decides how many dots to *render* (8 vs. 12), not just
  how they're styled — a slicing decision JS already owns.
- **The Shelf (spec section 4.1 + mockup).** The mockup shows colored spines
  next to a separate list of titles, which would duplicate the same
  information twice. Built as one merged list instead — each row is both
  the spine-color swatch and the label/count — reusing the app's existing
  Shelf concept (`useSessionsByHobby()`) rather than inventing a new
  Space-level grouping.
- **Circles (spec section 4.3).** Spec text says "joined and followed
  Circles"; only "joined" exists in this codebase
  (`useCircles().myRealCircleIds`) — there's no separate "follow a Circle
  without joining" concept anywhere. Shows joined Circles only. No
  STEADY/BUSY chips, per the spec text overriding the mockup.
- **Header numeral color (spec section 1 overriding the mockup).** Numeral
  rendered in the foreground color, not the mockup's warmer accent-like
  tone, per the spec's explicit instruction. Below `lg` it relocates under
  the subtitle on one line rather than keeping the mockup's two-column
  band, since that band doesn't fit a narrow viewport.
- **Mockup file extension.** Saved as `docs/mockups/my-space-dark.jpg` (its
  real format) rather than the spec's literal `.png` naming.
- **Sheet-item entrance motion duration (spec section 5 says only the 40ms
  stagger).** Used a 300ms fade+rise per item, matching the panel
  cross-fade's duration since the spec doesn't specify one for the sheet.

## Data-model gaps found (and what was added to cover them)

Each is a minimal, reuse-first addition — no new tables, per the spec's
"reuse what exists, report anything missing" rule:

- **No bulk "who do I follow" query** existed. Added `fetchFollowingIds()`
  to `lib/profileFollows.ts`, reusing the existing `profile_follows` table.
- **No "since last visit" tracking** existed anywhere. Added
  `lib/mySpaceVisit.ts`, a localStorage marker — not a new table, since
  nothing else in the app needed this to be synced or multi-device.
- **No query joins a Moment to its author's Pursuit title.** Added
  `lib/pursuitTitle.ts`, a small on-demand, cached lookup against the
  existing `public.pursuits` table.
- **`data/circles.ts`'s `circles` array is empty** (removed in an earlier,
  unrelated commit before this work started). `CirclesRail.tsx` correctly
  reads from `CirclesContext`'s `useCircles()` instead of that dead array.

## Verification constraints (sandboxed environment)

This dev sandbox has no outbound network access and no way to sign in, so
`MySpaceGrid`'s real data path (`publicFeed` filtered by who you follow/have
joined) is always empty when loaded directly. Two things followed from that:

- The 320/390/768/1024/1440-in-both-themes screenshot matrix
  (`docs/screenshots/my-space-*.png`) was taken against the page's real,
  empty state (no signed-in session), confirming breakpoint structure and
  the complete absence of horizontal scroll from 320px up through 2560px,
  plus the spec's extra checks (360, 820, 1280, 1920, landscape phone
  844×390, and an approximated 200%-zoom-at-1440 viewport) — but not what a
  populated contact sheet looks like scrolling in practice.
- To still verify the things that need real content — a 60-character name
  and a 90-character caption with no meaningful truncation, the private
  dashed dot, and `PursuitTrack` at exactly 0/1/5/12/40 Moments — a
  throwaway fixture route rendered `ContactSheet`, `MomentPanel` and
  `PursuitTrack` directly against hand-built fixture data (bypassing
  Supabase/auth entirely). Screenshots were taken in both themes, then the
  fixture route, page, and the temporary auth bypass were all deleted; none
  of it shipped. Confirmed: the long name and caption wrap fully with no
  CSS truncation anywhere text is meant to be complete; the typographic
  thumbnail box does not overflow at 8px/leading-tight; the private dot
  renders dashed in both themes at 5, 12 and 40 Moments; `PursuitTrack`
  shows every dot at 0/1/5/12 Moments and correctly caps to 12 with a
  "+earlier" marker at 40; focus rings are visible in both themes; and the
  reaction buttons, Bookmark, frame buttons and OPEN link all measure at
  least 44×44px.
- Tab order across the page's three major regions (strip → Moment →
  reactions → rail) follows DOM/source order, which matches visual order at
  every breakpoint except one already-flagged case: below `md`, CSS `order`
  moves the Pursuits rail widget visually above Shelf/Circles, but its DOM
  position (and therefore tab position) stays after them. Fixing this fully
  would need a JS-driven conditional re-render rather than a CSS reorder — a
  bigger change than this stage's scope, so it's called out here rather than
  silently left inconsistent.
