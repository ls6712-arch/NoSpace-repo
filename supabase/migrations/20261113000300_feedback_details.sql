-- Optional reasons, deliberately temporary by default. Old insert clients still work.
alter table public.stubby_feedback
 add column if not exists reason text,
 add column if not exists scope text not null default 'request',
 add constraint feedback_reason_valid check(reason is null or reason in ('price','time','distance','activity','today')),
 add constraint feedback_scope_valid check(scope in ('request','usual') and (reason is distinct from 'today' or scope='request') and (reason is null or signal='down'));

-- Preserve existing opted-in positive signals. Old unqualified rejections stay temporary.
update public.stubby_feedback as f set scope='usual'
where f.signal in ('up','save') and exists(
 select 1 from public.stubby_capabilities as c join auth.users as u on u.id=c.user_id
 where c.user_id=f.user_id and c.profile->'consent'->'feedback'='true'::jsonb and coalesce(u.is_anonymous,false)=false
);

-- Existing column grants stay narrow. Only this caller-checked RPC can edit reason/scope.
create or replace function public.record_stubby_feedback(pick bigint, reaction text, reason text default null, scope text default 'request')
returns void language plpgsql security definer set search_path='' as $$
declare person uuid:=auth.uid();
begin
 if person is null or not exists(select 1 from public.personal_picks as p where p.id=pick and p.user_id=person) then raise exception 'Not your pick' using errcode='42501'; end if;
 if reaction not in ('up','down','save') or reaction is null or scope not in ('request','usual') or scope is null
 or (reason is not null and (reason not in ('price','time','distance','activity','today') or reaction<>'down')) or (reason='today' and scope<>'request') then raise exception 'Invalid feedback' using errcode='22023'; end if;
 if scope='usual' and (coalesce(auth.jwt()->>'is_anonymous','true')<>'false' or not coalesce((select (c.profile->'consent'->>'feedback')::boolean from public.stubby_capabilities as c where c.user_id=person),false)) then raise exception 'Learning from feedback is off' using errcode='42501'; end if;
 insert into public.stubby_feedback(user_id,pick_id,signal,reason,scope) values(person,pick,reaction,reason,scope)
 on conflict(user_id,pick_id,signal) where pick_id is not null do update set reason=excluded.reason,scope=excluded.scope,created_at=now();
end $$;
revoke all on function public.record_stubby_feedback(bigint,text,text,text) from public,anon;
grant execute on function public.record_stubby_feedback(bigint,text,text,text) to authenticated;
insert into private.access_allowlist(kind,name,reason) values('rpc_guest','record_stubby_feedback','Caller-owned pick feedback; usual learning requires account opt-in, guests may give temporary feedback') on conflict(kind,name) do update set reason=excluded.reason;

-- Positive Keep/thumb actions can learn only with the existing explicit feedback opt-in.
create or replace function private.scope_positive_feedback() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.signal in ('up','save') then
  new.scope:=case when coalesce(auth.jwt()->>'is_anonymous','true')='false' and coalesce((select (c.profile->'consent'->>'feedback')::boolean from public.stubby_capabilities as c where c.user_id=auth.uid()),false) then 'usual' else 'request' end;
 end if;
 return new;
end $$;
revoke all on function private.scope_positive_feedback() from public,anon,authenticated;
create trigger stubby_feedback_positive before insert on public.stubby_feedback for each row execute function private.scope_positive_feedback();
