-- Makes sure 'written' is a legal value of posts.type before anything ever
-- tries to write it.
--
-- Whether type is a native Postgres enum or a plain text column couldn't be
-- confirmed from this session — the sandbox's egress proxy hard-blocks this
-- project's Supabase host outright (a CONNECT to it returns 403 from the
-- proxy itself, confirmed by curl, not inferred), so no SQL, REST, or
-- schema-introspection call could reach the database at all. Run this
-- yourself to get a real answer before approving anything here:
--
--   select c.column_name, c.data_type, c.udt_name, t.typtype
--   from information_schema.columns c
--   left join pg_type t on t.typname = c.udt_name
--   where c.table_schema = 'public' and c.table_name = 'posts' and c.column_name = 'type';
--
-- t.typtype = 'e' means it's a native enum; data_type = 'text' (or similar,
-- with typtype null/not 'e') means it's plain. Also worth confirming
-- directly: `select version();` — everything below assumes Postgres 12+
-- (true for every Supabase Postgres version ever offered; 12 is what made
-- ALTER TYPE ... ADD VALUE work inside a transaction block at all, so long
-- as the new value isn't *used* in that same transaction).
--
-- This migration doesn't need that answer ahead of time: it looks up
-- whether posts.type is backed by a native enum at run time and only then
-- runs ALTER TYPE ... ADD VALUE against whatever that enum is actually
-- called — never a guessed type name. If it turns out to be plain text
-- (the more likely case: grepping every sql/ and supabase/migrations/ file
-- that touches posts turned up no CREATE TYPE / enum for it anywhere, and
-- ContentContext.tsx's insert has never needed a cast), this is a no-op.
--
-- Kept in its own migration/transaction, doing nothing else: 'written'
-- must be committed as a legal enum value (if type turns out to be an
-- enum at all) before anything is allowed to write a row using it — see
-- 20260921170000_backfill_written_post_type.sql, which runs after this
-- one and is the first thing that actually uses 'written'.
--
-- Draft only — staged for review. Do not run this against Supabase until
-- it's been approved, and confirm the two queries above first.
--
-- ── UP ──────────────────────────────────────────────────────────────────
do $$
declare
  enum_type_schema text;
  enum_type_name text;
begin
  select n.nspname, t.typname
  into enum_type_schema, enum_type_name
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace cn on cn.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  join pg_namespace n on n.oid = t.typnamespace
  where cn.nspname = 'public'
    and c.relname = 'posts'
    and a.attname = 'type'
    and not a.attisdropped
    and t.typtype = 'e';

  if enum_type_name is not null then
    raise notice 'posts.type is enum %.%; adding ''written'' as a value', enum_type_schema, enum_type_name;
    execute format('alter type %I.%I add value if not exists %L', enum_type_schema, enum_type_name, 'written');
  else
    raise notice 'posts.type is not a native enum (plain text/varchar) — nothing to widen';
  end if;
end
$$;
