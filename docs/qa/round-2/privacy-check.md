# Privacy page vs what the app stores (R6)

Checked against the live schema (read-only query of `information_schema`) and
`src/app/pages/PrivacyPolicy.tsx`. The legal text was not rewritten.

## What the page says it collects

Email, display name, password or Google account, profile contents, Moments
(photos and notes), thoughts, messages, who you follow, waitlist email and the
"what do you make?" answer, and (until the reflection data is deleted) private
reflections.

## Stored but not mentioned on the page

| Stored data | Table or source |
|---|---|
| Pursuits, their goals, logged progress and members | `pursuits`, `pursuit_progress`, `pursuit_members`, `pursuit_plans`, `pursuit_invite_links` |
| Space membership, join requests and answers, hosting, events, RSVPs | `space_members`, `space_join_requests`, `space_host_invites`, `events`, `space_events`, `event_rsvps` |
| Event addresses (members only) | `event_private_details`, `space_private_details` |
| Reactions (Love this, Count me in) and saved Moments | `reactions`, `post_likes`, `bookmarks` |
| Place names on Moments and how precisely they show | `posts.location_name`, `posts.location_privacy` |
| Follower relationships and follow requests (counts are shown publicly on the Shelf) | `profile_follows`, `connections` |
| Blocks and reports you file or that are filed about you | `blocks`, `reports`, `moderation_queue` |
| Notifications, read state, and "Seen" receipts in chats | `notifications`, `conversation_reads` |
| Unfinished Moment drafts, including draft photos | `moment_drafts` |
| Links on your profile, bio, tagline, cover | `profile_links`, `profiles` |
| Settings (default audience, theme, notification choices) | `profile_settings`, `profiles` |
| Who invited you and your invite allowance | `invites`, `profiles.invited_by` |
| Request-rate counters per account | `rate_limit_hits` |
| Corner follows | `hobby_follows` |
| Browser-only data (never sent to us): Pursuit journal, draft state, theme, saved Moments when logged out | `localStorage` |

## Mentioned but not stored

- **Private reflections.** Both tables hold 0 rows (`post_reflections` has 0 rows,
  `posts.reflection` has 0 non-empty values). The page still says they may exist
  until `20261021000000_drop_reflections.sql` runs (its own follow-up PR, not part of #163); then remove that sentence
  (`TODO(privacy: remove after reflection data deleted)`).
- **Date of birth.** The page has a TODO for it; nothing collects it today.
- **Corner notes** (the private line you could write under a Corner) were stored
  in the browser only and never reached the server. The feature is removed.

## Not checked

- What Supabase Auth stores by itself (sign-in times, IP addresses in its logs).
- Vercel's request logs.
