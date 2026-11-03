-- How each of Stubby's decks was chosen, saved with the ask (stubby-agent G4, Nov 3, 2026).
--
--   stubby_asks.decision_trace   One object: the rules' version, the request contract (what the ask
--                                needed, field by field, where each came from and how hard it binds),
--                                which of the person's own preferences were used (by name only), the
--                                search rounds, and for each pick shown its title (80 characters at
--                                most), kind, source, eligibility, why it was kept and its rank, plus
--                                how many were dropped for each kind of reason. Never the text of the
--                                ask, and never a preference's value. At most 16 KB.
--
-- stubby_asks keeps its rules: a person can read only their own asks, so only their own traces;
-- nobody but the server can write them. No subqueries here (CLAUDE.md's qualification rule holds).
-- Rollback: rollback_20261111000000_stubby_ask_decision_trace.sql.

alter table public.stubby_asks
  add column decision_trace jsonb
    check (decision_trace is null or (jsonb_typeof(decision_trace) = 'object' and octet_length(decision_trace::text) <= 16384));
