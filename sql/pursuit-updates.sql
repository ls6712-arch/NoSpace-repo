-- NoSpace: link Moments/updates to the Pursuit they belong to.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run.
--
-- Before this, a post's only connection to a Pursuit lived in the client's
-- own localStorage (lib/journal.ts's entryProject map: postId → projectId).
-- That works instantly for the owner's own browser, with or without an
-- account, which is why it stays as the fast path everywhere it already
-- runs — but it never told anyone else's browser which posts belong to
-- which Pursuit, so a shared Pursuit's own page had no way to show its
-- updates to anyone but the owner on the exact device that made them.
--
-- pursuit_id is nullable and additive: a post with no Pursuit just leaves it
-- null, same as today. It references pursuits(id) — text, not a generated
-- identity, matching that table's own id (sql/pursuits.sql) — and is set on
-- delete null rather than cascading, since deleting a Pursuit shouldn't take
-- someone's actual Moments down with it.
alter table public.posts
  add column if not exists pursuit_id text references public.pursuits (id) on delete set null;

create index if not exists posts_pursuit_id_idx on public.posts (pursuit_id);
