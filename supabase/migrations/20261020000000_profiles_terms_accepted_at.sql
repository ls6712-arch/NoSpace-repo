-- A1 (round 4, reworked in round 5): when someone accepted the Terms and
-- Privacy Policy, recorded with the database's own clock.
--
-- The client never sends a time. It calls public.accept_terms(), which takes no
-- arguments and stamps now() itself, once: a second call changes nothing, and
-- there is no way to back-date or overwrite it. The column also has no UPDATE
-- grant for authenticated, so a direct update of it from the client is refused.
--
-- Null means no acceptance is recorded: every existing account until it accepts
-- once, and anyone who has not yet been through the sign-up checkbox or the
-- one-time prompt. Nothing here backfills any row.
--
-- The code that calls the function treats "function does not exist" as "nothing
-- to do", so this migration can run before or after that code ships.
-- NOT YET RUN on the live project: goes live when this PR is merged.
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

create or replace function public.accept_terms()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Log in first.' using errcode = '28000';
  end if;

  update public.profiles
     set terms_accepted_at = now()
   where public.profiles.id = auth.uid()
     and public.profiles.terms_accepted_at is null;

  v_at := (select p.terms_accepted_at from public.profiles p where p.id = auth.uid());
  return v_at;
end;
$$;

-- Supabase grants execute on new functions to anon and authenticated by
-- default; only a logged-in person should be able to call this one.
revoke all on function public.accept_terms() from public;
revoke all on function public.accept_terms() from anon;
grant execute on function public.accept_terms() to authenticated;
