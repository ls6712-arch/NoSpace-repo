# Communication Phase 7: Faces, pictures, and one place for notifications

Written Oct 4, 2026 against `main` at `2f5097f`. Save this as `docs/communication-phase7-visual.md`
and add a "Phase 7" line to the STATUS section of `docs/communication-strategy.md` when each step ships.

## Why

Phases 1–5 made messaging safe, live, and rich. The weak part now is how it looks: people show up
as initials, notifications are an icon and a sentence, shared Moments look like link previews,
and on a phone the only notification view is a 320px popover. This phase fixes the visual layer.
It adds one small database change, needed so notifications know which Moment they're about.

## Ground rules (same as every phase)

1. **Before anything else, read the code.** Read `docs/communication-strategy.md`, `Messages.tsx`,
   `NotificationsMenu.tsx`, `Inbox.tsx`, `Header.tsx`, `BottomTabBar.tsx`, `SharedContentCard.tsx`,
   `lib/sharedContent.ts`, `lib/notificationGrouping.ts`, and the latest migration that redefines
   `enforce_notification_insert()`.
   - If anything below doesn't match what you find, stop and tell me before writing code.
2. **One branch per step, from current `main`.**
   - Don't touch Spaces work, `.env`, or `.gitignore`.
3. **Database changes are staged, never applied by you.**
   - Each one gets a migration, a matching rollback, and a verification script under `supabase/`.
   - I run the SQL myself in the Supabase SQL Editor and paste results back.
4. **Before showing me anything, these must pass:** typecheck, tests, build. New pure logic gets tests.
5. **Check every UI change** at phone and laptop width, in light and dark, with at least two test accounts.
6. **Show me the diff and wait for my go-ahead** before committing or pushing.
7. **Design rules:**
   - Use the existing theme tokens, the existing `ui/avatar.tsx`, and lucide icons.
   - Prefer speed over animation: no new motion beyond what's already in the app.
   - Every image needs a graceful fallback (initials, or the current icon).
8. **Product rules:**
   - Don't create any new notification kinds.
   - Don't add anything designed to pull people back into the app.
   - Privacy rules from Phase 4 still apply: a private or blocked Moment never shows a thumbnail
     to someone who can't see it.

## Step 7A: Real avatars in Messages (app only)

Every avatar in `Messages.tsx` is `AvatarFallback` with initials only (around lines 808, 895, 1035).
Profiles already have `avatar_url`, and `SocialContext` already fetches it for other features.

- **Load the photos.** Fetch `avatar_url` for every person shown in Messages: conversation list,
  thread header, message requests, and the "start a chat" picker. Add it to whatever profile
  lookup Messages already does. Don't add a second fetch per row.
- **Render them.** Use `AvatarImage` with the existing initials as fallback.
- **Size them:**
  - conversation list: 40px
  - thread header: 36px
  - request cards: 40px
- **Done when** a user with a photo shows it everywhere in Messages, a user without one still
  shows initials, and a broken image URL falls back cleanly.

## Step 7B: Notifications know what they're about (database, staged)

Right now `notifications` only stores `body`, `href`, `actor_name`, and `actor_id`. There's no
Moment or Pursuit id, so the UI has no image to show.

1. **Inventory first.** List every code path that inserts a notification: client `notify()` in
   `SocialContext.tsx` and every SECURITY DEFINER trigger in `supabase/migrations/`.
   - For each one, record the `href` shape it writes and show me the table before writing SQL.
   - I know at least one writes `'/moment/' || new.post_id`.
   - Check the real id types of `posts.id` and `pursuits.id`.
2. **Migration:**
   - **New columns.** Add nullable `target_post_id` and `target_pursuit_id` to `notifications`.
     Match the real id types, with foreign keys `on delete set null`, plus indexes.
   - **Fill them in the database, not the app.** In `enforce_notification_insert()`, derive both
     from `new.href`, so every insert path gets it without changing each caller. Always overwrite
     whatever the client sent.
   - **Copy the live function first.** Use the same rule as Phase 5: copy the live
     `pg_get_functiondef('public.enforce_notification_insert'::regproc)` verbatim. Ask me to run
     that query and paste the output, then add only the new lines.
   - **Backfill** existing rows from `href` in the same migration.
3. **Rollback** drops the columns and restores the previous function definition exactly.
4. **Verification script** must prove:
   - new inserts get the right target ids
   - a client can't spoof them
   - the backfill covered every row with a matching href
   - mute and block checks still work
5. **App:** read the two new columns into the `Notification` type.

## Step 7C: The notification row, and one real Notifications page (app only, after 7B)

### The row

| Slot | What goes there |
|---|---|
| Left | The actor's avatar (from `actor_id`, 36px), with the current lucide icon as a small badge on its corner |
| Middle | The actor's name in the serif face, then the action, then time-ago underneath |
| Right, Moment notification | A 44px square thumbnail of the Moment |
| Right, Pursuit notification | A small progress bar (current / goal) instead of a photo |
| Right, request | Accept / Decline buttons inline, as today |

- **Thumbnails:** load them through the existing `lib/sharedContent.ts` loader, so visibility,
  blocks, and private-bucket signed URLs are already handled. If it returns "Not available", show
  no thumbnail.
- **Grouped rows** ("3 people loved Lego roses") show up to 3 stacked, overlapping avatars on the left.
- **Batch the lookups.** Fetch all actor avatars and target thumbnails for the visible list in
  one batch, not per row.
- **Leave the stored text alone.** Don't change how `body` is stored in this step.
  - Do: render `actor_name` separately, and strip it from the start of `body` when it's there.
  - If that's messy, tell me and propose a cleaner split for a later step.

### One page instead of two half-places

- **The orphaned page.** `/inbox` exists, but nothing in the app links to it. Make it the full
  **Notifications** page, at route `/notifications`, with `/inbox` redirecting there.
  - Keep its current Requests / Activity split, as **Requests** and **Activity**.
  - Activity uses the same row component as the bell.
- **Phones (below `lg`).** Tapping the bell goes straight to the page, with no popover.
- **Laptop.** Keep the popover, and add a "See all" link at the bottom that goes to the page.
- **Fix the stale comment.** Update the comment in `BottomTabBar.tsx` that claims the bell leads
  to `/inbox`, so it's true.
- **Explain where message requests live.** Add one line at the top of Requests: "Message requests
  live in Messages." Link it, and show their count if there are any.

**Done when:**
- every notification about a Moment shows that Moment's picture
- a private Moment shows no picture to someone who can't see it
- grouped rows show stacked faces
- on a phone the bell opens the full page
- `/inbox` redirects

## Step 7D: Photo-first shared Moment cards in chat (app only)

`SharedContentCard` shows a 40px thumbnail. Make Moment shares photo-first inside chat bubbles:

- **Moment card:**
  - full-width image (max about 260px wide, 4:3, `object-cover`)
  - title underneath
  - Corner tag and owner's name in small muted text
  - tapping opens `/moment/:id` as today
- **Moment with no photo:** a compact text card, no empty image box.
- **Pursuit card:** cover image if there is one, the Pursuit name, and a progress bar.
- **Unchanged:** "Not available" behavior and the "Send to…" flow stay exactly as they are.

## Step 7E: The Pursuit pinned to together chats (check first)

Make together / Explore together thread headers only say "Making together · [intent]".

1. **Find out first** whether a `participations` row links to a specific Pursuit (a column, a join
   table, or via shared Pursuits). Report back before building.
2. **If a link exists:** add a slim strip under the thread header, showing:
   - Pursuit name
   - both people's avatars
   - a progress bar
   - tapping it opens the Pursuit
3. **If no link exists:** don't add schema. Tell me what the cleanest link would be and stop.

## Step 7F: Close out the open checks

These come from `docs/communication-strategy.md`. Write a two-account checklist I can follow
myself for:

- the outstanding Phase 2, 3 and 5 live checks
- Phase 7's own checks

Also list the two duplicate reports blocking the "one open report per target" index, so I can
dismiss one.

## Order and stopping points

7A → 7B (stop: I run the SQL) → 7C → 7D → 7E (stop: report on the Pursuit link) → 7F.

After each step, give me:
- the PR link
- a one-paragraph summary in plain language
- what I should click through on the live site after Vercel deploys
