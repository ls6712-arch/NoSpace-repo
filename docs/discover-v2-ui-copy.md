# Discover v2: copy

Status: **approved by the founder on Oct 31, 2026, with these changes**, all applied and recorded in
`docs/glossary.md` under "Discover v2":

1. Ideas empty-state link: **Show more ideas** (still loosens Spend to Treat me).
2. **With people** and **At a place** tab lines show the name of the soonest open Pursuit or the nearest Space for
   that Corner. Fallbacks: **Find people to go with** / **Find a place near you**.
3. The Corner hook line is capped at one line with an ellipsis.
4. Feed heading with no city: **What people are making**.
5. Category browse chips: not built. See all on Spaces near you: skipped for now.

Where the words live in the code: `lib/discoverCorners.ts` (Be the first, the two fallbacks, the tab lines),
`lib/discoverCornerNames.ts` (which Pursuit and which Space are named), `components/discover/IdeasRow.tsx`,
`components/discover/CityFeed.tsx` and `pages/Discover.tsx`.

How the names are picked: the Pursuit is the open Pursuit with room whose next session is soonest (one with no
upcoming session comes last); the Space is the Corner's Space in the person's own neighborhood, else in their city,
else the first listed. Both come from the same reads the Corner page uses (`open_pursuits_for_corner` and the
Corner's live Spaces), so there is no new database function.

## Category browse chips

Not built. Categories stay internal after the Spaces rework. If you want them back, say where they go and what they
open; the 18 group names already exist in `data/cornerCategories.ts`.
