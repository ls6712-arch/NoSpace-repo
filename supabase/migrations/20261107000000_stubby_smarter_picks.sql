-- Stubby plan PR 1: smarter picks (docs/briefs/stubby-plan.md §6).
--
-- personal_picks gains what a better ask returns:
--   kind           'event' (a dated thing with its own page) or 'idea' (do-it-yourself, no booking).
--   why            one line for this person, written by the model and checked in code (15 words at most).
--   rank           the order Stubby picked them in, best first, within one ask.
--   ask_id         which ask found it, so one ask's picks show together. No text of the ask is stored.
--   soonest_after  true when nothing fit "tonight" and this is one of the soonest after.
--
-- An idea may link to a Soosh page instead of an outside one: a Corner's start page
-- (/start/:space/:corner) or one of the person's own Pursuits (/pursuit/:id). Events still need
-- an https page. The old url check is replaced (personal_picks_url_check, from 20261101180000).
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Rollback: rollback_20261107000000_stubby_smarter_picks.sql.

alter table public.personal_picks
  add column kind text not null default 'event' check (kind in ('event', 'idea')),
  add column why text check (why is null or char_length(why) between 1 and 160),
  add column rank smallint check (rank is null or rank between 0 and 20),
  add column ask_id bigint references public.stubby_asks (id) on delete set null,
  add column soonest_after boolean not null default false;

alter table public.personal_picks drop constraint personal_picks_url_check;
alter table public.personal_picks add constraint personal_picks_url_check check (
  char_length(url) <= 500
  and (
    url ~* '^https://[^[:space:]]+$'
    or (kind = 'idea' and url ~ '^/(start|pursuit)/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)?$')
  )
);

create index personal_picks_user_ask_idx on public.personal_picks (user_id, ask_id);
