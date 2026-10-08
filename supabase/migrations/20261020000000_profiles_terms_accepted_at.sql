-- A1 (round 4): when someone ticked "I'm 16 or older and agree to the Terms
-- and Privacy Policy" at sign-up.
--
-- Null means no acceptance is recorded: every existing account, and anyone who
-- has not yet been through the sign-up checkbox or its one-time onboarding
-- fallback. The client writes this once, never overwrites an earlier time, and
-- treats a missing column as "nothing to do", so this migration can run before
-- or after the code that uses it. It is self-reported by the client, like every
-- other profile field the owner can edit.
--
-- authenticated has column-level UPDATE grants on profiles (the table-level
-- grant is off), so the new column needs its own grant or the write is refused.
-- NOT YET RUN on the live project: goes live when this PR is merged.
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

grant update (terms_accepted_at) on public.profiles to authenticated;
