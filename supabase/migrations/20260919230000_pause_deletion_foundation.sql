-- Pause/deletion, migration (a): the columns and helper everything else in
-- this series builds on. Draft only — reviewed before being applied.
--
-- profiles keeps only lifecycle flags that are fine for anyone who can
-- already read the row to see. Postgres RLS is row-level, not column-level:
-- once a profiles row is visible, every column on it is visible to whoever
-- read it. So anything that shouldn't be public the moment a row is
-- readable — notification prefs, the default visibility for new Moments,
-- when the username last changed — goes in profile_settings instead, which
-- has its own owner-only policies.
alter table public.profiles
  add column if not exists paused_at timestamptz,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists discoverable boolean not null default true,
  add column if not exists show_this_corner boolean not null default true;

-- References profiles(id), not auth.users(id) like most tables in this
-- schema — profile_settings is conceptually an extension of a profile, not
-- a second auth-level record, and the cascade reaches the same place either
-- way since profiles.id already cascades from auth.users.
create table if not exists public.profile_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  default_visibility text not null default 'private'
    check (default_visibility in ('private', 'circle', 'public')),
  paused_until timestamptz,
  username_changed_at timestamptz,
  -- Brief's notification defaults (docs/CLAUDE-redesign-brief.md section
  -- 4.5), minus connection_requests (connections are retired) plus
  -- circle_invites in its place. Security emails are always-on and not a
  -- stored preference at all, per the same section.
  notification_preferences jsonb not null default jsonb_build_object(
    'circle_invites', true,
    'replies_to_my_moments', true,
    'circle_updates_joined', false,
    'weekly_digest', false,
    'product_news', false
  )
);

alter table public.profile_settings enable row level security;

create policy "you see your own settings"
  on public.profile_settings for select
  using (auth.uid() = user_id);

create policy "you create your own settings"
  on public.profile_settings for insert
  with check (auth.uid() = user_id);

create policy "you update your own settings"
  on public.profile_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Shared visibility check: the owner always sees their own rows regardless
-- of their own pause/deletion state; everyone else loses visibility the
-- moment either flag is set. posts and pursuits policies call this instead
-- of re-deriving the same check, so a later change (e.g. what deletion
-- should also hide) happens in one place.
create or replace function public.is_visible_profile(uid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select uid = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = uid
          and p.paused_at is null
          and p.deletion_requested_at is null
      );
$$;
