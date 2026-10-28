# Build: Soosh core loop v1 (14 screens, motion and graphics)

Source: the founder's **Soosh_Core_Loop.pdf** (14 screens, Oct 28, 2026), with seven fixes agreed the same day (§3). It's checked against `main` at `cd03f51` (after #206).

**This brief replaces** `claude-code-brief-discover-v2.md` and the Discover parts of `claude-code-brief-corners-cleanup.md`. The cleanup brief's data work (merged duplicates, hidden Corners, guides, photos) stays as it is.

Ship **five PRs, in order** (§8). Never merge; the founder merges.

---

## 0. Before you write any code

1. Pull `main`. Read `CLAUDE.md`, `docs/style-guide.md`, `docs/glossary.md`, `docs/corners-build-decisions.md`, `src/styles/theme.css` and `src/styles/fonts.css`.
2. Then read:
   - **Pursuit code:** `src/app/lib/journal.ts`, `pursuitsRemote.ts`, `pursuitProgress.ts`, the `components/pursuit/*`, `PursuitDialog.tsx`, `CheckInCard.tsx`, `JoinPursuit.tsx`
   - **Log:** `Log.tsx`, `CameraCapture.tsx`, `CornerTagField.tsx`, `PursuitField.tsx`
   - **Home and Discover:** `MySpaceGrid.tsx`, `Discover.tsx`, `BottomTabBar.tsx`
   - **Motion pieces:** `components/afterhours/*` (`Reveal`, `PressLink`), `PostMediaCarousel.tsx`, `HorizontalRow.tsx`
   - **Stubs:** `supabase/migrations/20261028000000_stubs.sql`
3. **Answer the questions in §9 first.** If the founder hasn't answered one, use its stated default and list it in the PR. Stop and ask only when a question is marked **must ask**.
4. Stop and ask about any conflict with `CLAUDE.md` or the decisions log, except where §3 overrides it.

---

## 1. The loop this build serves

**Pick what you want more of → see what's on this week → join a Pursuit with people → do it → log it → get a stub → see what's next → the recap invites the next Pursuit.**

A **Pursuit** is the unit of the app: a small goal with an end date, done alone, with friends, or in an open group a host runs. Moments count toward it. Stubs record it. Hosts sell it.

---

## 2. Look and feel (global)

### 2.1 Theme and type

Follow `soosh-visual-spec-v1.md` v1.1, which is already in `theme.css`.

- **Theme:** dark by default.
  - Background `#0E0D0C`, surface `#171514`, raised surface `#201D1B`
  - Text `#F4EFE8`, muted text `#A39A90`
  - Accent `#FF6B4A`, with `#0E0D0C` text on top of it
- **Category colours:** the v1.1 set (rose, orange, violet, blue, amber, lime, teal, pink), with ink text. **Replace the muted Browse tiles in the PDF** (brown, navy, forest) with these.
- **Fonts:**
  - **Bricolage Grotesque** (700–800) for titles, Corner names, stub titles and big numbers.
  - **Inter** for everything else.
  - Delete Space Grotesk, Fraunces, Instrument Serif, Work Sans and Caveat from the `fonts.css` import once nothing uses them. List any page that still does.
- **Type scale:** use the spec's 6 sizes. Nothing smaller than 12px.
  - Screen titles 36/40px
  - Card titles 18–20px
  - Body 15–16px
  - Meta 13–14px
- **Shape:**
  - Cards and photos: 16px radius.
  - Buttons: full pill (999px) for primary actions, as in the PDF.
  - Chips: 999px.
  - Inputs: 12px.
- **Spacing:** 4px grid, 16px side gutter on phones, 40px between sections.
- **Depth:** no shadows in dark mode.
- **Icons:** lucide, at 1.75px stroke.

### 2.2 Graphics

- **Photos:** use real photos via `hobbyPhoto()` for Corners and the user's own media for Moments.
  - When a photo is missing, use the category colour with the Corner's lucide icon at 22% ink, rotated 15° and bleeding off the corner (spec §2.4). Never use a flat brown box.
- **Stub ticket** (new `components/stub/Ticket.tsx`), used on screens 7, 9, 13 and 11:
  - **Body:** category colour with a notched perforation line, drawn with a CSS mask (radial-gradient circles) and a dashed divider.
  - **Text:** a serial line ("SOOSH · STUB 014", 12px Inter 600, tracking 0.08em), the title in Bricolage 800, and a meta line.
  - **Right stub:** a big count ("2/5").
  - **Variants:** `session`, `event` (host-confirmed), `gold` (Pursuit complete, amber `#D7A03D` with a subtle foil sweep animation).
- **Avatar stack:** 3 overlapping avatars, 2px ring in the surface colour, then "+N".
- **Progress:** a thin 4px bar per person on the Pursuit page (§3 fix 3), plus a ring on the Home Pursuit bar.
- **Recap art (screen 13):** the 10 Moment thumbnails in a 5×2 grid with numbered labels.
  - `@shadergradient/react` is installed. You may use it **only** behind the gold stub on screen 13, at low intensity, and only if it holds 60fps on a mid-range Android. Otherwise use a static gradient. Report which you used.
- **Empty states:** illustrated with the same tilted category-icon art. No stock "nothing here" pictures.

### 2.3 Motion system (`motion` v13, `import { … } from "motion/react"`)

Create `src/app/lib/motionTokens.ts` and use only these values:

| Token | Value | Use |
|---|---|---|
| `press` | spring stiffness 500, damping 30; scale 0.97 | Every tappable |
| `pop` | spring stiffness 420, damping 22 | Chips selecting, "I'm in" morph, cheer |
| `sheet` | spring stiffness 380, damping 36 | Bottom sheets, Log, Make it a Pursuit |
| `page` | 280ms ease-out; opacity 0→1, y 12→0 | Screen and section entry |
| `stagger` | 40ms | Lists and grids entering |
| `shared` | `layoutId` spring stiffness 350, damping 32 | Card → detail hero transitions |

- Wrap the app in `<MotionConfig reducedMotion="user">`. Under reduced motion, everything becomes opacity-only.
- Entry animations run once per mount, never on scroll back.
- Haptics: call `navigator.vibrate?.(10)` on join, post and stub reveal where supported. Never vibrate on scroll.
- Performance: animate only `transform` and `opacity`, and hold 60fps on a mid-range Android. Lazy-load images below the fold.

### 2.4 Carousels

Use one component, `components/ui/SnapCarousel.tsx`, built on CSS scroll-snap and `HorizontalRow` (no new library):

- Snap to the start of each card, with the next card peeking 24–32px.
- Optional dot pager (active dot widens 6→20px with `pop`).
- Mouse drag on desktop, arrow keys when focused, and `aria-roledescription="carousel"`.
- Card press uses `press`; entry uses `stagger`.

Use it for:
- Discover "Your friends are doing"
- The Corner page Moments strip
- Search's open Pursuits
- Host Space "Made here"
- Multi-photo Moments (refactor `PostMediaCarousel` onto it)

---

## 3. Seven fixes to the PDF (these override the PDF)

1. **Corner page:** one primary button, **Do this with people**. "Set a solo goal" and "I did this" become small text links under it. Remove "Cheap" from the meta line (no price words in guides).
2. **Make it a Pursuit:** remove "People who do it together finish far more often". It's an outcome claim with no source.
3. **Pursuit page:** list the group in join order, never sorted by progress. No "ahead", "behind" or ranks anywhere.
4. **Notifications:** remove "You're one behind". Use "Sneha logged pasta #3" instead.
5. **Search and host Space:** no member, follower or "stubs given" counts. Show friend signals instead ("2 friends follow", "Sneha has 4 pottery stubs") and the next session.
6. **Browse tiles:** use the v1.1 category colours (§2.1).
7. **Tabs:** keep the PDF's 4 tabs: Discover · Home · + Log · You. No Plans tab. The Home Pursuit bar and Notifications do that job.

---

## 4. Screens (the PDF page numbers)

For every screen: real data, a loading skeleton, an empty state that hides empty sections, an error state, and 390px and 1440px layouts.

### 1. Onboarding: "What do you want more of?"
- **Chips:** the 8 moods from `moods.ts`, using their exact labels. Multi-select, minimum 1.
  - Off: surface fill. On: accent fill with ink text, animated with `pop`.
- **City field** with suggestions. It writes `profiles.city`, a new column (§6).
- **Button:** "Show me what to do", fixed to the bottom. It's disabled until a chip is picked, with "Pick at least one" helper text instead of a dead button.
- **Footnote:** "Takes 10 seconds. Change it any time."
- **Motion:** the title rises in, then chips stagger in at 40ms.
- **Invites:** when the user arrives from an invite link, show the inviter's card on top ("Priya invited you to 5 pastas this month"), and the button becomes "Join Priya's Pursuit".

### 2. Discover
- **Header:** "This week in" (muted) over the city name (Bricolage 32), with a search button on the right.
- **Hero card:** one featured Corner this week, picked from the user's moods plus the open Pursuits with the most activity near them.
  - Full photo with scrim, a badge ("6 people starting Saturday"), the Corner name, and the meta line ("90 min · At home or with a host · Make 5 in a month").
  - Tapping it uses a `shared` transition: the photo becomes the Corner hero.
- **"Your friends are doing":** a `SnapCarousel` of friend Pursuit cards (avatar, "Priya · Sourdough", "3 of 10 loaves · open to join").
- **Browse:** a 2-column category tile grid (§2.2 art). Tapping one opens `/browse/:slug`.

### 3. Corner page (Pasta)
- **Hero:** category photo, 280px. Back link "← Food and drink". Title in Bricolage 48. Meta line "90 min · At home · Good with a friend".
- **Social proof card:** avatar stack plus "Priya + 5 others near Indiranagar · Starting a '5 pastas this month' Pursuit Saturday".
- **"Your first time":** the numbered steps from `howToStart()`, with numbers in accent.
- **Moments strip:** a `SnapCarousel` of square thumbnails, with "42 Moments from people in Bangalore" under it.
  - This is a count of Moments, not members, so it's allowed. Hide it under 5.
- **Fixed bottom area:** **Do this with people** (primary pill), then the "Set a solo goal" and "I did this" text links (fix 1).

### 4. Make it a Pursuit (a bottom sheet over the Corner, `sheet` spring)
- **Title:** "Make it a Pursuit". Subline: "A small goal with an end date."
- **Who with** (segmented control: Open group · Friends · Just me). The selected segment slides as a `layoutId` pill.
- **Open group:** suggests the best open Pursuit near the user, as a card with an accent border.
  - Card content: the title, a "6 of 8 spots" badge, "Hosted by Priya · First session Sat 6pm, Indiranagar · or do your own version at home", and the avatar stack.
- **Goal stepper:** "Make **5** pastas in **4** weeks", with − and + buttons. The numbers animate with a vertical number roll.
- **Button** (fixed to the bottom): "Join Priya's Pursuit", "Start with friends" or "Start", depending on the choice.
  - On tap it morphs (`pop`) into a check, then routes to the Pursuit page with a `shared` title transition.

### 5. Pursuit page
- **Header:** "Pursuit · Pasta · ends Nov 28", then the title in Bricolage.
- **"Next together" card:** accent fill. "Sat 6pm · Priya's kitchen · 4 going · bring 2 eggs", with an **I'm in** button.
  - Tapping I'm in toggles to "You're in ✓" with `pop` and a haptic, and the avatar stack gains you.
- **The group:** rows of avatar, name, "1 of 5" and a 4px bar in each person's avatar colour. Join order (fix 3). Bars animate from 0 on entry.
- **Latest:** Moment rows (thumbnail, "Sneha · Pasta #2", caption, "3 cheers · 2 replies").
- **Fixed bottom:** "Log pasta #2" (light pill). It opens Log pre-filled.

### 6. Log a Moment (full-screen sheet, `sheet` spring up from the + tab)
- **Top:** Cancel, then the title "Log a Moment".
- **Photo area:** 4:5 with "+ 2 more". It opens `CameraCapture` or the photo picker first.
  - The first visit with no media opens the camera straight away.
- **Caption field.**
- **Rows** (each opens a picker sheet):
  - Activity (pre-filled)
  - Counts toward ("5 pastas · #2", pre-filled when a Pursuit is active)
  - With (people)
- **Audience:** a segmented control (Group · Friends · Everyone). The default is Group when there's a Pursuit, else Friends.
- **Post:** an accent pill, disabled until there's media or text.
- **On Post:**
  1. The sheet shrinks into the photo.
  2. The photo flies to the stub's position on the next screen (`shared`).
  3. A haptic fires.

### 7. Posted (the stub reveal)
- "Posted to your group" in muted text.
- **The stub ticket** drops in from 40px above with `pop`. Then:
  - the perforation draws left to right (120ms)
  - the right-side count rolls "1/5 → 2/5"
- A friend reaction card when one arrives live ("Priya cheered · 'Look at that sheen'"), sliding in.
- **What's next:** 3 rows with arrows.
  - The next session of this Pursuit
  - A related Corner with an open group ("People who make pasta also try Sourdough · Priya's group has 2 spots")
  - Invite a friend ("They get the recipe and a seat")
- **Bottom:** "See what friends are up to" (outline pill), which goes to Home.

### 8. Home
- **Title:** "Home", with a bell (accent dot for unread).
- **Pursuit bar:** "5 pastas · you're 2 of 5 · Sat 6pm with the group · 3 days", with an "Open" link. When there are several, they're stacked and swipeable.
- **Feed:** friends' and followed Spaces' Moments.
  - Each Moment: avatar, name, "Run club · Cubbon Park · 2h", 4:5 media (multi-photo uses `SnapCarousel`) and the caption.
  - Two actions: **Cheer** (outline) and a context action (**Join Sunday**, **Join Priya** or **Do this**) as a light pill.
  - Cheer: a heart burst (6 particles, `pop`) plus a haptic. The count rolls up.
- **Pull to refresh** with a spring.

### 9. You
- **Header:** 64px avatar, name, "Bangalore · 14 stubs · 6 activities", settings button.
- **Tabs:** Stubs · Pursuits · Moments. The selected tab slides as a `layoutId` pill.
- **Stubs:** a 2-column grid of `Ticket`s, newest first, staggered in. Tapping one opens the stub full-screen with a `shared` transition and a "Share" button.
- **Pursuits:** active ones first, then finished ones with their gold stub.
- **Moments:** a grid of the user's Moments, grouped by Corner (the Shelf).

### 10. Search
- A search field with autofocus and Cancel.
- **Filter chips:** This week · Up to 2 hr · With people · Free.
- **Results in sections:**
  - **Activity:** Corner rows ("Crafts · 3 hr"; no people count, fix 5)
  - **Open Pursuits near you:** rows with place, day and spots, plus an arrow
  - **Spaces:** rows with an avatar, type and area, plus a friend signal
  - **People:** rows with a stub signal and mutual friends
- **Ask Soosh mode:** when the query reads like a sentence (5+ words, or contains "with", "under", "this weekend"), show an **Ask Soosh** card at the top instead. It holds the chips it understood and the 3 plans (PRD §8.3).
  - Feature-flagged as `askSooshEnabled`, off by default. Build the UI with fixtures.

### 11. Notifications
- **Needs you:** action cards. Each one has two buttons, and the card collapses out with a spring once handled.
  - Event: accent card with **I'm going** and **Can't make it**
  - Join request: surface card with **Let her in** and **View profile**
- **Earlier:** a list of avatar plus sentence.
  - The allowed types: cheers, logs in your Pursuits, new Pursuits from Spaces you follow, and the quiet nudge ("Learn badminton has been quiet for 5 weeks. Pause it?").
  - No comparison wording (fix 4).

### 12. Host Space (Clay Corner)
- **Header:** cover band, an avatar overlapping it, name, "Pottery studio · HSR Layout · Verified host", and a **Follow** pill (toggles to "Following", `pop`). No counts (fix 5).
- **Open Pursuits:** cards. The best one has an accent border and a spots badge.
  - Card content: "4 Thursdays, 7pm · {price} · clay and firing included".
  - Price comes from the host's own listing, which the trust rules allow; only guides can't mention prices.
- **Made here:** a `SnapCarousel` of Moments tagged with this Space.

### 13. Pursuit complete (recap)
- "Pursuit complete · 26 days", then the title "You baked 10 loaves".
- The **5×2 grid** of the Pursuit's Moments, which flips in tile by tile (40ms stagger, rotateY 90°→0).
- The **gold stub** ("10/10 loaves · With Priya and Sneha · Sep 13 to Oct 9"), with the foil sweep and optional shader background (§2.2).
- **Share the recap:** exports a 1080×1920 story image of the grid plus the gold stub.
- **Keep going:** Level up (same group, a harder goal), **Host it for beginners** (starts the host flow), and Try something new.
- **Confetti:** a light amber burst of 24 particles, once. Skipped under reduced motion.

### 14. Home, empty (new user)
- **Invite card:** "Soosh is better with your people", with **Invite on WhatsApp** (opens a `wa.me` share with the deep link) and **Find contacts**.
- **"Happening near you this week":** 3 open-Pursuit or event rows.
- **"Follow a few Spaces":** 3 Space tiles that toggle to Following with `pop`.
- This view shows until the user follows 3 people or Spaces, or joins a Pursuit.

---

## 5. Touch-to-Moment interaction map

| From | Gesture | To | Transition |
|---|---|---|---|
| Discover hero | tap | Corner | `shared` photo → hero |
| Corner | Do this with people | Make it a Pursuit sheet | `sheet` up |
| Sheet | Join | Pursuit page | button `pop` → check, then `shared` title |
| Pursuit | Log pasta #2 | Log sheet | `sheet` up, pre-filled |
| + tab | tap | Log sheet | `sheet` up; the + rotates 45° |
| Log | Post | Posted | photo flies to the stub (`shared`); haptic |
| Posted | What's next row | Pursuit or Corner | `page` |
| Home Moment | Cheer | stays | heart burst, count roll |
| Home Moment | Join | Pursuit sheet | `sheet` |
| You stub | tap | Stub full-screen | `shared` ticket |
| Last Moment of a Pursuit | Post | Recap | full-screen `page`, then confetti |
| Any sheet | drag down | closes | velocity-based dismiss |
| Notification card | action | collapses | height spring to 0 |

Back navigation reverses the same `shared` transition.

---

## 6. Data changes (one migration per PR that needs it, each with a rollback file like the existing ones)

| Change | Where | PR |
|---|---|---|
| `profiles.city` text; `profiles.moods` text[] | profiles | 2 |
| `pursuits.visibility` ('open', 'friends', 'solo'); `pursuits.space_id` (a host's Space, nullable); `capacity` int; `ends_at` timestamptz | pursuits | 3 |
| Join requests for open Pursuits (`pursuit_join_requests`, or reuse the members table with a `status`) | pursuits | 3 |
| `posts.audience` ('group', 'friends', 'everyone'); `posts.pursuit_id`, if not already linked | posts | 4 |
| `stubs`: make `event_id` nullable, add `kind` ('event', 'session', 'gold'), `post_id`, `pursuit_id`, `serial` (per user) | stubs | 4 |
| `space_events.price`, `capacity`, `booking_url` | space_events | 5 |

**Stub rules:**
- One `session` stub per posted Moment that counts toward a Pursuit, issued by a server function, never by the client.
- `event` stubs stay host-confirmed.
- `gold` on Pursuit completion.
- No ranking by stubs anywhere.

Run only read-only queries against live data, and list counts in each PR.

---

## 7. Copy and rules
- Copy follows `docs/style-guide.md` and `docs/glossary.md`. New words for the glossary: "Make it a Pursuit", "Open group", "Next together", "What's next", "Was there", "Keep going".
- No member counts, follower counts, leaderboards, streaks, daily targets, outcome claims or prices in guides. No ads.
- Mobile first: 390px, 16px gutter, no horizontal page scroll. Touch targets at least 44px. Contrast at least 4.5:1, checked by script.

---

## 8. PRs, in order

1. **Foundations:** motion tokens, `MotionConfig`, `SnapCarousel`, `Ticket`, `AvatarStack`, `Segmented`, `Sheet`, `PillButton`, `Chip`, fonts cleanup. Include a `/dev/kit` page that shows every component and animation.
2. **Onboarding, Discover, Corner page** (screens 1–3), plus the profiles migration.
3. **Pursuits:** Make it a Pursuit, the Pursuit page, the Recap (screens 4, 5, 13), plus the pursuits migration.
4. **Log, Posted, Home** (screens 6, 7, 8, 14), plus the posts and stubs migrations, with the new tab bar.
5. **You, Search (with Ask Soosh behind its flag), Notifications, host Space** (screens 9–12), plus the space_events migration.

**Each PR:**
- `npm test`, lint and type check pass.
- Screenshots at 390px and 1440px.
- **A screen recording (GIF or MP4) of every transition in that PR**, at 390px, plus one with reduced motion on.
- A list of files changed.
- Stop for review before the next PR.

---

## 9. Questions to settle before PR 1

Defaults apply if unanswered, except where marked **must ask**.

1. **Hosted Pursuit payments: must ask.** Do bookings for a host's paid Pursuit link out to the host's own payment page (default, no in-app payments), or should Soosh take payment?
2. **Join approval:** do open-group Pursuits need the host or creator to approve each join (default: yes once more than half the spots are taken; before that, instant)?
3. **Light mode:** ship light mode now or later? (Default: dark only in these PRs; light stays as a Settings option using the existing tokens.)
4. **The shader gradient on the gold stub:** allowed (default: only if it holds 60fps; otherwise static)?
5. **Story export:** OK to add a small dependency to render the share image (default: draw it with the canvas API, no new dependency)?
6. **City list:** Bangalore and New York only at launch, or any city (default: free text with suggestions; Discover data only for Bangalore and NYC)?
7. **"I did this" without a Pursuit:** does it give a session stub (default: no; stubs come only from Pursuits, events and completions)?
8. **Fonts:** keep Bricolage Grotesque and Inter (default: yes, per the visual spec)?

Report back after each PR: what shipped, screenshots, recordings, the answers you assumed, and anything that didn't fit the existing code.
