-- Soosh: the Founding Stub (brief: claude-code-brief-corners-rows-imports.md, section 3.4).
--
-- Run AFTER 20261118000000_post_city_key.sql (it reads the private city key made there).
-- Rollback: rollback_20261118000100_founding_stub.sql.
-- Verification: supabase/verification/founding_stub_check.sql.
--
-- A fifth kind of Stub: 'founding'. The author of the first public Moment in a Corner, in a
-- city, earns one, with the Corner on it. It is built behind a flag and OFF:
--   app_config key founding_stub_enabled (jsonb true / false), seeded false.
-- With the flag off the trigger does nothing, so merging this changes no behaviour.
--
-- "In a city" means the Moment's private city key (post_private.city_key, 20261118000000): set only
-- for a Moment whose audience is Everyone and whose city the person didn't remove, from the city the
-- Moment shows or else the author's profile city. A Moment with no key earns nothing.
-- The key is never shown. The Stub keeps it only to stay unique (stubs.city_key, not in any reader).
-- stubs.city is what a Shelf may display, and it is the city that Moment showed: null when the
-- Moment showed none, so a Founding Stub never reveals a city the Moment didn't.
--
-- Once only, however often a Moment is deleted and posted again:
--   * the unique index below allows one founding Stub per Corner and city key, ever;
--   * the Stub is NOT tied to its Moment (post_id stays null), because stubs.post_id cascades
--     on delete and the Stub would vanish with the Moment, letting the next post earn again.
--
-- Not added here: showing a founding Stub on a Shelf (the Stub card design is separate work).
-- get_profile_stubs and stub_shown are untouched; no founding row exists while the flag is off.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).

-- 1. The flag.
insert into public.app_config (key, value)
values ('founding_stub_enabled', 'false'::jsonb)
on conflict (key) do nothing;

-- 2. Stubs: the kind and its city.
alter table public.stubs
  add column city text check (city is null or char_length(city) between 1 and 80),
  add column city_key text check (city_key is null or char_length(city_key) between 1 and 80);

alter table public.stubs drop constraint stubs_kind_check;
alter table public.stubs drop constraint stubs_kind_fields;
alter table public.stubs
  add constraint stubs_kind_check check (kind in ('event', 'finish', 'drop', 'regular', 'founding')),
  add constraint stubs_kind_fields check (
    (kind = 'event' and event_id is not null and space_id is not null)
    or (kind = 'finish' and event_id is null and pursuit_id is not null and drop_id is null)
    or (kind = 'drop' and event_id is null and pursuit_id is not null and drop_id is not null and edition is not null)
    or (kind = 'regular' and event_id is null and corner_key is not null and period is not null)
    or (kind = 'founding' and event_id is null and pursuit_id is null and corner_key is not null and city_key is not null)
  );

-- One per Corner and city key, ever.
create unique index stubs_founding_key
  on public.stubs (corner_key, city_key)
  where kind = 'founding';

-- 3. Issuing.
create function private.award_founding_stub()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_on boolean;
  v_key text;
  v_city text;
begin
  v_on := coalesce((select (ac.value #>> '{}') = 'true' from public.app_config ac where ac.key = 'founding_stub_enabled'), false);
  if not v_on then
    return new;
  end if;
  if new.audience is distinct from 'everyone' then
    return new;
  end if;
  v_city := (select pp.city_key from public.post_private pp where pp.post_id = new.id);
  v_key := private.corner_key_of(new.hobby_slug, coalesce(nullif(new.corner, ''), nullif(new.sub_hobby, '')));
  if v_city is null or v_key is null then
    return new;
  end if;
  if coalesce((select p.is_test from public.profiles p where p.id = new.user_id), false) then
    return new;
  end if;
  -- Only the first: no earlier public Moment in this Corner and city, by anyone.
  if exists (
    select 1 from public.posts po
      join public.post_private pp2 on pp2.post_id = po.id
     where po.id < new.id
       and po.audience = 'everyone'
       and pp2.city_key = v_city
       and private.corner_key_of(po.hobby_slug, coalesce(nullif(po.corner, ''), nullif(po.sub_hobby, ''))) = v_key
  ) then
    return new;
  end if;
  -- city (shown) is the city this Moment showed, if any; city_key (never shown) keeps it unique.
  insert into public.stubs (user_id, kind, corner_key, city, city_key)
  values (new.user_id, 'founding', v_key, nullif(btrim(coalesce(new.city, '')), ''), v_city)
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.award_founding_stub() from public, anon, authenticated;

create trigger posts_zz_award_founding_stub
  after insert on public.posts
  for each row execute function private.award_founding_stub();

create trigger posts_zz_award_founding_stub_on_update
  after update of audience, city, city_hidden, hobby_slug, corner, sub_hobby on public.posts
  for each row
  when (old.audience is distinct from new.audience or old.city is distinct from new.city
        or old.city_hidden is distinct from new.city_hidden
        or old.hobby_slug is distinct from new.hobby_slug or old.corner is distinct from new.corner
        or old.sub_hobby is distinct from new.sub_hobby)
  execute function private.award_founding_stub();
