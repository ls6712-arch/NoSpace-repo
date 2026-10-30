-- Week view, PR 2: city_picks, the hand-picked "This week in New York" row.
--
-- Run AFTER 20261110010000_profile_backfill_moments.sql. Applied only with the founder's
-- written approval naming this file (CLAUDE.md).
--
-- The founder or an admin adds a few picks each week (Halloween, the marathon and so on).
-- Signed-in people read the published ones; only admins write, and admins also read
-- drafts, so the admin page can list, publish and unpublish them. There is no RSVP for a
-- pick: it is a card with a link out, nothing is collected here.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261111000000_city_picks.sql.

create table public.city_picks (
  id bigint generated always as identity primary key,
  city text not null default 'new-york' check (char_length(city) between 1 and 40),
  title text not null check (char_length(title) between 1 and 80),
  place text check (place is null or char_length(place) <= 80),
  starts_at timestamptz not null,
  ends_at timestamptz,
  -- The editor's own words: "free", "$25".
  price text check (price is null or char_length(price) between 1 and 40),
  url text check (url is null or (char_length(url) <= 500 and url ~* '^https://[^[:space:]]+$')),
  corner_id bigint references public.corners (id) on delete set null,
  -- One of the 8 category colours (theme.css --cat-*).
  color text not null default 'orange' check (color in ('rose', 'orange', 'violet', 'blue', 'amber', 'lime', 'teal', 'pink')),
  published boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

-- The Week view asks for published picks of a city by time.
create index city_picks_city_starts_idx on public.city_picks (city, starts_at) where published;

alter table public.city_picks enable row level security;

revoke all on public.city_picks from public, anon, authenticated;
grant select, insert, update, delete on public.city_picks to authenticated;

create policy "signed-in people read published picks, admins read all"
  on public.city_picks for select to authenticated
  using (
    city_picks.published
    or private.is_admin((select auth.uid()))
  );

create policy "admins add picks"
  on public.city_picks for insert to authenticated
  with check (private.is_admin((select auth.uid())));

create policy "admins edit picks"
  on public.city_picks for update to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

create policy "admins delete picks"
  on public.city_picks for delete to authenticated
  using (private.is_admin((select auth.uid())));
