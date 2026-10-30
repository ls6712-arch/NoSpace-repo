# Deferred migrations

Not in `supabase/migrations/`, so no tool applies them. They have never been run.

- `20261102000000_space_events_listing.sql` (with its rollback and verification script): the event fields **and** `spaces_with_member_moments()`, which hides a Space with no member Moments. Live had one active Space and it had none, so the hiding would have emptied Discover, Corner pages and Search. Only the event fields shipped, as `20261106000000_space_events_listing_fields.sql`. The hiding comes back later (see `docs/backlog.md`): when it does, take section 2 of this file into a new migration, and make partner Spaces (`spaces.is_partner`) always exempt.
