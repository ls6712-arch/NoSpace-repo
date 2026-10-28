# Corners build: decisions log (Oct 26, 2026; updated Oct 28)

Decisions made while Claude Code built Corners from claude-code-brief-corners.md. These override that brief, and where noted the Door list brief, where they differ. Briefs are checked against this log.

## Data and structure

- Curated Corners live in code (`src/app/data/curatedCorners.ts`), like built-in Corners in `hobbies.ts`. No seed rows, no change to `corners.space_slug`. Slug uniqueness and name drift are checked by vitest.
- Rows on the Corners home are the 18 approved categories. No new `group` taxonomy.
- 14 new built-in Corners added to `hobbies.ts`: Boxing, Skateboarding, Kayaking, Surfing, Wild swimming, Sauna & cold plunge, Make a beat, Karaoke, Live music, Choir, Pasta, Trivia, Improv, Volunteering. Social Dance folds into Dance; Language Exchange folds into Language learning.
- Guide copy is sourced from the Sidequest app (life-on-your-terms.lovable.app) and Sidequest_Activities.xlsx, edited for the trust rule. "Why it's worth it" is dropped (outcome claims); replaced by "What you'll need" (plain facts). No training plans, daily routines or health protocols in steps. (Oct 28 note: the code still renders "Why it's worth it" from `worth`, 4 lines each, test-enforced. It now holds plain reasons, never outcomes, alongside "What you'll need".)
- Moods derive from `moods.ts`. The Corners picker is a chip row (duration, mood, setting) using moods.ts values.
- No "spots left": events have no capacity column. Future ticket: event capacity.

## Corners home (revised after first screenshots)

- Show all built-in Corners in their category rows, curated first. Real photos everywhere via `hobbyPhoto()`; no colour blocks with emoji.
- Never "Be the first to start a Space" on a card. Subline: events this week, else Spaces, else duration and setting.
- Hero ("Corner of the week"), compact picker row, horizontally scrolling rows.
- 15 Corners without a photo get the Unsplash photos in corner-photos.json (free Unsplash License, credited). Choir, Trivia and Improv flagged for founder review.

## Words

- "Moments", not "Drop". "Stub" approved as a product noun (CLAUDE.md now lists six).
- "Members see who's going." approved.

## Stubs: one concept

- The Door list brief (Oct 23) owns Stubs: derived types in one Shelf > Stubs tab.
- The `stubs` table and `confirm_event_attendance` RPC exist only to issue the event type, replacing the "posted within 24h after an RSVP" rule. A host confirms who came; nobody can give themselves a Stub.
- No separate Stubs section on the Shelf. No ranking people by Stubs (no leaderboards).

## Tickets: changed Oct 26 (overrides the Door list brief)

- Tickets are only for real events. A ticket must admit you to something with a time, a place and a host. When a Corner has an upcoming Open Space event, the cover story and Start here cards are tickets to it, with "I'm going" as the action.
- First steps are not tickets. With no event, Discover shows the step as a plain "How to start" card linking to the Corner: no "Admit one", no serial, no 7-day save.
- "Take the ticket" is cut. Tapping the card or the "Admit one" sticker opens the ticket.
- Cut: `ticket_saves` (private 7-day saves of self-chosen steps), `posts.from_ticket`, and the "From a ticket" Stub type. They were a to-do list in a ticket costume and self-awarded. Stub types are now silver, with someone, event, plain.

## Access and navigation

- `/corners` and `/corners/:slug` are open to signed-out and not-yet-approved visitors: Corners, guides, Open Spaces, event titles and times. People, Moments, hosts and RSVPs are hidden behind "Members see who's going."
- No new nav item. Discover's Corners tab links to `/corners`. Curated Corner links point to `/corners/:slug`; `/corner/:slug` redirects for curated slugs. (Oct 28: every Corner now uses `/corners/:slug`; see Corner page layout.)
- Work ships as separate PRs: Stubs migration; built-ins and curated data; Corners pages and access; link changes; Discover polish.

## Discover polish (design audit, Oct 26)

- Keep the masthead but shrink it so the cover story and mood picker fit the first screen. One logo font (Bricolage). Contrast 4.5:1, alt text, 6-size type scale with 16px body. No auto-generated Moment titles. No member counts on Spaces, ever. Remove all remaining "Rooms".

## Wave 1 (Oct 28, PR #203; brief: claude-code-brief-corners-wave1.md)

- Source: the 408-row activity catalog, mapped to Corners: 100 existing, 133 fold into existing, 34 new (12 in wave 1, 22 in wave 2), 44 event ideas, 36 backlog, 61 cut. Trend and cost columns stay internal; the catalog's Benefits column is dropped.
- 12 new curated built-in Corners: Life drawing, City walks, Film clubs, Food tours, Mahjong, Rafting, Letter writing, Hyrox, Walking clubs, Badminton, Skating, Ultimate frisbee. 23 existing Corners got `cornerGuides.ts` entries; duplicate curated steps were trimmed in 12 of them.
- Sports are `kind: "skill"`, not `"games"`. "Play a game" means board games, cards and puzzles. Soccer, Basketball and Ultimate frisbee follow Tennis, Pickleball, Padel and Volleyball. The moodCards "no two same-category cards side by side" test stays strict; don't loosen it to fit data.
- Sauna & cold plunge is `together: "together"` and stays under "Be around people". Improv correctly leaves "Start with what you have" (it needs a workshop).
- Live music `worth`: "Small shows are cheap" becomes "Small rooms, close to the band" (no price claims, trust rule 5). City walks "pass daily" stays (it describes places, not a target).
- Wave-1 photos: merged with Space covers as placeholders. The photo test lists the 12 explicitly and fails once one gets a photo, so the list can't go stale. Founder to supply Unsplash IDs.
- This log lives in the repo as `docs/corners-build-decisions.md` so briefs can be checked against it.

## Corner page layout (Oct 28; brief: claude-code-brief-corner-page-layout.md)

- The Corner page follows Sidequest's structure (hero, How to start beside Why it's worth it, More like this) in Soosh's look. No dark theme, no condensed caps.
- No self-logging on the Corner page: "Log a Moment" leaves the hero, and "Start a Pursuit" and "Log a Moment" leave the guide. The hero button is I'm going (next event), else See Spaces, else Create a Space.
- The guide now sits directly under the hero, above the live rows. This reverses the original Corners brief, which put people and events first. The hero still carries the next event, so the social signal stays above the fold.
- The category name shows as the hero kicker and links to its category page (extends the CLAUDE.md rule that limited category names to Discover).
- Every built-in Corner uses the same page at `/corners/:slug`; sections without data hide. `/corner/:slug` redirects there. The old `Corner.tsx` page (one step, Start a Pursuit, Log a Moment, "Be the first") retires.
- Categories are browsable: an 18-tile "Browse by" row on /corners and Discover, linked row headings, and `/browse/:slug` rebuilt as a photo hero plus a grid of Corner cards instead of a text list.

## Open

- Naming: too many nouns (Corners, Spaces, Moments, Pursuits, Stubs, tickets) and Discover vs Home. Pursuit is the first candidate to cut.
- Founder to review Choir, Trivia and Improv photos.
- Unsplash photos for the 12 wave-1 Corners.
- Next briefs: event ideas as host prompts ("Ideas for your next event"); wave 2 once members ask for those Corners.
