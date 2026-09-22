-- My Space's "You Inspired" section (docs/my-space-spec.md's newest round):
-- who started a Pursuit this month with a real, recorded link back to one
-- of your own Moments.
--
-- The spec's own words: "This needs a defined heuristic before backend work
-- starts; flag that as an open decision rather than guessing at the join
-- logic here." Decided (proposed and implemented on request, not silently
-- guessed): pursuits.inspired_by_post_id (sql/pursuits.sql, added well
-- before this feature, in the original Pursuits work) already exists — an
-- explicit, recorded link, not an inferred one from reaction timing.
-- "Shortly after engaging with this user's post via an 'I'm in' or similar"
-- (the spec's own suggested fallback) would mean joining public.reactions
-- to posts.hobby_slug on a timing window with no explicit causal claim
-- behind it — weaker and guessier than a column that already says,
-- plainly, "this Pursuit came from that Moment." Used instead.
--
-- Correction from this migration's first draft: PursuitDialog.tsx's
-- seedPost prop already threaded inspiredByPostId through, but before a
-- review pass caught it, nothing ever called PursuitDialog with someone
-- ELSE's post — Log.tsx's own "Start a Pursuit" only ever seeds from the
-- Moment you're publishing yourself (self-referential: pursuit owner ==
-- inspiring post's author, which this function's own `p.user_id <>
-- auth.uid()` filter excludes), and MomentDetail.tsx's owned-only "Add to
-- Pursuit" action never set inspiredByPostId at all. Concretely: every row
-- this table had before that fix made this function permanently return
-- zero rows for every user, forever. Fixed alongside this migration by
-- adding a real cross-user entry point — MomentDetail.tsx's "Start a
-- Pursuit — inspired by this" button, shown only when viewing someone
-- else's Moment, opening PursuitDialog with seedPost set to that Moment.
-- PursuitDialog's own submit handler already mirrors every new Pursuit to
-- Supabase via mirrorPursuit regardless of shared status (see journal.ts),
-- so a Pursuit started this way is durably recorded the same way as any
-- other, with inspired_by_post_id pointing at the other person's post.
--
-- "Computed monthly" is read as *scoped* to the current calendar month
-- (matches the mockup's own "This month, 2 people…" copy), not a
-- precomputed/batch job — this app has no cron or materialized-view
-- infrastructure anywhere else, so a live, cheap, indexed query is the
-- consistent choice, re-run each time My Space loads rather than invented
-- as a new kind of infrastructure for one card.
--
-- Privacy: pursuits' own RLS ("you see your own pursuits, others see only
-- shared ones" — sql/pursuits.sql) would normally hide a private,
-- unshared Pursuit from the very person who inspired it. This function
-- runs security definer specifically to cross that boundary in one
-- narrow, intentional way: the viewer (auth.uid(), read from the session,
-- never a passed-in parameter — nothing here can be pointed at someone
-- else's account) sees only pursuits whose inspired_by_post_id points at
-- a Moment *they themselves* authored, and only pursuit_title/hobby/
-- started_at — not goal details, description, or anything else a real
-- shared-pursuit view would carry. That's the same category of exposure
-- the spec's own mockup copy already assumes ("one picked up glazing…"),
-- kept as narrow as it can be and still support that sentence.
--
-- Draft only — staged for review. Do not run this against Supabase until
-- it's been approved.
--
-- ── UP ──────────────────────────────────────────────────────────────────
create or replace function public.you_inspired_this_month()
returns table (
  pursuit_id text,
  started_at timestamptz,
  pursuit_title text,
  pursuit_hobby_slug text,
  pursuit_sub_hobby text,
  inspiring_post_id bigint,
  inspiring_post_caption text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.started_at,
    p.title,
    p.hobby_slug,
    p.sub_hobby,
    po.id,
    po.caption
  from public.pursuits p
  join public.posts po on po.id = p.inspired_by_post_id
  where po.user_id = auth.uid()
    and p.user_id <> auth.uid()
    and p.started_at >= date_trunc('month', now())
  order by p.started_at desc
  limit 20;
$$;

-- authenticated only, not anon — there's no "you" to compute this for
-- signed out, and the function's whole premise is auth.uid() being real.
revoke all on function public.you_inspired_this_month() from public;
grant execute on function public.you_inspired_this_month() to authenticated;
