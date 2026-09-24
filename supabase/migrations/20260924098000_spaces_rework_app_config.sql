-- Sushii: Spaces Rework — app_config, a small key-value table for the
-- numbers this rework needs to be able to tune without a code deploy.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260924097000_spaces_rework_categories.sql.
--   Run BEFORE 20260924099000_spaces_rework_corners.sql and
--   20260924110000_spaces_rework_schema.sql — both read from this table
--   (the Corner/Space trademark-blocklist triggers).
--
-- Three settings, seeded with the values from this rework's spec:
--   corner_min_moments_30d       — a Corner needs at least this many public
--                                  Moments in the last 30 days (OR at least
--                                  one active Space) to show on Discover.
--                                  Start: 3.
--   space_creation_limit         — how many Spaces one person can create:
--                                  {new_account: 1, established: 5}. An
--                                  account counts as "established" once
--                                  it's 30+ days old.
--   trademark_blocklist          — names blocked for both Corners and
--                                  Spaces (case-insensitive substring
--                                  match — see is_blocklisted() below).
--                                  Starts with the one name that actually
--                                  came up (Q7 of this rework's own
--                                  discussion): LEGO.
--
-- Safe to re-run: seeds are `insert ... on conflict do nothing`, so a
-- value an admin has since changed by hand is never overwritten.

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;

drop policy if exists "app_config is readable when signed in" on public.app_config;
create policy "app_config is readable when signed in"
  on public.app_config for select using (auth.uid() is not null);

drop policy if exists "admins manage app_config" on public.app_config;
create policy "admins manage app_config"
  on public.app_config for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

insert into public.app_config (key, value) values
  ('corner_min_moments_30d', '3'::jsonb),
  ('space_creation_limit', '{"new_account": 1, "established": 5, "established_after_days": 30}'::jsonb),
  ('trademark_blocklist', '["lego"]'::jsonb)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- A single, reusable check: does this name contain a blocked term?
-- SECURITY DEFINER so a trigger on corners/spaces can call it regardless
-- of who's inserting — it only ever reads app_config, which read access
-- alone would already allow for any signed-in caller, but this keeps the
-- check self-contained and independent of RLS on app_config ever changing.
-- ─────────────────────────────────────────────────────────────────────────
-- Word-token match, not substring: candidate is split on anything that
-- isn't a letter/digit into lowercase tokens, and a term matches only when
-- some token equals it exactly (or its simple plural, term + "s") — not
-- when the term merely appears inside a longer word. Substring matching
-- (an earlier version of this function) false-positived on "leg of lamb"
-- (-> "legoflamb"), "allegory", "legolas", and "bootleg orchestra" all
-- containing "lego" as a run of letters; token matching passes all four
-- while still catching "LEGO Technic" (token "lego") and "Legos" (token
-- "legos", the plural form). Each blocklist term is itself folded the same
-- way (lowercased, non-alphanumerics stripped) before comparing, so a term
-- like "Lego" and a candidate token "lego" always compare equal regardless
-- of source casing. A multi-word term (none exist in the seed list) would
-- need to match a single token exactly, the same limitation as any
-- word-token scheme — worth knowing before adding one.
create or replace function public.is_blocklisted_name(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from jsonb_array_elements_text(
      coalesce((select value from public.app_config where key = 'trademark_blocklist'), '[]'::jsonb)
    ) as term,
    regexp_split_to_table(lower(candidate), '[^a-z0-9]+') as token
    where token <> ''
      and length(regexp_replace(lower(term), '[^a-z0-9]', '', 'g')) > 0
      and (
        token = regexp_replace(lower(term), '[^a-z0-9]', '', 'g')
        or token = regexp_replace(lower(term), '[^a-z0-9]', '', 'g') || 's'
      )
  );
$$;
revoke all on function public.is_blocklisted_name(text) from public;
grant execute on function public.is_blocklisted_name(text) to authenticated, anon;

-- ─────────────────────────────────────────────────────────────────────────
-- Check it
-- ─────────────────────────────────────────────────────────────────────────
-- select key, value from public.app_config order by key;
-- select public.is_blocklisted_name('LEGO Masters Club') as expect_true,
--        public.is_blocklisted_name('LEGO Technic') as expect_true_too,
--        public.is_blocklisted_name('Legos') as expect_true_also,
--        public.is_blocklisted_name('lego-builds') as expect_true_again,
--        public.is_blocklisted_name('Pottery') as expect_false,
--        public.is_blocklisted_name('Leg of lamb') as expect_false_too,
--        public.is_blocklisted_name('Allegory') as expect_false_also,
--        public.is_blocklisted_name('Legolas') as expect_false_again,
--        public.is_blocklisted_name('Bootleg Orchestra') as expect_false_again_too;
