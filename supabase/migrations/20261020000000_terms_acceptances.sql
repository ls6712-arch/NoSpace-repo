-- A1 (round 4, reworked in rounds 5 and 6): when someone accepted which version
-- of the Terms and Privacy Policy, kept in its own table so it is not part of the
-- profile row that other people can read.
--
-- * One row per person per version (primary key user_id, terms_version): accepting
--   the same version again changes nothing, and a new version means a new row, so
--   the prompt can show again.
-- * accepted_at is the database's own now(). The client never sends a time.
-- * Readable only by the person it belongs to. Nobody on the client side can
--   insert, update or delete: the only write path is public.accept_terms(text),
--   a security definer function that takes the version as its only argument.
-- * The version is a date ("2026-10-08", the day that version took effect). The
--   client sends TERMS_VERSION from src/app/config.ts; the database refuses
--   anything that isn't a real date, or one more than a day in the future.
-- * Nothing backfills any row: every existing account has none until it accepts.
--
-- The code that calls the function and reads the table treats "not found" as
-- "nothing to do", so this migration can run before or after that code ships.
-- NOT YET RUN on the live project: goes live when this PR is merged.
create table if not exists public.terms_acceptances (
  user_id uuid not null references auth.users (id) on delete cascade,
  terms_version text not null check (terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  accepted_at timestamptz not null default now(),
  primary key (user_id, terms_version)
);

alter table public.terms_acceptances enable row level security;

drop policy if exists "you see only your own terms acceptances" on public.terms_acceptances;
create policy "you see only your own terms acceptances"
  on public.terms_acceptances for select to authenticated
  using ((select auth.uid()) = user_id);

-- Supabase grants new tables to anon and authenticated by default. Take it all
-- back, then give logged-in people read access to their own rows (the policy
-- above decides which). No insert, update or delete policy exists either.
revoke all on public.terms_acceptances from public;
revoke all on public.terms_acceptances from anon;
revoke all on public.terms_acceptances from authenticated;
grant select on public.terms_acceptances to authenticated;

create or replace function public.accept_terms(p_version text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_date date;
  v_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Log in first.' using errcode = '28000';
  end if;

  -- The version must be a real date that has started: not text, not the future.
  if p_version is null or p_version !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Unknown Terms version.' using errcode = '22023';
  end if;
  begin
    v_date := p_version::date;
  exception when others then
    raise exception 'Unknown Terms version.' using errcode = '22023';
  end;
  if v_date > (now() at time zone 'utc')::date + 1 then
    raise exception 'Unknown Terms version.' using errcode = '22023';
  end if;

  insert into public.terms_acceptances (user_id, terms_version)
  values (auth.uid(), p_version)
  on conflict (user_id, terms_version) do nothing;

  v_at := (select t.accepted_at from public.terms_acceptances t
            where t.user_id = auth.uid() and t.terms_version = p_version);
  return v_at;
end;
$$;

-- Supabase grants execute on new functions to anon and authenticated by
-- default; only a logged-in person should be able to call this one.
revoke all on function public.accept_terms(text) from public;
revoke all on function public.accept_terms(text) from anon;
grant execute on function public.accept_terms(text) to authenticated;
