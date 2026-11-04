-- Roll back UI writers first. Keep the compatible validator so saved metadata is retained.
drop trigger if exists sync_legacy_personalization on public.profile_private;
drop function if exists private.sync_legacy_personalization();
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

drop function if exists private.valid_capability_extension(jsonb);
