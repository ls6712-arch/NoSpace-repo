-- Additive private preferences. Old clients update profile without replacing this independent column.
alter table public.stubby_capabilities
  add column if not exists personalization jsonb not null default '{"version":1,"motivations":[],"interests":[],"rhythm":[],"durationMax":null,"confirmedAt":null}'::jsonb,
  add column if not exists revision bigint not null default 0;

create or replace function private.valid_personalization(p jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare i jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' or p->>'version' <> '1' or octet_length(p::text) > 20000
    or not (p ?& array['version','motivations','interests','rhythm','durationMax','confirmedAt'])
    or exists(select 1 from jsonb_object_keys(p) as k(name) where k.name not in ('version','motivations','interests','rhythm','durationMax','confirmedAt'))
    or jsonb_typeof(p->'motivations') <> 'array' or jsonb_typeof(p->'interests') <> 'array' or jsonb_typeof(p->'rhythm') <> 'array' then return false; end if;
  if jsonb_array_length(p->'motivations') > 6 or jsonb_array_length(p->'interests') > 50 or jsonb_array_length(p->'rhythm') > 5 then return false; end if;
  if exists(select 1 from jsonb_array_elements(p->'motivations') as m(value) where jsonb_typeof(m.value) <> 'string' or m.value #>> '{}' not in ('make','learn','move','company','personal_time','explore'))
    or exists(select 1 from jsonb_array_elements(p->'rhythm') as r(value) where jsonb_typeof(r.value) <> 'string' or r.value #>> '{}' not in ('small','morning','evening','weekend','variable')) then return false; end if;
  if p->'durationMax' <> 'null'::jsonb and (jsonb_typeof(p->'durationMax') <> 'number' or (p->>'durationMax')::numeric < 5 or (p->>'durationMax')::numeric > 480 or (p->>'durationMax')::numeric <> trunc((p->>'durationMax')::numeric)) then return false; end if;
  if jsonb_typeof(p->'confirmedAt') not in ('null','string') then return false; end if;
  for i in select a.value from jsonb_array_elements(p->'interests') as a(value) loop
    if jsonb_typeof(i) <> 'object' or not (i ?& array['key','relationship','experience'])
      or exists(select 1 from jsonb_object_keys(i) as k(name) where k.name not in ('key','relationship','experience'))
      or length(i->>'key') > 120 or coalesce(i->>'key','') !~ '^[a-z0-9-]+/[a-z0-9-]+$'
      or coalesce(i->>'relationship','') not in ('enjoy','try','returning','unspecified')
      or coalesce(i->>'experience','') not in ('beginner','practiced','experienced','unspecified') then return false; end if;
  end loop;
  if (select count(*) from jsonb_array_elements(p->'interests') as a(value)) <> (select count(distinct a.value->>'key') from jsonb_array_elements(p->'interests') as a(value)) then return false; end if;
  return true;
exception when others then return false;
end $$;
revoke all on function private.valid_personalization(jsonb) from public, anon;
grant execute on function private.valid_personalization(jsonb) to authenticated;
alter table public.stubby_capabilities add constraint personalization_shape check (private.valid_personalization(personalization));

create or replace function private.revise_stubby_capability() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.revision := 0;
  else new.revision := old.revision + 1; end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function private.revise_stubby_capability() from public, anon, authenticated;
create trigger revise_stubby_capability before insert or update on public.stubby_capabilities for each row execute function private.revise_stubby_capability();

-- One caller-scoped transaction: merge a validated preference patch and mirror changed interests.
create or replace function public.save_personalization(expected_user uuid, expected_revision bigint, changes jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_row public.stubby_capabilities; merged jsonb; keys text[];
begin
  if auth.uid() is null or expected_user is distinct from auth.uid() or coalesce(auth.jwt()->>'is_anonymous','true') <> 'false' then raise exception 'Account changed' using errcode='42501'; end if;
  if changes is null or jsonb_typeof(changes) <> 'object' or octet_length(changes::text) > 20000
    or exists(select 1 from jsonb_object_keys(changes) as k(name) where k.name not in ('version','motivations','interests','rhythm','durationMax','confirmedAt')) then raise exception 'Invalid preferences' using errcode='22023'; end if;
  insert into public.stubby_capabilities(user_id, profile) values(expected_user,
    '{"version":1,"consent":{"memory":false,"onboarding":false,"feedback":false},"timeZone":"America/New_York","perActivityBudget":null,"equipment":[],"goals":[],"preferences":[],"memberships":[]}'::jsonb)
    on conflict(user_id) do nothing;
  current_row := (select c from public.stubby_capabilities as c where c.user_id=expected_user for update);
  if current_row.revision is distinct from expected_revision then raise exception 'Preferences changed. Reload before saving.' using errcode='40001'; end if;
  merged := current_row.personalization || changes || jsonb_build_object('confirmedAt',now());
  if not private.valid_personalization(merged) then raise exception 'Invalid preferences' using errcode='22023'; end if;
  update public.stubby_capabilities as c set personalization=merged where c.user_id=expected_user;
  if changes ? 'interests' then
    keys := array(select a.value->>'key' from jsonb_array_elements(merged->'interests') as a(value));
    insert into public.profile_private(user_id,picks) values(expected_user,keys)
      on conflict(user_id) do update set picks=excluded.picks, updated_at=now();
  end if;
  return jsonb_build_object('value',merged,'revision',current_row.revision+1);
end $$;
revoke all on function public.save_personalization(uuid,bigint,jsonb) from public, anon;
grant execute on function public.save_personalization(uuid,bigint,jsonb) to authenticated;
insert into private.access_allowlist(kind,name,reason) values('rpc_account','save_personalization','Caller-scoped revision-checked private preferences and atomic interest mirror') on conflict(kind,name) do update set reason=excluded.reason;

alter table public.profile_private drop constraint profile_private_onboarding_step_known;
alter table public.profile_private add constraint profile_private_onboarding_step_known check(onboarding_step is null or onboarding_step in ('welcome','signup','code','name','birthday','where','picks','free','yours','review','card','plan','invite'));
