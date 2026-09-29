-- Rollback for 20261010000000_space_moment_sharing.sql.
--
-- Restores "posts are readable by their audience" to its pre-this-migration
-- body (author/public/followers only — the same one this migration itself
-- carried over verbatim, minus the new space branch) and
-- set_space_moment_status() to its pre-this-migration body (20261005000000,
-- no just_me check), then drops the index this migration added.
--
-- Not destructive of Circle-era wording, Circle branches, etc. — this pair
-- of migrations never touched Circles.

drop policy if exists "posts are readable by their audience" on public.posts;
create policy "posts are readable by their audience"
  on public.posts for select
  using (
    (select auth.uid()) = user_id
    or (visibility = 'public' and is_visible_profile(user_id))
    or (
      visibility = 'followers'
      and (select auth.uid()) is not null
      and is_visible_profile(user_id)
      and exists (
        select 1 from public.profile_follows pf
        where pf.followed_id = posts.user_id
          and pf.follower_id = (select auth.uid())
          and pf.status = 'accepted'
      )
    )
  );

create or replace function public.set_space_moment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_posting_mode text;
  v_author_id uuid;
begin
  select posting_mode into v_posting_mode from spaces where id = new.space_id;
  select user_id into v_author_id from posts where id = new.post_id;

  if v_posting_mode = 'approval' and not public.is_space_host(new.space_id, v_author_id) then
    new.status := 'pending';
  else
    new.status := 'approved';
  end if;
  return new;
end;
$$;

drop index if exists public.space_moments_post_idx;
