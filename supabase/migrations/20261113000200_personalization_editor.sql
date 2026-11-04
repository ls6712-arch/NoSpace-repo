-- Additive editor metadata and atomic extension saves. Existing V1 clients remain readable.
create or replace function private.valid_personalization(p jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare i jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' or p->'version' <> '1'::jsonb or octet_length(p::text) > 20000
    or not (p ?& array['version','motivations','interests','rhythm','durationMax','confirmedAt'])
    or exists(select 1 from jsonb_object_keys(p) as k(name) where k.name not in ('version','motivations','interests','rhythm','durationMax','confirmedAt','answerStates','resourceMode'))
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
  if p ? 'resourceMode' and coalesce(p->>'resourceMode','') not in ('legacy','explicit') then return false; end if;
  if p ? 'answerStates' and (jsonb_typeof(p->'answerStates') <> 'object' or exists(select 1 from jsonb_each_text(p->'answerStates') as a(key,value) where a.key not in ('motivations','interests','rhythm','durationMax','equipment') or a.value not in ('answered','removed'))) then return false; end if;
  return true;
exception when others then return false;
end $$;
revoke all on function private.valid_personalization(jsonb) from public, anon;
grant execute on function private.valid_personalization(jsonb) to authenticated;
-- Validate the atomic capability editor while retaining the existing V1 contract.
create or replace function private.valid_capability_extension(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare field text; v jsonb;
begin
 if p is null or p->'version'<>'1'::jsonb or not(p ?& array['version','consent','timeZone','perActivityBudget','equipment','goals','preferences','memberships'])
 or exists(select 1 from jsonb_object_keys(p) as k(name) where k.name not in ('version','consent','timeZone','perActivityBudget','equipment','goals','preferences','memberships'))
 or not(p->'consent' ?& array['memory','onboarding','feedback']) or exists(select 1 from jsonb_object_keys(p->'consent') as k(name) where k.name not in ('memory','onboarding','feedback')) or jsonb_typeof(p->'consent')<>'object' or coalesce(jsonb_typeof(p->'consent'->'memory'),'')<>'boolean' or coalesce(jsonb_typeof(p->'consent'->'onboarding'),'')<>'boolean' or coalesce(jsonb_typeof(p->'consent'->'feedback'),'')<>'boolean'
 or not exists(select 1 from pg_timezone_names as z where z.name=p->>'timeZone') then return false; end if;
 if p->'perActivityBudget'<>'null'::jsonb and (jsonb_typeof(p->'perActivityBudget')<>'number' or (p->>'perActivityBudget')::numeric<0 or (p->>'perActivityBudget')::numeric>10000) then return false; end if;
 foreach field in array array['equipment','goals','preferences'] loop
  if jsonb_typeof(p->field)<>'array' or jsonb_array_length(p->field)>20 or exists(select 1 from jsonb_array_elements(p->field) as a(value) where jsonb_typeof(a.value)<>'string' or length(a.value #>> '{}')>120 or (a.value #>> '{}') ~ '[[:cntrl:]<>]') then return false; end if;
 end loop;
 if jsonb_typeof(p->'memberships')<>'array' or jsonb_array_length(p->'memberships')>20 then return false; end if;
 for v in select a.value from jsonb_array_elements(p->'memberships') as a(value) loop
  if jsonb_typeof(v)<>'object' or not(v ?& array['name','expiresOn','status']) or exists(select 1 from jsonb_object_keys(v) as k(name) where k.name not in ('name','expiresOn','status')) or jsonb_typeof(v->'name')<>'string' or length(v->>'name')>120 or v->>'status'<>'self_reported' or (v->'expiresOn'<>'null'::jsonb and coalesce(v->>'expiresOn','')!~ '^\d{4}-\d{2}-\d{2}$') then return false; end if;
 end loop;
 return octet_length(p::text)<=20000;
exception when others then return false;
end $$;
revoke all on function private.valid_capability_extension(jsonb) from public,anon;
grant execute on function private.valid_capability_extension(jsonb) to authenticated;
create or replace function public.save_personalization(expected_user uuid, expected_revision bigint, changes jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_row public.stubby_capabilities; merged jsonb; keys text[]; states jsonb; field text; result_revision bigint;
begin
  if auth.uid() is null or expected_user is distinct from auth.uid() or coalesce(auth.jwt()->>'is_anonymous','true') <> 'false' then raise exception 'Account changed' using errcode='42501'; end if;
  if changes is null or jsonb_typeof(changes) <> 'object' or octet_length(changes::text) > 20000
    or exists(select 1 from jsonb_object_keys(changes) as k(name) where k.name not in ('version','motivations','interests','rhythm','durationMax','capability','resourceMode','windows')) then raise exception 'Invalid preferences' using errcode='22023'; end if;
  insert into public.stubby_capabilities(user_id, profile) values(expected_user,
    '{"version":1,"consent":{"memory":false,"onboarding":false,"feedback":false},"timeZone":"America/New_York","perActivityBudget":null,"equipment":[],"goals":[],"preferences":[],"memberships":[]}'::jsonb)
    on conflict(user_id) do nothing;
  current_row := (select c from public.stubby_capabilities as c where c.user_id=expected_user for update);
  if current_row.revision is distinct from expected_revision then raise exception 'Preferences changed. Reload before saving.' using errcode='40001'; end if;
  states:=coalesce(current_row.personalization->'answerStates','{}');
  for field in select k.name from jsonb_object_keys(changes) as k(name) where k.name in ('motivations','interests','rhythm','durationMax') loop
    states:=states || jsonb_build_object(field,case when changes->field in ('[]'::jsonb,'null'::jsonb) then 'removed' else 'answered' end);
  end loop;
  if changes ? 'capability' then
    if not private.valid_capability_extension(changes->'capability') then raise exception 'Invalid saved information' using errcode='22023'; end if;
    if changes->'capability'->'equipment' is distinct from current_row.profile->'equipment' then
      states:=states || jsonb_build_object('equipment',case when changes->'capability'->'equipment'='[]'::jsonb then 'removed' else 'answered' end);
    end if;
  end if;
  merged := current_row.personalization || (changes-array['capability','windows']) || jsonb_build_object('answerStates',states,'confirmedAt',now());
  if not private.valid_personalization(merged) then raise exception 'Invalid preferences' using errcode='22023'; end if;
  update public.stubby_capabilities as c set personalization=merged, profile=case when changes ? 'capability' then changes->'capability' else current_row.profile end where c.user_id=expected_user;
  if changes ? 'windows' then
    if jsonb_typeof(changes->'windows')<>'array' or jsonb_array_length(changes->'windows')>14 or exists(select 1 from jsonb_array_elements_text(changes->'windows') as w(value) where w.value !~ '^(mon|tue|wed|thu|fri|sat|sun)-(day|eve)$') then raise exception 'Invalid usual windows' using errcode='22023'; end if;
    insert into public.profile_private(user_id,free_windows) values(expected_user,array(select a.value from jsonb_array_elements_text(changes->'windows') as a(value))) on conflict(user_id) do update set free_windows=excluded.free_windows,updated_at=now();
  end if;
  if changes ? 'interests' then
    keys := array(select a.value->>'key' from jsonb_array_elements(merged->'interests') as a(value));
    insert into public.profile_private(user_id,picks) values(expected_user,keys)
      on conflict(user_id) do update set picks=excluded.picks, updated_at=now();
  end if;
  result_revision:=(select c.revision from public.stubby_capabilities as c where c.user_id=expected_user);
  return jsonb_build_object('value',merged,'revision',result_revision);
end $$;
revoke all on function public.save_personalization(uuid,bigint,jsonb) from public, anon;
grant execute on function public.save_personalization(uuid,bigint,jsonb) to authenticated;
insert into private.access_allowlist(kind,name,reason) values('rpc_account','save_personalization','Caller-scoped revision-checked private preferences and atomic interest mirror') on conflict(kind,name) do update set reason=excluded.reason;

-- Writes from older onboarding clients invalidate open editors and synchronize only interests.
create or replace function private.sync_legacy_personalization() returns trigger
language plpgsql security invoker set search_path='' as $$
declare p jsonb; interests jsonb; new_keys text[];
begin
 p:=(select c.personalization from public.stubby_capabilities as c where c.user_id=new.user_id);
 new_keys:=array(select private.personalization_interest_key(k.value) from unnest(coalesce(new.picks,'{}'::text[])) with ordinality as k(value,n) group by private.personalization_interest_key(k.value) order by min(k.n));
 if p is null or array(select a.value->>'key' from jsonb_array_elements(p->'interests') as a(value)) is not distinct from new_keys then return new; end if;
 interests:=coalesce((select jsonb_agg(coalesce((select i.value from jsonb_array_elements(p->'interests') as i(value) where private.personalization_interest_key(i.value->>'key')=k.value limit 1) || jsonb_build_object('key',k.value),jsonb_build_object('key',k.value,'relationship','unspecified','experience','unspecified')) order by k.n) from unnest(new_keys) with ordinality as k(value,n)),'[]');
 update public.stubby_capabilities as c set personalization=jsonb_set(c.personalization,'{interests}',interests) where c.user_id=new.user_id;
 return new;
end $$;
revoke all on function private.sync_legacy_personalization() from public,anon,authenticated;
create trigger sync_legacy_personalization after update of picks on public.profile_private for each row execute function private.sync_legacy_personalization();

-- One statement snapshot for editable forms, including the old answers and resources.
create or replace function public.read_personalization(expected_user uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or expected_user is distinct from auth.uid() or coalesce(auth.jwt()->>'is_anonymous','true')<>'false' then raise exception 'Account changed' using errcode='42501'; end if;
 return (select jsonb_build_object(
  'value',coalesce(c.personalization,'{"version":1,"motivations":[],"interests":[],"rhythm":[],"durationMax":null,"confirmedAt":null}'::jsonb),
  'revision',coalesce(c.revision,0),
  'capability',coalesce(c.profile,'{"version":1,"consent":{"memory":false,"onboarding":false,"feedback":false},"timeZone":"America/New_York","perActivityBudget":null,"equipment":[],"goals":[],"preferences":[],"memberships":[]}'::jsonb),
  'taste',jsonb_build_object('picks',coalesce(pp.picks,'{}'::text[]),'windows',coalesce(pp.free_windows,'{}'::text[]),'budget',pp.monthly_budget,'legacyMotivations',coalesce((select t.interests from public.stubby_profiles as t where t.user_id=expected_user),'{}'::text[])),
  'passes',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'label',p.label,'place',coalesce(p.place,''))) from public.user_passes as p where p.user_id=expected_user),'[]'::jsonb)
 ) from (select expected_user as id) as owner
 left join public.stubby_capabilities as c on c.user_id=owner.id
 left join public.profile_private as pp on pp.user_id=owner.id);
end $$;
revoke all on function public.read_personalization(uuid) from public,anon;
grant execute on function public.read_personalization(uuid) to authenticated;
insert into private.access_allowlist(kind,name,reason) values('rpc_account','read_personalization','Owner-only atomic editor snapshot of private preferences and legacy answers') on conflict(kind,name) do update set reason=excluded.reason;

create or replace function private.invalidate_personalization_editor() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 update public.stubby_capabilities as c set updated_at=now() where c.user_id=case when tg_op='DELETE' then old.user_id else new.user_id end;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
revoke all on function private.invalidate_personalization_editor() from public,anon,authenticated;
create trigger invalidate_personalization_resources after insert or update or delete on public.user_passes for each row execute function private.invalidate_personalization_editor();
create trigger invalidate_personalization_windows after update of free_windows,monthly_budget on public.profile_private for each row execute function private.invalidate_personalization_editor();
