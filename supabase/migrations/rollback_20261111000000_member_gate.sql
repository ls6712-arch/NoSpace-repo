-- Rollback for 20261111000000_member_gate.sql. Run 20261111000100's rollback first.
-- Restores the access rules as they were on Nov 2, 2026. Profiles made for guests who signed up
-- stay (they are real accounts now); only the signed_up_from marker goes.

alter role authenticator reset pgrst.db_pre_request;
notify pgrst, 'reload config';

do $$
declare
  t record;
begin
  for t in
    select p.schemaname, p.tablename, p.policyname
    from pg_policies p
    where (p.schemaname = 'public' and p.policyname in (
             'members only', 'members only: insert', 'members only: update', 'members only: delete',
             'members, or your own row', 'members, or your own plans',
             'stubby accounts add sessions to their own plans'))
       or (p.schemaname in ('storage', 'realtime') and p.policyname = 'members only')
  loop
    execute format('drop policy %I on %I.%I', t.policyname, t.schemaname, t.tablename);
  end loop;
end
$$;

create policy "active accounts only" on public.pursuits as restrictive for insert to authenticated
  with check (private.is_active((select auth.uid())));
create policy "active accounts only" on public.pursuit_members as restrictive for insert to authenticated
  with check (private.is_active((select auth.uid())));

drop trigger if exists on_auth_guest_signed_up on auth.users;
drop function if exists private.handle_guest_signed_up();

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

drop function if exists private.make_profile(uuid, text, text);
alter table public.profiles drop column if exists signed_up_from;

drop function if exists public.finish_onboarding();
grant update (onboarding_completed, onboarding_completed_at) on public.profiles to authenticated;

drop function if exists private.request_gate();
drop function if exists public.my_access();
drop table if exists private.access_allowlist;
drop function if exists private.is_stubby_account();
drop function if exists private.is_member();
drop function if exists private.is_anonymous();

-- Trigger functions keep EXECUTE revoked: they never needed it.
