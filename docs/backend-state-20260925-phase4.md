# Backend state, checked 2026-09-25 — Communication Phase 4

Project: `eyzokuhhbyidvmuqfmwm`. Covers
`supabase/migrations/20261005000000_communication_phase4_rich.sql`, applied
live via `apply_migration` after Sush's explicit OK on the staged
migration/rollback/verification script.

## What changed

1. `public.messages` gained five columns: `kind text not null default
   'text'` (`text`/`photo`/`moment`/`pursuit`, `messages_kind_check`),
   `media_path text`, `shared_post_id bigint references public.posts(id) on
   delete set null`, `shared_pursuit_id text references
   public.pursuits(id) on delete set null`, and `deleted_at timestamptz`.
   Every existing row already satisfies the new shape (`text`, all
   attachment columns null) — no backfill needed. Two new check
   constraints: `messages_kind_shape` (exactly the one attachment column
   matching `kind` is set, all others null — bypassed once `deleted_at` is
   set, since an unsent message carries no content regardless of its
   original `kind`) and `messages_body_or_attachment` (an empty `body` is
   only valid when there's an attachment carrying the message instead, same
   `deleted_at` bypass).
2. `message-media` — a new **private** (`public = false`) storage bucket
   for chat photos, 10 MiB limit, `image/jpeg`/`png`/`webp`/`gif` only.
   Object paths are `<participation_id>/<uuid>.<ext>` — the folder segment
   is the *thread*, not the uploader, since a chat photo needs to be
   readable by both people in it. Three policies: upload (a party to an
   *accepted*, not-blocked-between thread, into that thread's own folder —
   this is what actually stops a photo landing in a still-pending message
   request, not just the messages INSERT policy below), read (either party
   to the thread, not blocked-between, or an admin reviewing a message with
   an open/reviewed report against it — same precedent as `post-media`'s
   admin-review carve-out), delete (the uploader only, via storage's own
   `owner` column — unsend removes the object outright rather than leaving
   it orphaned). No UPDATE policy — a message photo never changes in place.
   Every policy compares the folder segment as **text**
   (`p.id::text = (storage.foldername(name))[1]`), never casting it to
   `bigint` — a `storage.objects` policy runs against every row regardless
   of bucket, so a bigint cast would throw on `post-media`/avatar paths
   whose first segment is a uuid, breaking ordinary Moment and avatar
   uploads. Caught in review before applying.
3. `messages`' own INSERT policy ("you can write in an accepted thread")
   extended, never loosened: three new AND-ed conditions on top of the
   existing accepted/pending structure — a pending `direct_message`'s one
   allowed message must be `kind = 'text'` (no photo or share in a message
   request); a photo's `media_path` must live under that message's own
   `participation_id` folder; sharing a Moment/Pursuit requires the
   `EXISTS` check against `posts`/`pursuits` to succeed under the
   *inserting user's own RLS* — an ordinary correlated subquery, not a
   bypass, so someone who can't currently see a Moment (private,
   followers-only they don't follow, deleted) can't reference it here
   either. This is also why a recipient's later read of a shared post never
   widens what they can see: the policy only narrows who may *create* the
   share row, and grants nothing extra to whoever later opens it.
4. `public.unsend_message(message_id bigint)` — `security definer`, not a
   raw UPDATE policy, specifically so nothing a caller supplies can widen
   what changes: it sets exactly `deleted_at`/`body`/`media_path`/
   `shared_post_id`/`shared_pursuit_id` and nothing else, sender-only (same
   generic error for "no such message" and "not your message," so a caller
   can't use it to probe for message ids that aren't theirs), idempotent
   (already-unsent is a silent no-op).
5. `public.participation_message_summaries()` — same shape and
   `unread_count` logic Phase 3 left it, `last_message_body` now a
   kind-aware CASE ("Message deleted" / "Photo" / "Shared a Moment" /
   "Shared a Pursuit" / the plain body) mirrored client-side in
   `messagePreviewText()` for the optimistic Realtime path.

`messages` was already in the `supabase_realtime` publication from Phase 2,
so the new `UPDATE`s (unsend) reach both parties live with no publication
change needed here.

## Verification

`supabase/verification/communication_phase4_check.sql` run live, inside a
transaction ending in `ROLLBACK`, using the same
`set_config('role', 'authenticated', true)` impersonation pattern as
Phases 1–3. Sush independently re-verified live afterward: the
`message-media` bucket and its three policies exist as written, no
`bigint` cast slipped through anywhere in `storage.objects`' policies,
ordinary `post-media` uploads (Moments) still work unaffected, and no test
data was left behind by the verification script's rollback.

## Security advisors

Run immediately after applying. No new findings that block anything. One
non-blocking performance note: `messages.shared_post_id` and
`messages.shared_pursuit_id` (the two foreign keys added in section 1
above) lack a covering index beyond what their target tables'
own primary keys provide — Postgres never auto-indexes the referencing
side of a foreign key. Left unaddressed at the time (not part of the
reviewed/approved migration, and `messages` was still small), tracked as a
follow-up.

**Follow-up, staged during Phase 4 Part B/C/D, not yet applied:**
`supabase/migrations/20261006000000_communication_phase4_shared_content_indexes.sql`
adds two partial indexes (`where shared_post_id is not null` /
`where shared_pursuit_id is not null`, since the large majority of rows
have both null) to close this note. Matching rollback at
`supabase/migrations/rollback_20261006000000_communication_phase4_shared_content_indexes.sql`.
Shown for review; needs the same explicit OK as any other migration before
it's applied.
