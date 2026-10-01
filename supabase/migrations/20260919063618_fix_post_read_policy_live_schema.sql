-- BACKFILL: verbatim from supabase_migrations.schema_migrations.statements.
-- Pre-dates this repo's supabase/migrations/ directory. Not re-run, not
-- modified — copied exactly as recorded, including its own begin/commit.

begin;

-- 1. The loophole.
drop policy if exists "circle threads follow the circle's visibility" on public.posts;

-- 2. The Circle-thread policy, same shape as before, both spellings, sign-in required.
drop policy if exists "circle posts follow the circle's own visibility" on public.posts;
create policy "circle posts follow the circle's own visibility"
  on public.posts for select
  using (
    visibility = 'circle'
    and circle_id is not null
    and auth.uid() is not null
    and exists (
      select 1 from public.circles c
      where c.id = posts.circle_id - 1000000
        and (
          c.visibility in ('open_to_read', 'Open to read')
          or c.owner = auth.uid()
          or private.is_circle_member(c.id, auth.uid())
        )
    )
  );

commit;
