-- Soosh onboarding, PR 2 of 4: open sign-up and the account.
--
--   profiles.access          default becomes 'active': anyone can sign up, no invite
--                            needed (founder, Oct 29, 2026). Any account still
--                            'pending' is activated. The invites table and
--                            private.is_active() are untouched.
--   profiles.member_no       the number on the member card. Assigned once, by a
--                            trigger, from a sequence when the profile is created;
--                            existing profiles are numbered in created_at order.
--                            Never reused, never changed, never set by a client.
--   profile_private          three new owner-only columns:
--     birthdate              a date, at least 18 years ago at the moment it is
--                            written. Nothing that returns another person's data
--                            reads it (the table's policies are owner-only).
--     area                   the neighborhood, 1 to 80 characters
--     onboarding_step        the last finished onboarding screen, for resuming
--   profiles.username        unique, case-insensitive. A person can set it during
--                            onboarding only, through set_username_during_onboarding().
--                            After that it stays read-only, as before.
--   handle_new_user()        now makes a usable, unique username from the email
--                            prefix (it used to copy it as it was and could collide).
--
-- Checked against the live project on Oct 30, 2026 with read-only queries: 10
-- profiles, all 'active', none 'pending'; profile_private has 0 rows; profiles has
-- no unique index on username and no duplicate lowercase usernames; the
-- column-privacy migration (20261031000000) has NOT run there.
--
-- Run AFTER 20261102000000_space_events_listing.sql.
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261103000000_open_signup_and_account.sql.

-- 1. Open sign-up -----------------------------------------------------------

alter table public.profiles alter column access set default 'active';
update public.profiles set access = 'active' where access = 'pending';

-- 2. Member numbers ---------------------------------------------------------

create sequence public.profiles_member_no_seq as integer;
revoke all on sequence public.profiles_member_no_seq from public, anon, authenticated;

alter table public.profiles add column member_no integer;

update public.profiles p
set member_no = n.rn
from (
  select p2.id, (row_number() over (order by p2.created_at, p2.id))::integer as rn
  from public.profiles p2
) n
where n.id = p.id;

select setval('public.profiles_member_no_seq', coalesce((select max(p.member_no) from public.profiles p), 0) + 1, false);

alter table public.profiles alter column member_no set not null;
alter table public.profiles add constraint profiles_member_no_key unique (member_no);
alter table public.profiles add constraint profiles_member_no_positive check (member_no > 0);

create or replace function private.assign_member_no()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Whatever the caller sent is ignored: the number only ever comes from the sequence.
  new.member_no := nextval('public.profiles_member_no_seq');
  return new;
end
$$;
revoke all on function private.assign_member_no() from public;

create trigger profiles_assign_member_no
  before insert on public.profiles
  for each row execute function private.assign_member_no();

create or replace function private.lock_member_no()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.member_no is distinct from old.member_no then
    raise exception 'A member number can''t be changed.' using errcode = 'P0001';
  end if;
  return new;
end
$$;
revoke all on function private.lock_member_no() from public;

create trigger profiles_lock_member_no
  before update of member_no on public.profiles
  for each row execute function private.lock_member_no();

revoke insert (member_no), update (member_no) on public.profiles from anon, authenticated;

-- The owner's own number, whatever the column grants on profiles become later
-- (the column-privacy migration revokes table-wide SELECT on profiles).
create or replace function public.my_member_no()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select p.member_no from public.profiles p where p.id = (select auth.uid())
$$;
revoke all on function public.my_member_no() from public, anon;
grant execute on function public.my_member_no() to authenticated;

-- 3. The private account columns --------------------------------------------

alter table public.profile_private
  add column birthdate date,
  add column area text,
  add column onboarding_step text;

alter table public.profile_private
  add constraint profile_private_area_length check (area is null or char_length(area) between 1 and 80),
  add constraint profile_private_onboarding_step_known check (
    onboarding_step is null
    or onboarding_step in ('welcome', 'signup', 'code', 'name', 'birthday', 'where', 'picks', 'free', 'yours', 'card', 'plan', 'invite')
  );

-- The minimum age (18) is written here and in src/app/lib/age.ts: change both.
-- It is a trigger, not a CHECK, because it depends on today's date and only has
-- to hold at the moment the date is written.
create or replace function private.check_birthdate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birthdate is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.birthdate is not distinct from old.birthdate then
    return new;
  end if;
  if new.birthdate > current_date or new.birthdate < date '1900-01-01' then
    raise exception 'That date isn''t right.' using errcode = 'P0001';
  end if;
  if new.birthdate > (current_date - interval '18 years')::date then
    raise exception 'under_minimum_age' using errcode = 'P0001';
  end if;
  return new;
end
$$;
revoke all on function private.check_birthdate() from public;

create trigger profile_private_check_birthdate
  before insert or update of birthdate on public.profile_private
  for each row execute function private.check_birthdate();

-- 4. Usernames --------------------------------------------------------------

create unique index profiles_username_lower_key on public.profiles (lower(username));

create or replace function private.username_is_free(p_name text, p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_name <> all (array['admin', 'administrator', 'soosh', 'support', 'help', 'moderator', 'root', 'system'])
     and not exists (
       select 1 from public.profiles p
       where lower(p.username) = p_name and p.id is distinct from p_uid
     )
$$;
revoke all on function private.username_is_free(text, uuid) from public;

-- Returns 'ok', 'taken' or 'invalid'. Only while onboarding is not finished.
create or replace function public.set_username_during_onboarding(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := lower(btrim(coalesce(p_username, '')));
  v_done boolean;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  v_done := (select p.onboarding_completed from public.profiles p where p.id = v_uid);
  if v_done is distinct from false then
    raise exception 'Your username is already set.' using errcode = 'P0001';
  end if;
  if v_name !~ '^[a-z0-9_]{3,20}$' then
    return 'invalid';
  end if;
  if not private.username_is_free(v_name, v_uid) then
    return 'taken';
  end if;
  begin
    update public.profiles p set username = v_name where p.id = v_uid;
  exception when unique_violation then
    return 'taken';
  end;
  return 'ok';
end
$$;
revoke all on function public.set_username_during_onboarding(text) from public, anon;
grant execute on function public.set_username_during_onboarding(text) to authenticated;

-- The first free username near what was typed: itself, then name_ny, then name2 to name9.
create or replace function public.username_suggestion(p_username text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_base text := left(regexp_replace(lower(btrim(coalesce(p_username, ''))), '[^a-z0-9_]', '', 'g'), 20);
  v_cand text;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  if char_length(v_base) < 3 then
    v_base := left('user' || v_base, 20);
  end if;
  for v_cand in
    select c.name
    from (
      select v_base as name, 0 as ord
      union all select left(v_base, 17) || '_ny', 1
      union all select left(v_base, 19) || g.n::text, 1 + g.n from generate_series(2, 9) g(n)
    ) c
    order by c.ord
  loop
    if private.username_is_free(v_cand, v_uid) then
      return v_cand;
    end if;
  end loop;
  return left(v_base, 15) || '_' || (1000 + floor(random() * 9000))::integer::text;
end
$$;
revoke all on function public.username_suggestion(text) from public, anon;
grant execute on function public.username_suggestion(text) to authenticated;

-- A new account gets a usable username (letters, numbers, underscore, 3 to 20)
-- made from the email prefix, and a numeric suffix when that is taken. The
-- display name stays the email prefix as it was, so the app still knows it
-- has to ask for a real one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text := coalesce(nullif(split_part(new.email, '@', 1), ''), 'creator');
  v_base text := left(lower(regexp_replace(coalesce(nullif(split_part(new.email, '@', 1), ''), 'creator'), '[^A-Za-z0-9_]', '', 'g')), 20);
  v_name text;
  v_try integer := 0;
begin
  if char_length(v_base) < 3 then
    v_base := left('user' || v_base, 20);
  end if;
  v_name := v_base;
  loop
    begin
      insert into public.profiles (id, username, display_name)
      values (new.id, v_name, v_prefix);
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 10 then
        raise;
      end if;
      v_name := left(v_base, 15) || '_' || (1000 + floor(random() * 9000))::integer::text;
    end;
  end loop;
  return new;
end
$$;
