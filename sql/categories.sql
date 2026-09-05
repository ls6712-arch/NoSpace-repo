-- NoSpace: category suggestions, and who reviews them.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Independent of the other files — it adds one table and one
-- flag, and touches nothing that already exists.
--
-- The fifteen discovery categories live in the app's own code, because they
-- are signage rather than data. What needs a database is the sixteenth
-- option: someone telling us the list is missing something.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Who can review suggestions
--
--    A plain flag on the profile. Nobody has it until you grant it, which
--    means the admin screen is invisible to everyone by default.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists is_admin boolean not null default false;

/**
 * Whether this person reviews suggestions. SECURITY DEFINER so a policy can
 * call it without re-entering the profiles policies and looping.
 */
create or replace function public.is_admin(u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = u), false);
$$;

-- Make yourself an admin — replace the address with your own and run it:
--
--   update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'you@example.com');

-- ─────────────────────────────────────────────────────────────────────────
-- 2. The suggestions themselves
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.category_suggestions (
  id bigint generated always as identity primary key,
  suggested_by uuid references auth.users (id) on delete set null,
  name text not null,
  description text,
  /** A few of the things that would live under it, in the suggester's words. */
  examples text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'merged', 'rejected')),
  /** When merged, the existing category slug it was folded into. */
  merged_into text,
  /** The reviewer's note, so a decision isn't a silent disappearance. */
  review_note text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.category_suggestions enable row level security;

-- You can see your own suggestions and what happened to them. Reviewers see
-- everything. Nobody else sees anyone else's.
drop policy if exists "you see your own suggestions" on public.category_suggestions;
create policy "you see your own suggestions"
  on public.category_suggestions for select
  using (suggested_by = auth.uid() or public.is_admin(auth.uid()));

drop policy if exists "anyone signed in can suggest" on public.category_suggestions;
create policy "anyone signed in can suggest"
  on public.category_suggestions for insert to authenticated
  with check (suggested_by = auth.uid());

-- Only a reviewer decides. The suggester cannot approve their own.
drop policy if exists "reviewers decide" on public.category_suggestions;
create policy "reviewers decide"
  on public.category_suggestions for update
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "you can withdraw your own suggestion" on public.category_suggestions;
create policy "you can withdraw your own suggestion"
  on public.category_suggestions for delete
  using (suggested_by = auth.uid() or public.is_admin(auth.uid()));

create index if not exists category_suggestions_status_idx
  on public.category_suggestions (status, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Approved categories
--
--    An approved suggestion becomes a row here, and the app reads these
--    alongside the fifteen built in. Existing hobbies and interests are
--    never touched by any of this: a category is a way of finding things,
--    not a label stored on them, so adding or removing one cannot invalidate
--    a single post.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.categories (
  slug text primary key,
  name text not null,
  description text,
  examples text[],
  keywords text[],
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;

drop policy if exists "categories are public" on public.categories;
create policy "categories are public"
  on public.categories for select using (true);

drop policy if exists "reviewers manage categories" on public.categories;
create policy "reviewers manage categories"
  on public.categories for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
