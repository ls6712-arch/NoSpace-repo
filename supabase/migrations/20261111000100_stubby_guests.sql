-- Stubby for guests: limits, the taste profile, feedback on picks, and cleanup.
--
--   stubby_asks         + guest (was this ask made as a guest) and ip_hash (an HMAC of the IP with
--                       a secret salt, made in the edge function; never the IP itself). ip_hash is
--                       cleared after 2 days by the existing purge.
--   claim_stubby_turn() replaces claim_stubby_ask() for the new edge function (the old one stays
--                       until the function is redeployed). One lock, then in order:
--                         per person   asks in the last 24 hours, guest and account asks together,
--                                      so a guest who signs up keeps the count they had
--                         new guests   at most N new guests per IP hash per hour
--                         per IP       guest asks per IP hash in 24 hours (about 3x the guest limit,
--                                      so a new guest identity can't reset anything)
--                         guest cap    guest asks across everyone in 24 hours
--                         global       every ask across everyone in 24 hours (as before)
--                       Returns the ask id, or a code and when the oldest counted ask ages out.
--   stubby_profiles     the taste profile: city, interests (from a fixed list), timing, budget. Own
--                       row only, for guests, Stubby accounts and members. No coordinates, ever.
--   stubby_feedback     up, down and save on a pick. The client sends the pick and the signal only;
--                       the title and kind are copied from the person's own pick by a trigger.
--   purge_inactive_guests()  deletes guests (and with them, by cascade, their profile, feedback,
--                       picks and asks) after 30 days without activity. The days are a setting.
--
-- Run AFTER 20261111000050_member_gate.sql.
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Verification: supabase/verification/stubby_guests_check.sql.
-- Rollback: rollback_20261111000100_stubby_guests.sql.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Settings
-- ─────────────────────────────────────────────────────────────────────────

create table private.stubby_settings (
  key text primary key check (key in ('guest_retention_days')),
  value integer not null check (value between 1 and 365)
);
alter table private.stubby_settings enable row level security;
revoke all on private.stubby_settings from public, anon, authenticated;
insert into private.stubby_settings (key, value) values ('guest_retention_days', 30);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Asks: guest flag, IP hash, and the new claim
-- ─────────────────────────────────────────────────────────────────────────

alter table public.stubby_asks
  add column guest boolean not null default false,
  add column ip_hash text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$');

create index stubby_asks_ip_idx on public.stubby_asks (ip_hash, asked_at desc) where ip_hash is not null;
create index stubby_asks_guest_idx on public.stubby_asks (asked_at desc) where guest;

create function public.claim_stubby_turn(
  p_user uuid,
  p_guest boolean,
  p_ip_hash text,
  p_per_user integer,
  p_per_ip integer,
  p_new_guests_per_ip_hour integer,
  p_guest_global integer,
  p_global integer
)
returns table (ask_id bigint, code text, resets_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz := now() - interval '24 hours';
  v_id bigint;
  v_oldest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('claim_stubby_ask'));

  if (select count(*) from public.stubby_asks a where a.user_id = p_user and a.asked_at > v_since) >= p_per_user then
    v_oldest := (select min(a.asked_at) from public.stubby_asks a where a.user_id = p_user and a.asked_at > v_since);
    return query select null::bigint, case when p_guest then 'GUEST_LIMIT_REACHED' else 'USER_LIMIT_REACHED' end, v_oldest + interval '24 hours';
    return;
  end if;

  if p_guest then
    if p_ip_hash is null then
      return query select null::bigint, 'GUEST_LIMIT_REACHED', now() + interval '24 hours';
      return;
    end if;
    -- A guest's first ask: no more than N new guests from one IP hash in an hour.
    if not exists (select 1 from public.stubby_asks a where a.user_id = p_user)
       and (
         select count(distinct a.user_id) from public.stubby_asks a
         where a.ip_hash = p_ip_hash and a.guest and a.asked_at > now() - interval '1 hour'
       ) >= p_new_guests_per_ip_hour then
      return query select null::bigint, 'GUEST_LIMIT_REACHED', now() + interval '1 hour';
      return;
    end if;
    if (select count(*) from public.stubby_asks a where a.ip_hash = p_ip_hash and a.guest and a.asked_at > v_since) >= p_per_ip then
      v_oldest := (select min(a.asked_at) from public.stubby_asks a where a.ip_hash = p_ip_hash and a.guest and a.asked_at > v_since);
      return query select null::bigint, 'GUEST_LIMIT_REACHED', v_oldest + interval '24 hours';
      return;
    end if;
    if (select count(*) from public.stubby_asks a where a.guest and a.asked_at > v_since) >= p_guest_global then
      return query select null::bigint, 'GUEST_GLOBAL_CAP', null::timestamptz;
      return;
    end if;
  end if;

  if (select count(*) from public.stubby_asks a where a.asked_at > v_since) >= p_global then
    return query select null::bigint, 'GLOBAL_CAP', null::timestamptz;
    return;
  end if;

  insert into public.stubby_asks (user_id, guest, ip_hash) values (p_user, p_guest, case when p_guest then p_ip_hash end)
    returning stubby_asks.id into v_id;
  return query select v_id, 'OK', null::timestamptz;
end;
$$;

revoke all on function public.claim_stubby_turn(uuid, boolean, text, integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_stubby_turn(uuid, boolean, text, integer, integer, integer, integer, integer) to service_role;

-- ip_hash is kept 2 days at most. The rest of the purge is as before.
create or replace function private.purge_stubby_rows()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.personal_picks p where coalesce(p.ends_at, p.starts_at) < now() - interval '2 days';
  delete from public.stubby_asks a where a.asked_at < now() - interval '30 days';
  update public.stubby_asks set ip_hash = null where stubby_asks.ip_hash is not null and stubby_asks.asked_at < now() - interval '2 days';
$$;

revoke all on function private.purge_stubby_rows() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. The taste profile
-- ─────────────────────────────────────────────────────────────────────────

create table public.stubby_profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- A city or neighborhood name. Never coordinates: no number with a decimal point.
  city text check (city is null or (char_length(city) between 1 and 80 and city !~ '[[:cntrl:]]' and city !~ '[0-9]+[.,][0-9]+')),
  -- The 8 mood ids (src/app/data/moods.ts), nothing typed.
  interests text[] not null default '{}'
    check (cardinality(interests) <= 10
       and interests <@ array['make', 'move', 'people', 'alone', 'outside', 'learn', 'play', 'haveIt']::text[]),
  timing text check (timing is null or timing in ('tonight', 'weekend', 'anytime')),
  budget text check (budget is null or budget in ('free', 'under_20', 'under_50', 'any')),
  updated_at timestamptz not null default now()
);

alter table public.stubby_profiles enable row level security;
revoke all on public.stubby_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.stubby_profiles to authenticated;

create policy "you read your own taste" on public.stubby_profiles for select to authenticated
  using (stubby_profiles.user_id = (select auth.uid()));
create policy "you add your own taste" on public.stubby_profiles for insert to authenticated
  with check (stubby_profiles.user_id = (select auth.uid()));
create policy "you change your own taste" on public.stubby_profiles for update to authenticated
  using (stubby_profiles.user_id = (select auth.uid()))
  with check (stubby_profiles.user_id = (select auth.uid()));
create policy "you remove your own taste" on public.stubby_profiles for delete to authenticated
  using (stubby_profiles.user_id = (select auth.uid()));
-- Own row only, for members too (the member gate's own-row form).
create policy "your own row" on public.stubby_profiles as restrictive for all to authenticated
  using (stubby_profiles.user_id = (select auth.uid()))
  with check (stubby_profiles.user_id = (select auth.uid()));

create function private.touch_stubby_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_stubby_profile() from public, anon, authenticated;

create trigger stubby_profiles_touch
  before insert or update on public.stubby_profiles
  for each row execute function private.touch_stubby_profile();

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Feedback on picks
-- ─────────────────────────────────────────────────────────────────────────

create table public.stubby_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pick_id bigint references public.personal_picks (id) on delete set null,
  signal text not null check (signal in ('up', 'down', 'save')),
  -- Copied from the pick by the trigger below; never sent by the client.
  title text not null check (char_length(title) between 1 and 150),
  kind text check (kind is null or kind in ('event', 'idea')),
  created_at timestamptz not null default now()
);

create unique index stubby_feedback_one_signal_idx on public.stubby_feedback (user_id, pick_id, signal) where pick_id is not null;
create index stubby_feedback_user_idx on public.stubby_feedback (user_id, created_at desc);

alter table public.stubby_feedback enable row level security;
revoke all on public.stubby_feedback from public, anon, authenticated;
grant select, delete on public.stubby_feedback to authenticated;
grant insert (pick_id, signal) on public.stubby_feedback to authenticated;

create policy "you read your own feedback" on public.stubby_feedback for select to authenticated
  using (stubby_feedback.user_id = (select auth.uid()));
create policy "you give feedback on your own picks" on public.stubby_feedback for insert to authenticated
  with check (
    stubby_feedback.user_id = (select auth.uid())
    and exists (
      select 1 from public.personal_picks pp
      where pp.id = stubby_feedback.pick_id and pp.user_id = (select auth.uid())
    )
  );
create policy "you remove your own feedback" on public.stubby_feedback for delete to authenticated
  using (stubby_feedback.user_id = (select auth.uid()));
create policy "your own row" on public.stubby_feedback as restrictive for all to authenticated
  using (stubby_feedback.user_id = (select auth.uid()))
  with check (stubby_feedback.user_id = (select auth.uid()));

-- The title and kind come from the person's own pick, so nothing typed reaches Stubby's prompt.
create function private.fill_stubby_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_kind text;
begin
  new.user_id := auth.uid();
  v_title := (select left(pp.title, 150) from public.personal_picks pp where pp.id = new.pick_id and pp.user_id = new.user_id);
  v_kind := (select pp.kind from public.personal_picks pp where pp.id = new.pick_id and pp.user_id = new.user_id);
  if v_title is null then
    raise exception 'not your pick' using errcode = '42501';
  end if;
  -- At most 200 a day each (checked here: a policy reading its own table would recurse).
  if (
    select count(*) from public.stubby_feedback f
    where f.user_id = new.user_id and f.created_at > now() - interval '24 hours'
  ) >= 200 then
    raise exception 'too much feedback today' using errcode = '54000';
  end if;
  new.title := v_title;
  new.kind := v_kind;
  new.created_at := now();
  return new;
end;
$$;
revoke all on function private.fill_stubby_feedback() from public, anon, authenticated;

create trigger stubby_feedback_fill
  before insert on public.stubby_feedback
  for each row execute function private.fill_stubby_feedback();

-- Up and down replace each other: a new one removes the opposite one on the same pick.
create function private.flip_stubby_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.signal in ('up', 'down') then
    delete from public.stubby_feedback f
    where f.user_id = new.user_id
      and f.pick_id = new.pick_id
      and f.signal = case when new.signal = 'up' then 'down' else 'up' end;
  end if;
  return new;
end;
$$;
revoke all on function private.flip_stubby_feedback() from public, anon, authenticated;

create trigger stubby_feedback_flip
  after insert on public.stubby_feedback
  for each row execute function private.flip_stubby_feedback();

-- ─────────────────────────────────────────────────────────────────────────
-- 5. The member gate's allowlist
-- ─────────────────────────────────────────────────────────────────────────

insert into private.access_allowlist (kind, name, reason) values
  ('table_nonmember', 'stubby_profiles', 'guest and Stubby account: own taste profile'),
  ('table_nonmember', 'stubby_feedback', 'guest and Stubby account: own feedback');

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Cleanup: guests inactive for 30 days (a setting)
-- ─────────────────────────────────────────────────────────────────────────

create function private.purge_inactive_guests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer := coalesce((select s.value from private.stubby_settings s where s.key = 'guest_retention_days'), 30);
  v_n integer;
begin
  delete from auth.users u
  where u.is_anonymous
    and greatest(
          u.created_at,
          coalesce(u.last_sign_in_at, u.created_at),
          coalesce(u.updated_at, u.created_at),
          coalesce((select max(a.asked_at) from public.stubby_asks a where a.user_id = u.id), u.created_at),
          coalesce((select sp.updated_at from public.stubby_profiles sp where sp.user_id = u.id), u.created_at),
          coalesce((select max(f.created_at) from public.stubby_feedback f where f.user_id = u.id), u.created_at)
        ) < now() - make_interval(days => v_days);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function private.purge_inactive_guests() from public, anon, authenticated;

select cron.schedule('purge-inactive-guests', '20 4 * * *', 'select private.purge_inactive_guests();');

-- ─────────────────────────────────────────────────────────────────────────
-- 7. The edge function's startup check
-- ─────────────────────────────────────────────────────────────────────────

-- True only when everything guests rely on is in place: the RPC gate is switched on, the member
-- gate (restrictive policies, my_access) and this migration are applied. stubby-scout refuses every
-- guest ask while this is false or missing, so turning on anonymous sign-ins too early opens nothing
-- in Stubby. The server role only.
create function public.stubby_guest_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from pg_roles r, unnest(r.rolconfig) c where r.rolname = 'authenticator' and c = 'pgrst.db_pre_request=private.request_gate')
     and to_regprocedure('public.my_access()') is not null
     and to_regprocedure('public.claim_stubby_turn(uuid, boolean, text, integer, integer, integer, integer, integer)') is not null
     and to_regclass('public.stubby_profiles') is not null
     and exists (select 1 from pg_policies p where p.schemaname = 'storage' and p.tablename = 'objects' and p.policyname = 'members only')
$$;

revoke all on function public.stubby_guest_ready() from public, anon, authenticated;
grant execute on function public.stubby_guest_ready() to service_role;
