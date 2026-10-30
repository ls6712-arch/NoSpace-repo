# Ticket: lock down posts.starts_at, posts.location_name and posts.created_at

**Status:** open, deferred from the profile PR (the row-policy step already shipped there). **Size:** medium, about 6 to 9 working days in total (breakdown below).

## Problem

`anon` and `authenticated` hold a table-wide SELECT on `public.posts`, and the row policy
("posts are readable by their audience") only decides which rows, not which columns. So anyone
can read, for every public Moment, with a plain `select`:

| Column | What leaks | Why it is there today |
|---|---|---|
| `starts_at` | the exact time of day | The Activity feature ("Something happening"): a Moment with a start time. Shown on `MomentCard`, `FeedCard`, `HobbyActivity` |
| `location_name` | the exact place, as typed | The Place field in Log. `location_privacy` ("neighborhood" and so on) is applied **in the browser** by `displayLocation()`, so the full string is still on the wire |
| `created_at` | when it was posted, to the second, including during the 2 hour delay | Feed order and "3h ago" |

The profile work adds `posts.visible_at` and an owner-only `post_private` table for the new exact
time and place. Those are safe. The three columns above are the old ones and are not.

The Log flow must not write an exact place or time for an ordinary Moment until this is done.
`src/app/pages/Log.guard.test.ts` fails if it starts to.

## Goal

1. A non-owner cannot select the exact `starts_at` or `location_name` of any Moment, by any path.
2. A Moment's `created_at` is not readable by a non-owner before its `visible_at`.
3. Nothing the feed shows today is lost: Activities still show when they start and roughly where.

## Proposed design

1. **Rows first (shipped in the profile PR, migration `20261110000000`).** Add `coalesce(posts.visible_at, posts.created_at) <= now()`
   to both non-owner read policies on `posts` ("posts are readable by their audience" and "group posts are readable by the group").
   The owner keeps full access. This alone satisfies goal 2: a Moment inside its delay cannot be selected, so its
   `created_at` cannot be read.
2. **Public replacements for the two exact columns.** Add `posts.activity_starts_at` (the Activity start, only set when the
   author marks the Moment as an Activity, and rounded to the hour or day) and `posts.place_label` (the coarse label already
   derived from `location_privacy`, computed in a trigger, not in the browser).
3. **Column grants.** `revoke select on public.posts from anon, authenticated`, then grant select on every column except
   `starts_at`, `location_name`, `created_at` (use `visible_at` for ordering and "3h ago" for non-owners).
   A column added later stays private until granted.
4. **Owner reads.** `get_my_post_private()` (already in the profile migration) returns the owner's exact `starts_at`,
   `location_name` and `created_at` for their own Moments, so Edit details and "visible at" keep working.
5. **Backfill.** Fill `activity_starts_at` and `place_label` for existing posts from the old columns, in a migration
   that follows the append-only rule.

## Everything that has to change

**Client reads of `posts` (26 queries in 11 files):**

- `src/app/context/ContentContext.tsx` (9 queries, the `BASE_POST_COLUMNS` / `POST_COLUMNS` tiers, `rowToPost`, the insert's returning list, the update patch for `starts_at` / `location_name`)
- `src/app/lib/sharedContent.ts` (6 queries; Moments shared into chats)
- `src/app/components/AddMomentToSpaceDialog.tsx` (2)
- `src/app/lib/people.ts` (2)
- `src/app/components/space/SpaceManageTab.tsx`, `src/app/context/RewardsContext.tsx` (count only), `src/app/lib/cornerSuggestions.ts`, `src/app/lib/publicShelves.ts`, `src/app/lib/pursuitsRemote.ts`, `src/app/pages/SpacePage.tsx`, `src/app/pages/Studio.tsx`

**Client display of the values (15 uses of `post.createdAt`, plus `startsAt`, `locationName`):**
`MomentCard`, `MomentDetail`, `home/FeedCard`, `HobbyActivity`, `lib/homeFeed.ts` (sorts by `createdAt`), `lib/needsYou.ts`,
`AddDetailsSheet`, `log/PostedScreen`, `pages/Log.tsx` (writes both for Activities).

**Database functions and triggers that read `posts` and are reachable by `anon` or `authenticated`:**
`corner_activity_30d`, `you_inspired_this_month`, `set_space_moment_status`, `notify_space_moment_status`,
the save-notification trigger, the reaction-count triggers (`post_reaction_counts`), the Space moment sharing and approval
functions (`20261005`, `20261008`, `20261010`). Each needs a read-only check that it does not return the three columns;
none is known to today, but a "select *" inside any of them would break once columns are revoked.

**Not affected:** the profile functions (`get_profile_moments`, `get_profile_stubs`, `get_profile_pursuits`), which are
`security definer` and read `post_private`, never the old columns.

## Copy to restore when this ships

The first-run Moments caption on the profile now reads only "Your Moments show up here." Once the
three columns are locked down, restore the full caption: **"Your Moments show up here. Friends see
the day and neighborhood, never the exact time."** Change it in
`src/app/components/profile/MomentsPane.tsx` (`NewOwnerGrid`), in the first-run test in
`src/app/pages/Profile.test.tsx`, and in the matching row in `docs/glossary.md`. The owner's
"Visible to others at …" label stays as it is.

## Risks

- **Coordinated deploy.** Once a column is revoked, any query that names it fails with "permission denied for column".
  The client must stop selecting the three columns **before** the migration runs. Ship in two steps: client first
  (reads only the new public columns, with a fallback), migration second.
- `insert(...).select(POST_COLUMNS)` and `update(...).select(...)` need SELECT on every returned column.
- Realtime and any external PostgREST client with `select=*` will start to fail. Check Supabase logs first.
- Existing Activities rely on the exact `starts_at` for "upcoming" logic (`FeedCard`, `HobbyActivity`); rounding must not move an event across a day.

## Estimate

| Step | Days |
|---|---|
| Audit every reader (queries, RPCs, triggers, realtime, logs) and settle the rounding rule | 1 |
| Migration, backfill, rollback, verification script with non-owner direct-select checks, staging run | 2 |
| Client: split the column lists, map the new columns, owner reads through the function, ordering by `visible_at` | 2 to 3 |
| Tests (mapper, feed ordering, Log guard update, e2e of an Activity) and staging soak | 1 to 2 |
| Two-step deploy and a watch of the logs | 0.5 |

Step 1 of the design (the row policy) shipped in the profile PR and closes the `created_at` leak during the delay, so the
remaining work is about 5.5 to 8.5 days. Because of it, a Moment is now invisible to everyone but its owner for 2 hours: check
Home, Spaces, Corners and chat shares on staging for anything that expects a new Moment to show at once.
