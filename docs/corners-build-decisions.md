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

## Corner page layout (Oct 28; brief: claude-code-brief-corner-page-layout.md, replaced by the cleanup brief below)

- The Corner page follows Sidequest's structure (hero, How to start beside Why it's worth it, More like this) in Soosh's look. No dark theme, no condensed caps.
- No self-logging on the Corner page: "Log a Moment" leaves the hero, and "Start a Pursuit" and "Log a Moment" leave the guide. The hero button is I'm going (next event), else See Spaces, else Create a Space.
- The guide now sits directly under the hero, above the live rows. This reverses the original Corners brief, which put people and events first. The hero still carries the next event, so the social signal stays above the fold.
- The category name shows as the hero kicker and links to its category page (extends the CLAUDE.md rule that limited category names to Discover). Replaced by the meta-line link in the Oct 28 cleanup.
- Every built-in Corner uses the same page at `/corners/:slug`; sections without data hide. `/corner/:slug` redirects there. The old `Corner.tsx` page (one step, Start a Pursuit, Log a Moment, "Be the first") retires.
- Categories are browsable: an 18-tile "Browse by" row on /corners and Discover, linked row headings, and `/browse/:slug` rebuilt as a photo hero plus a grid of Corner cards instead of a text list.

## Corners cleanup (Oct 28, from the founder's audit of trynospace.com; brief: claude-code-brief-corners-cleanup.md, replaces claude-code-brief-corner-page-layout.md)

- Rows never borrow Corners. `fillRow()` padded short rows with Corners from other categories, which is why Pasta showed under Yarn and fabric. It is removed; a short row stays short.
- Place is exact: "At home" means home, "Outdoors" means outdoors; "Anywhere" Corners are in neither.
- Merged duplicates (alias map, no migration): Coffee (from Espresso, Home coffee), Writing (from Creative writing), Reading (from Books), Electronics (from Arduino, Raspberry Pi), Filmmaking (from Video), Pottery (from Ceramics), D&D (from Tabletop RPGs), Photography (from Outdoor photography), Meditation (from Mindfulness), Furniture flipping (from Restoration), Gardening (from Native plants), Houseplants (from Indoor growing).
- Hidden from browsing (still resolvable): Nature journaling, CAD, Laser cutting, CNC, Product prototyping, No-code building, Creative coding, Data visualization, AR/VR projects, Smart-home projects, Cybersecurity learning, Toys.
- Every browsable Corner has a description; no photo repeats across Corners.
- Home = one kind of row: category rows only (plus Happening this week). Mood, time and place rows are removed; those are filters, and any filter turns the page into one grid of results. Filters live in the URL.
- Categories are findable: a "Browse by" chip row on /corners and Discover, clickable row headings, and "See all" on More Corners like this.
- Names: Discover is the nav section; Corners is its browse tab; a category is shown by its own name. Path: Discover > Corners > Food and drink > Pasta. Back links say "Back to Corners" (category page) and "Back to {category}" (Corner page).
- The Corner page meta line leads with the category as a link: "Food and drink · 90 min · At home". This replaces the hero kicker from the earlier layout brief.
- Test Moments are listed for the founder to remove, never deleted by a session.

## Core loop v1 (Oct 28; brief: Soosh core loop v1, 14 screens)

Answers from the founder before PR 1. These override the entries above where they differ.

- Paid Pursuits from a host link out to the host's own payment page (`space_events.booking_url`). No in-app payments.
- Stubs: a server-issued `session` Stub per posted Moment that counts toward a Pursuit, and a `gold` Stub on completion, join the host-confirmed `event` Stub. Your own Stub count may show on You, and friend signals such as "Sneha has 4 pottery Stubs" may show in Search. Never ranked, no leaderboards. This replaces "No totals or counts of Stubs anywhere" and "never self-awarded" for these two types only.
- Corner page: one primary button, Do this with people. "Set a solo goal" and "I did this" return as text links, replacing the Oct 28 "no self-logging" rule. "I did this" with no Pursuit gives no Stub. No price words in guides.
- The app is dark by default; light stays a Settings option. This replaces "No dark theme" on the Corner page.
- The brief's own text is the visual spec; `soosh-visual-spec-v1.md` and the PDF are not in the repo.
- Fonts are Bricolage Grotesque and Inter only. `--font-serif`, `--font-heading`, `--font-hand` and `--font-display` now resolve to those two, so no call site changed. Space Grotesk, Fraunces, Work Sans, Caveat and Instrument Serif are removed.
- The ticket serial reads "Soosh · Stub 014" in sentence case with tracking, not all caps, because style guide rule 10 bans all caps.
- Motion values live in `src/app/lib/motionTokens.ts`; `springs.ts` re-exports them for older call sites.

### PR 2: onboarding, Discover, Corner page (screens 1 to 3)

- Onboarding is two steps: a name (and the Terms when needed), then "What do you want more of?" with the 8 moods and a city. The first Moment, tags, avatar and cover steps are gone from onboarding (the 10-second screen replaces them); the components are untouched. Follows are no longer derived from tags at sign-up. The default landing is `/discover` (was `/you`). Onboarding shows no top bar or tab bar.
- `profiles.moods` (public) and `profile_private.city` (owner only, row-level security), migration 20261030000000. The city is private on purpose: `profiles` is readable by anyone who can see the profile, so it lives in its own table. The app also keeps both in localStorage (`soosh.interests.v1`) and reads and writes them apart from the main profile load, so nothing breaks before the migration is live.
- Discover's front door is the header (city, search), one hero Corner (from the person's moods, preferring a Corner with an event coming up), "Your friends are doing" and Browse. Search, the People, Spaces and Marketplace tabs and All Moments stay below it until PR 5 moves search. The mood picker, Start here, Seen tonight, Rooms and the cover story are no longer on Discover.
- Friends' Pursuits are Pursuits that people you follow share and are still working on. "Open to join" waits for the open Pursuits in PR 3.
- Corner page: 280px hero, back link reads "← {group}" (the screen; was "Back to {group}"), name, then "90 min · At home · Good with a friend". The hero button, emoji and group link in the meta line are gone. One primary button, Do this with people, with Set a solo goal and I did this under it, fixed above the tab bar. Until the Make it a Pursuit sheet ships (PR 3), Do this with people opens the existing Start a Pursuit flow on inviting people.
- Guide lists held price words ("Free to start", "Cheap"); removed in the price words change below.

### PR 3: Make it a Pursuit, the Pursuit page, the recap (screens 4, 5, 13)

- Open groups, sessions and join requests are migration 20261031000000: `pursuits.visibility`, `space_id`, `capacity`, `ends_at`; `pursuit_members.status` gains `requested`; `pursuit_sessions` and `pursuit_session_rsvps` ("Next together" and I'm in); `open_pursuits_for_corner()`, `join_open_pursuit()` and `answer_join_request()`. Join approval is the default: instant while at most half the spots are taken (the host counts as one), then the host decides. Join request notifications wait for the Notifications screen (PR 5).
- The goal reads "Do {Corner} 5 times in 4 weeks": Corners carry no unit noun ("pastas"), so the unit is "times". A `unit` on curated Corners would let it read "Make 5 pastas".
- Joining an existing open group does not show the goal stepper: the group's own goal is the card. Starting your own open group holds up to 8 people.
- The group on a Pursuit page is listed in join order (the owner first, then by when each person joined), never by progress. The 4px bars are each person's own colour and carry no ranks or comparisons.
- The recap's story image is drawn with the canvas API (no dependency). The gold stub sits on a static gradient: the animated shader is not used (no mid-range Android was available to check 60fps).
- The recap is a full screen (no top bar or tab bar). Reaching it from the last Moment posted is PR 4; for now a finished Pursuit shows "See the recap".
- Moment rows under Latest carry no cheer or reply counts: the glossary calls reactions Love this, Count me in and Thoughts, and the brief's "cheers" is decided with Home (PR 4).

### Price words out of guides (Oct 28)

- Removed every price word from the guides in `curatedCorners.ts` (steps, needs and why it's worth it) and three steps in `cornerGuides.ts` ("free", "cheap", "cost", "fee", "paid", "budget", "cash"). Price-only lines ("Free to start", "Cheap", "Entry and rental fees apply") were dropped; a Corner keeps 3 to 5 needs and exactly 4 reasons, as the tests require. A vitest check fails on any price word in a guide.

### PR 4: Log, Posted, Home (screens 6, 7, 8, 14)

- **Reaction wording.** The UI says "Love this" everywhere and the notification says "{Name} loved your Moment". The word "cheer" is in no user-facing string; in code the thing is a reaction. The glossary now says so. A curated Corner guide line that said "cheering" now says "having fun".
- **Moment audience.** New `posts.audience` (group, friends, everyone). A group Moment is stored with `visibility = just_me` plus a read policy for people in its Pursuit, so every older reader that looks at `visibility` can never leak it. A trigger refuses a group Moment unless the writer is in that Pursuit. Log offers four choices (Group, Followers, Everyone, Only you) so private logs still work; the default is Group when the Moment counts toward a Pursuit with people, else Followers, overriding a saved "Only you" default as the brief says.
- **Stubs.** Issued only by the database: a session Stub when a Moment is saved (or later attached) to a Pursuit you are in, and a gold Stub to everyone in a Pursuit when it is finished. `stubs` gets its own `id`, a `kind`, a `serial` per person, and keeps `unique(user_id, event_id)` so the existing event Stubs still work. Nobody can insert a Stub from the app.
- **One audience label set (founder, Oct 28).** Group / Followers / Everyone / Only you everywhere. "Friends" became "Followers" in Log and "Public" became "Everyone" on the Moment page, the first-Moment step, Settings and the shared visibility options. Wording only: the stored values (`public`, `followers`, `just_me`) and who can see a post are unchanged. `audienceLabels.test.ts` fails if "Public" is used as an audience label or Log says "Friends". The Pursuit choice Open group / Friends / Just me is a different idea and is unchanged.
- **Every Log row is optional with a default.** Activity (none), Counts toward (nothing), With (hidden unless the Pursuit has people) and Details (empty) can all stay as they are, so a photo posts in one tap with the default audience. Post no longer asks for a Corner.
- **Posted.** The ticket grows out of the Log photo and is shown only when a Pursuit is involved (a Moment with none earns no Stub). The "With" row is read from the Pursuit's members; there is no separate tagging.
- **Home.** At most about one card in four is a Space promotion: one after every third friend card, spare ones dropped, none when there are fewer than three friend cards. A friend's Moment at a Space counts as a friend card. Only strangers' Moments from a Space you are in or a Corner you follow are promotions. The old grid stays at `/my-space/all` (linked as "See all Moments") until PR 5.
- **Multi-photo cards** use SnapCarousel inside the Home card. The shared `PostMediaCarousel` is unchanged, so the Moment page and grids behave as before.
- **Contrast.** Photo chips on Log sit on a 80% solid black scrim (12.6:1 over a white photo). The Home cards have no text over photos.

## Open

- Naming: too many nouns (Corners, Spaces, Moments, Pursuits, Stubs, tickets) and Discover vs Home. Pursuit is the first candidate to cut.
- Founder to review Choir, Trivia and Improv photos.
- Unsplash photos for the 12 wave-1 Corners.
- Next briefs: event ideas as host prompts ("Ideas for your next event"); wave 2 once members ask for those Corners.
