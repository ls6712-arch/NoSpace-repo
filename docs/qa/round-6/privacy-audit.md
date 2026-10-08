# Privacy audit: profiles and everything a public Shelf loads

Checked on 2026-10-08 against the live project (`eyzokuhhbyidvmuqfmwm`), read-only. Nothing on the live database was changed.

## How it was checked

- **Catalog:** every table in `public`, its row level security state, every SELECT policy, and column privileges for `anon` (logged out) and `authenticated` (logged in), straight from `pg_class`, `pg_policy` and `has_column_privilege`. Not taken from `docs/schema-baseline-*.sql`.
- **Behavior:** a rolled-back transaction that switches to `anon`, and to an ordinary logged-in member who is not the owner, and counts what each can actually read. Counts only, no personal data was copied out.
- **Code:** which tables and columns the public Shelf (`PublicProfile.tsx` and what it imports) and the providers mounted on every page actually query.
- **Fixtures:** the verification scripts for the fixes were run on the live project before their migrations (they fail as expected, proving the leak) and rolled back; a read-only query afterwards found no fixture rows left.

"Logged out" means `anon`. "Logged in, not the owner" means `authenticated` reading someone else's data. "Rows" is what the row policy lets through.

## Result in one paragraph

No email, password or token is readable: `profiles` has no email column, `auth.users` is not readable by `anon` or `authenticated`, and the only other column named like one (`waitlist.email`, `pursuit_invite_links.token`) is admin-only and owner-only. Private Moments, drafts, private logs, blocks, notifications, messages, bookmarks, reflections, settings and read receipts are not readable by anyone but their owner (and, for messages and read receipts, the other person in the conversation). **Two things were clearly wrong and are fixed in this branch's PRs: the owner-only columns of `profiles` were world-readable (including `is_admin`), and pending and declined follow requests were readable by any logged-in person.** Everything else that could be questioned is a judgment call and is listed under "Flagged, not changed".

## 1. `profiles` (21 columns)

Rows: every profile that is not paused, not deleting and not blocked either way (10 of 10 at the time). Every column below was readable by both roles.

| Column | Logged out | Logged in, not owner | Should they? | What was done |
|---|---|---|---|---|
| `id`, `username`, `display_name`, `avatar_url`, `tagline`, `bio` | yes | yes | Yes: what a public Shelf shows | Nothing |
| `cover_title`, `cover_tagline`, `cover_post_id` | yes | yes | Yes: the Shelf cover | Nothing |
| `created_at` | yes | yes | Yes: when someone joined (low sensitivity) | Nothing |
| `paused_at`, `deletion_requested_at` | yes, but always empty | yes, but always empty | Only the owner. The row policy hides any profile where either is set, so nothing leaks today | Nothing. They stay readable so the policy function and the owner's own pause flow keep working |
| `is_admin` | **yes** (1 admin identifiable) | **yes** | **No** | **Fixed in the profile column privacy PR** |
| `access`, `invited_by`, `invite_allowance` | **yes** | **yes** | **No**: internal invite state | **Fixed in the same PR** |
| `onboarding_completed`, `onboarding_completed_at` | **yes** | **yes** | **No**: internal state | **Fixed in the same PR** |
| `theme_preference` | **yes** | **yes** | **No**: a personal setting | **Fixed in the same PR** |
| `discoverable`, `show_this_corner` | **yes** | **yes** | **No**: privacy settings. Nothing in the app reads them | **Fixed in the same PR** (but see "Flagged": `discoverable` is not enforced anywhere) |

The fix needs a client change and cannot go live with the current production code, so it ships in two steps: the new client (in #163) reads those columns through a new owner-only function `my_profile_private()` when it exists and falls back to the old read when it does not; the migration that hides the columns is its own draft PR, merged after #163 is live.

## 2. Tables the public Shelf queries

What a visitor's Shelf page touches: `profiles`, `posts`, `pursuits` and `pursuit_progress` (shared Pursuits), `profile_links`, `shared_milestones`, `profile_follows` (counts, lists, the follow button). The providers on every page add `corners`, `space_corners`, `app_config`, and for a logged-in person `post_likes`, `reactions`, `thoughts`, `hobby_follows`, `blocks`, `reports` and `profile_settings`.

### `posts` (24 columns)

Rows: logged out, public Moments of visible profiles (35 at the time). Logged in, the same plus followers-only Moments of people they follow with an accepted follow. Private ("Only you") Moments: never. A logged-in non-owner saw 0 non-public Moments.

| Columns | Logged out | Logged in, not owner | Should they? | Result |
|---|---|---|---|---|
| `id`, `user_id`, `hobby_slug`, `sub_hobby`, `corner`, `interest`, `type`, `caption`, `tags`, `pinned`, `visibility`, `created_at`, `pursuit_id`, `thoughts_private` | yes (public Moments) | yes | Yes: Moment content | Nothing |
| `likes`, `love_count`, `in_count` | yes | yes | Yes: counts shown on the Moment | Nothing |
| `media_url`, `media_urls`, `media_paths` | yes | yes | Yes: the Moment's media. New uploads sit in a private bucket and need a signed URL; the stored paths are not secrets | Nothing |
| `starts_at`, `location_name`, `location_privacy` | yes | yes | **Judgment**: `location_name` is returned whatever `location_privacy` says; only the client honors the setting. No public Moment has a location today (0 rows) | Flagged |
| `reflection` | yes, but empty | yes, but empty | No one: 0 non-empty values. The column is dropped by the reflections PR | Nothing here |

### `pursuits` (28 columns) and `pursuit_progress` (8 columns)

Rows: a Pursuit the owner marked shared is readable by anyone, logged in or not; an unshared one only by its owner and its participants (a participant sees it, which is correct: 2 unshared Pursuits were visible to a logged-in member because they were a participant). Nothing was shared at the time (0 rows for a visitor). Progress rows follow the Pursuit.

| Columns | Logged out | Logged in, not owner | Should they? | Result |
|---|---|---|---|---|
| `id`, `user_id`, `title`, `hobby_slug`, `sub_hobby`, `interest`, `custom_space`, `inspired_by_post_id`, `shared`, `started_at`, `finished_at`, `updated_at`, `goal_*` (shape, label, target number, unit, current, target date, reached at, verb), `mode`, `measure`, `cover_image_path`, `cover_image_preference` | yes, if shared | yes, if shared | Yes: what a shared Pursuit shows | Nothing |
| `paused_at`, `let_go_at`, `ending_note`, `check_in_days` | yes, if shared | yes, if shared | **Judgment**: the note written when someone lets a Pursuit go and the check-in cadence are returned for any shared Pursuit | Flagged |
| progress: `id`, `pursuit_id`, `user_id`, `amount`, `note`, `image_url`, `post_id`, `created_at` | yes, if shared | yes, if shared | Yes: this is the Pursuit's progress | Nothing |

### `profile_follows` (5 columns)

Rows: logged out, none. Logged in, every row between visible profiles. **That included pending and declined requests between other people: 3 pending rows between two other people were readable by an ordinary member.**

| Columns | Logged out | Logged in, not owner | Should they? | Result |
|---|---|---|---|---|
| `follower_id`, `followed_id`, `created_at` | no | accepted rows: yes. Pending and declined rows: **were yes** | Accepted: yes (follower lists). Pending and declined: **no**, only the two people in them | **Fixed in #163** (`20261021000000_hide_follow_requests.sql`) |
| `status` | no | same | same | Fixed in #163 |
| `responded_at` | no | accepted rows: yes (when a request was answered) | **Judgment**, low | Flagged |

### Other tables the Shelf touches

| Table (columns) | Logged out | Logged in, not owner | Should they? | Result |
|---|---|---|---|---|
| `profile_links` (`id`, `user_id`, `label`, `url`, `position`, `created_at`) | no | yes | Yes for logged in. **Judgment**: a logged-out visitor does not see links on a public Shelf | Flagged (more restrictive than needed, not a leak) |
| `shared_milestones` | does not exist on the live database | does not exist | n/a: the Shelf's request fails quietly | Nothing read, nothing to fix. The table's migration was never run |
| `post_likes` (`user_id`, `post_id`, `created_at`) | no | yes: any person's likes | **Judgment**: who liked what is visible to every logged-in person (0 rows today) | Flagged |
| `reactions` (`id`, `post_id`, `user_id`, `type`, `created_at`) | no | only your own, and reactions on your Moments | Yes | Nothing |
| `thoughts` (`id`, `post_id`, `user_id`, `prompt`, `body`, `created_at`, `media_url`) | yes, on public Moments whose thoughts are not private (1 row) | yes | **Judgment**: the policy intends this | Flagged |
| `hobby_follows` (`user_id`, `hobby_key`, `created_at`) | no | yes: any person's Corner follows (16 rows) | **Judgment**: code comments call these "private Interests", but People matching reads them | Flagged |
| `corners` (`id`, `space_slug`, `slug`, `name`, `moment_count`, `created_at`, `description`, `hidden`) | no | yes | Yes: Corner names and counts | Nothing |
| `space_corners` (`space_id`, `corner_id`, `is_primary`, `added_at`) | yes | yes | Yes: as visible as the Space | Nothing |
| `app_config` (`key`, `value`, `updated_at`) | yes | yes | Yes: product settings only (the Corner minimum, a blocked-name list, invite and Space limits). No secret | Nothing |
| `profile_settings` (`user_id`, `default_visibility`, `paused_until`, `username_changed_at`, `notification_preferences`, `read_receipts`) | no | no | Owner only | Nothing: 0 rows of anyone else's |
| `blocks` (`blocker_id`, `blocked_id`, `created_at`) | no | only your own list | Owner only | Nothing. The person who is blocked cannot see it |
| `reports` (11 columns) | no | your own reports (admins all) | Yes | Nothing |
| `pursuit_members` (6 columns) | no | participants only | Yes | Nothing |
| `pursuit_plans` (6 columns), `pursuit_invite_links` (5 columns) | no | owner only | Yes | Nothing |

## 3. The private things you named

| Thing | Table | Logged out | Logged in, not owner | Result |
|---|---|---|---|---|
| Private Moments | `posts` (visibility `private`), `private_logs` | no | no | Owner only |
| Drafts | `moment_drafts` | no | no | Owner only (0 rows of anyone else's) |
| Blocks | `blocks` | no | only your own | Fine |
| Read receipts | `conversation_reads`, `profile_settings.read_receipts` | no (the query is refused) | only your own row. A sender sees when the other person last read only if **both** have read receipts on (`thread_seen_at` checks the caller's setting, `other_party_seen_at` checks the other person's) | Fine |
| Notifications, bookmarks, reflections | `notifications`, `bookmarks`, `post_reflections` | no | no | Owner only |
| Messages | `messages` | no | only the two people in an accepted conversation | Fine |
| Settings | `profile_settings`; the `profiles` setting columns | no | `profile_settings` no; the `profiles` setting columns **were yes** | Fixed (see section 1) |
| Email and auth data | `auth.users`; `waitlist` | no | no (`waitlist` is admin-only) | Fine |

## 4. Fixed

| Fix | Where | Safe with the production code today? |
|---|---|---|
| Pending and declined follow requests are readable only by the two people in them | `supabase/migrations/20261021000000_hide_follow_requests.sql` in #163, `supabase/verification/hide_follow_requests_check.sql` | Yes. Follower lists already filter on accepted |
| Nine owner-only `profiles` columns (including `is_admin`) readable only by the owner, through `my_profile_private()` | `supabase/migrations/20261023000000_profiles_column_privacy.sql` and its check, in its own draft PR | **No**: merge only after #163 is live. The client change that makes it safe is in #163 (`src/app/lib/ownProfile.ts`) |

Before the fixes, both verification scripts were run on the live project (rolled back). The follow-request script fails 6 checks (an ordinary member reads all three fixture follows, including the pending and declined ones). The column script fails 7 (`anon` and `authenticated` read all nine columns, a member reads another account's `is_admin = true`, a wildcard read returns them). Both pass on a scratch Postgres with the same tables, policies and grants after their migrations, and each fails again if the fix is removed.

## 5. Flagged, not changed (judgment calls for you)

1. **`hobby_follows`**: any logged-in person can read any other person's Corner follows. Code comments call them "private Interests", yet People matching reads them. If they are private, matching needs a function that returns overlap without the rows.
2. **`post_likes`**: any logged-in person can see who liked which Moment, including on Moments they cannot open. Nothing is liked yet.
3. **`posts.location_name`, `starts_at`**: returned for every public Moment whatever `location_privacy` says. Only the client hides the exact place. No public Moment has one today, so this is a rule to decide before the first one.
4. **`pursuits`**: a shared Pursuit exposes `ending_note`, `let_go_at`, `paused_at` and `check_in_days` to everyone. Decide whether "shared" should include them.
5. **`thoughts`**: thoughts on a public Moment whose thoughts are not private are readable by logged-out visitors.
6. **`participations`**: open calls (`to_user` empty) are readable by everyone, logged out too, including `note`, `intent` and who sent them. None exist now.
7. **`space_members`**: the roster (members and hosts) of an open Space is readable by anyone, logged out too, which sits oddly with "Spaces have no member counts anywhere in the UI". 2 rows today.
8. **`discoverable`**: the setting exists but no policy or query enforces it. Every profile is readable by anyone who asks for the list, whatever it says. Hiding the column (fixed above) does not make it do anything.
9. **Helper functions callable by `anon`** with any user id: `is_space_member`, `is_space_host`, `is_pursuit_participant`, `is_visible_profile`, `pursuit_person_name`. They answer "is this person in that Space or Pursuit" for anyone who knows both ids, and `pursuit_person_name` returns a display name even for a paused account. The row policies call them as the visitor, so `anon` needs execute; closing this means redesigning those policies.
10. **`profile_links`** are not shown to logged-out visitors, which is stricter than the "public link anyone can view" Shelf. A product question, not a leak.
11. **`profile_follows.responded_at`** shows when a request was answered, to any logged-in person, for accepted follows.

## 6. Not checked

- Whether the `private` schema is exposed through the REST API (Supabase dashboard, API settings, Exposed schemas). If it is, its functions such as `private.is_admin(uuid)` would be callable by anyone. The default is not exposed. Worth a look.
- Storage buckets and object policies (the Moment media bucket is private, avatars public; not audited here).
- Edge functions, and Realtime publications (Realtime applies the same row policies).
- Write-side grants: for what it is worth, `anon` and `authenticated` hold column INSERT grants on every `profiles` column including `is_admin`. The insert policy requires `id` to be the caller's own and `is_admin` to be false, and every account already has its profile row from the sign-up trigger, so it cannot be used today; the grants are still broader than they need to be. Not changed.
