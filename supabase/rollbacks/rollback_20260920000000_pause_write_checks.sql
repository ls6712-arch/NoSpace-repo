-- Reverses supabase/migrations/20260920000000_pause_write_checks.sql,
-- restoring the original two-policy-per-command pairs on posts and
-- pursuits, and the single original thoughts INSERT policy, exactly —
-- including each pair's original role scoping (one of each posts/pursuits
-- pair was `{public}`, the other `{authenticated}` — not identical
-- duplicates in every respect, just functionally overlapping).

drop function if exists public.write_blocked();

drop policy if exists "you post your own moments" on public.posts;
create policy "You can post as yourself"
  on public.posts for insert
  with check (auth.uid() = user_id);
create policy "you post your own moments"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "own posts are editable" on public.posts;
create policy "You can edit or delete your own posts"
  on public.posts for update
  using (auth.uid() = user_id);
create policy "own posts are editable"
  on public.posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "you create your own pursuits" on public.pursuits;
create policy "you can start a pursuit"
  on public.pursuits for insert
  to authenticated
  with check (auth.uid() = user_id);
create policy "you create your own pursuits"
  on public.pursuits for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "you edit your own pursuits" on public.pursuits;
create policy "you can update your own pursuit"
  on public.pursuits for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "you edit your own pursuits"
  on public.pursuits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "anyone signed in can add a thought" on public.thoughts;
create policy "anyone signed in can add a thought"
  on public.thoughts for insert
  to authenticated
  with check (auth.uid() = user_id);
