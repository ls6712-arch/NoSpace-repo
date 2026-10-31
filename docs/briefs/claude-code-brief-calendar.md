# Claude Code brief: the Soosh calendar (`/calendar`)

Written Oct 31, 2026. Design: the founder's "Soosh Calendar" canvas (Desktop Month, Desktop Week, Phone Month, Phone Day). Decisions: `claude/screens-v1-decisions.md` (Calendar section). **This replaces PR 3 (Month view) of `claude-code-brief-week-view.md`** and widens the Week view into a full calendar. PR 1 and PR 2 of that brief (the Week view's glance card and "This week in New York") still apply and move into the calendar's Week view.

## 0. Before you start
- Pull main. Read `Week.tsx`, `WeekFree.tsx`, `components/home/YourWeekCard.tsx`, `lib/homeWeek.ts`, `lib/weekPlans.ts`, `lib/stubs.ts`, `lib/calendarFile.ts`, `components/stub/Ticket.tsx`, `docs/style-guide.md`, `docs/glossary.md`, and the one-skin brief (`claude-code-brief-one-skin.md`). Use `PageShell` from the one-skin PR 5.
- Look: one skin, light by default. Bricolage Grotesque 800 for titles and big numbers, Inter for the rest. No capitals, nothing under 12px, 44px tap targets, lucide icons at 1.75 stroke, pill buttons, one coral fill per screen (plus the rail's Log).
- All times are New York time. Daytime is 06:00 to 17:59, Evening from 18:00 (`homeWeek.ts`).
- Five PRs, in order. Stop after each and report, with screenshots at 390, 744 and 1440px in the PR description. Don't merge; the founder merges.

## 1. What the calendar is (and isn't)
- It shows **only Soosh things**: plans, Pursuit sessions, Stubs you collected, your free time, Stubby's picks, friends' plans (people you're connected to only), your own blocks, and busy times from Google (no titles, ever).
- It is **not** a general calendar. There are no free-form events. "Make a plan" makes a Soosh plan (a Corner, a time, optionally a friend). Anything else someone needs to keep clear is a **block**.

## 2. Navigation (PR 1)
- Route `/calendar`. `/week` redirects to `/calendar?view=week`. The desktop rail item "Week" becomes **"Calendar"**. On phone it still opens from Home's "Your week" card (no new tab).
- Header (one row, wraps on phone): **Today**, previous and next (44px, aria-label names the period), the title, a subline, then the view switch **Day · Week · Month · List** (selected = `--foreground` fill), then **Make a plan** (the screen's one coral fill).
  - Month title: "October 2026". Subline: "{n} Stubs · {m} plans to go · New York" (leave out a part that is 0).
  - Week title: "Oct 31 to Nov 6". The week is the **next 7 days, today first**, matching Home. Previous and next move by 7 days.
  - Day title: "Tue Nov 3", with a 7-day strip under it.
  - List: an agenda of the next 30 days, grouped by day, empty days left out.
- `?view=` and `?date=` in the URL so Back works and links can be shared.
- Range: back to the sign-up month, forward 3 months.
- Month is Sunday-first, 6 rows. Desktop cells show up to 3 chips and "{k} more". Phone cells: a Stub day is filled with its category colour, a plan is an accent dot, a pick is a dashed dot; tapping a day shows that day's list under the grid (`aria-live="polite"`).

## 3. Show filters (PR 1)
A "Show" panel (desktop side panel; phone: a "Show" button opening a sheet). Checkbox rows with a swatch:

| Row | Default in Month | Default in Week and Day |
|---|---|---|
| Plans | on | on |
| Pursuit sessions | on | on |
| Stubby's picks | on | on |
| Free time | on | on |
| Friends' plans | on | on |
| Stubs you collected | on | on |
| Your blocks | on | on |
| Busy times (Google) | off | on |

Save the person's choices in `localStorage` per view (wrapped in try/catch), not the database.

**Looks** (the same in every view):
- Plan, Pursuit session, Stub: category colour fill, `--ink` text. A Stub carries the ticket icon.
- Stubby's pick: white, 1.5px dashed `--accent-text` border, "Stubby's pick" in `--accent-text`.
- Free time: no fill, 1.5px dashed border at 28% ink, muted label ("Free evening").
- Friend's plan: white, 1px border, avatar initial.
- Your block and Google busy: grey hatch. A block shows its private note if it has one; Google busy says only "Busy".

## 4. Adding, blocking, removing (PR 2)
The rule: **everything is one tap (or one drag on desktop), and nothing asks "are you sure".** Every change shows an undo toast for 6 seconds ("Plan removed · Undo").

### Add
- **Make a plan** in the header, or **tap any empty time** (phone) / **click or drag across empty hours** (desktop). The drag selects the range.
- Either opens the **time sheet** for that time:
  1. **Make a plan at {time}** (coral). Opens the existing plan sheet (Corner, time, optional friend) with the time filled.
  2. **I'm free then**: adds free time. Choice: "Just this {Tuesday}" or "Every {Tuesday}".
  3. **Block this time**: adds a block. Optional private note. Choice: just this once or every week.
- In the Month view, tapping a day opens that day's list with "Make a plan for {tonight / Sat 31}".

### Block
- A block is private. It never shows on a profile, a Stub or any shared view, and friends never see it.
- Stubby never suggests anything inside a block.

### Remove and change: tap anything you own
| You tap | Sheet options |
|---|---|
| Your plan (only you) | Change the time · Bring someone · **Cancel this plan** |
| A plan with others | Change my time (if it's yours) · **Leave this plan** |
| A Pursuit session | Move this session · **Skip this session** |
| Free time | Change the times · **Not free this {Tuesday}** · Remove from my usual week |
| A block | Change · **Remove block** |
| Stubby's pick | **Keep** (it becomes a plan) · **Not this** (the next match swaps in) |
| Google busy | Read-only: "From your Google Calendar. Change it there." · Hide busy times |
| A Stub | Opens the Stub. Stubs can't be removed from the calendar. |

### Desktop extras
- Drag your own plan or block to move it; drag its bottom edge to change the end. Hosted listings and Pursuit sessions can't be dragged (use the sheet).
- With a block or plan selected, Delete removes it (with undo). Escape closes a sheet.

### Data (migration `20261101000000_calendar_edits.sql`, with a rollback file)
- **The usual week** stays in `profile_private.free_windows` (the grid).
- **`calendar_entries`**: id, user_id, kind (`free` | `busy` | `block`), starts_at, ends_at, repeat (`none` | `weekly`), note text null (blocks only, ≤ 80), created_at. Owner-only RLS for every operation. `busy` means "not free this time" (one-off).
- **What counts as free:** usual free windows + `free` entries − `busy` entries − blocks − Google busy (PR 5) − plans. Put this in one pure function, `effectiveFreeTime(from, to)`, with tests (overlaps, weekly repeats, the clock change on Nov 1, an entry crossing midnight).
- Cancelling a plan you made deletes it; leaving a plan removes only you. Reuse the existing plan and RSVP code; if there is none for leaving, stop and ask.

## 5. Stubby's picks (PR 3)
- `stubbyPicks(freeTime, picks, budget, area, notThis)`, a pure function, client-side. It reuses the first-plan matching from the onboarding brief (§6): `space_events` and open Pursuits in a picked Corner, inside the free time, within the budget, in or near the area.
- **At most one pick per free stretch**, next 7 days only. If nothing fits, the slot stays empty with "Find something". Never filler.
- Each pick has a true reason line ("You said Tuesday evenings work, and you picked Climbing.").
- **Runs again whenever anything changes**: free time added or removed, a block, a plan added, cancelled or left, budget, Corners, and on load.
- "Not this" swaps in the next match. After 3, the slot goes back to "Find something". The "not this" list lives in memory and `localStorage` only.
- **Nothing about picks, keeps or skips is sent to the server** until the Privacy Policy line about suggestion logging is published (one-skin brief, pre-YC checklist). No notifications in this PR.
- This reverses the Oct 30 rule "no suggestion inside the slot" (founder, Oct 31).

## 6. Soosh in your calendar (PR 4: sync out)
- "Copy subscribe link" in the Show panel's "Your calendars" section and in Settings.
- `calendar_feed_tokens` (user_id, token_hash, created_at, revoked_at). One active token per person; "Reset link" revokes the old one.
- An edge function serves an `.ics` feed for that token: the person's plans and Pursuit sessions for the next 60 days. Each event has the plan title, place, time and a link back to Soosh. No blocks, no free time, no budget, no other people's names.
- Reuse `calendarFile.ts` for the event format.

## 7. Google busy times (PR 5: sync in)
- **Founder:** start Google's OAuth app verification now; this PR waits for it.
- Read **busy/free only**, never titles. Store `calendar_busy` (user_id, starts_at, ends_at, source, fetched_at), next 30 days, refreshed on open and at most hourly. Owner-only RLS.
- Busy feeds `effectiveFreeTime`. Empty Google time is never treated as free.
- "Disconnect" deletes the token and every `calendar_busy` row.
- Apple Calendar waits for a native app. Outlook only if people ask.

## 8. Copy (add to `docs/glossary.md`)
Calendar, Make a plan, Make a plan at {time}, I'm free then, Block this time, Your blocks, Not free this {day}, Remove from my usual week, Cancel this plan, Leave this plan, Skip this session, Stubby's pick, Keep, Not this, Find something, Busy times, Copy subscribe link, Reset link, When this changes, Stubby looks again. Sentence case, no dashes, `plural()` and `dates.ts`.

## 9. Analytics (existing `analytics.ts`)
`calendar_opened` (view), `calendar_view_changed`, `calendar_filter_changed` (row, on), `calendar_slot_tapped` (kind), `plan_created_from_calendar`, `free_time_added` (repeat), `block_added` (repeat), `plan_cancelled`, `plan_left`, `undo_used`. In PR 3, pick events stay client-side until the privacy line is live; then add `stubby_pick_shown`, `stubby_pick_kept`, `stubby_pick_skipped`. Never a budget amount or a block note in any event.

## 10. Accessibility
- Every chip and block is a real `<button>` with a label like "Plan, 7 PM, Village Halloween Parade, You, Sam and Maya".
- Drag actions all have a sheet equivalent (keyboard and screen readers never need to drag).
- Hatch and dashed styles are never the only signal: each has a text label.
- Reduced motion: sheets fade, no slide.

## 11. Ask the founder (defaults if unanswered)
1. Rail label "Calendar" replaces "Week". Default: yes.
2. Week view = next 7 days, today first. Default: yes (matches Home).
3. Can friends see when you're free? Default: **no** in these PRs. "Free with friends" matching is parked.
4. Undo instead of confirm, including for cancelling a plan others joined. Default: undo, plus a message to the others only after the 6 seconds pass.

## Done when
- PR 1: all four views and the Show filters work at 390, 744 and 1440px, light and dark.
- PR 2: add, block, change and remove each take one tap or one drag, every change can be undone, and `effectiveFreeTime` has tests.
- PR 3: changing free time or a block changes the picks on screen without a reload; no pick data reaches the server.
- PR 4: the subscribe link works in Google Calendar and Apple Calendar (screenshots of both).
- PR 5: only busy blocks are stored; disconnecting deletes everything.
- Each PR: `npm test`, lint and type check pass; files changed and migrations listed.
