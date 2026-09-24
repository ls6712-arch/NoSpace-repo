-- Rollback for 20260921160000_widen_post_type_enum.sql.
--
-- Draft only — staged for review, not run.
--
-- If posts.type turns out to be plain text (the likely case — see that
-- migration's own comment for why), this is a genuine no-op: nothing was
-- structurally changed to undo. No CHECK constraint enforcing a fixed set
-- of values was found anywhere in sql/ or supabase/migrations/ either, so
-- there's nothing there to restore.
--
-- If it turns out to be a native enum, this can only detect that and stop:
-- Postgres has no ALTER TYPE ... DROP VALUE. Removing an enum value once
-- added requires recreating the type from scratch (create a new enum
-- without 'written', alter the column to it with a USING clause, drop the
-- old type, rename the new one into its place) — and that's only safe to
-- attempt after 20260921170000_backfill_written_post_type.sql's own
-- rollback has already run and no row references 'written' anymore.
-- Automating that chain here would mean either silently reordering someone
-- else's rollback for them or risking a failed ALTER COLUMN ... USING
-- against rows the DO block below never checked — both worse than
-- stopping and asking. This raises an exception instead of guessing.
--
-- ── DOWN ────────────────────────────────────────────────────────────────
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
    raise exception
      'posts.type is enum %.% — Postgres has no ALTER TYPE ... DROP VALUE. '
      'Run rollback_20260921170000_backfill_written_post_type.sql first '
      '(so no row still references ''written''), then recreate the enum '
      'without ''written'' by hand: see this file''s own comment for the steps.',
      enum_type_schema, enum_type_name;
  else
    raise notice 'posts.type is not a native enum — nothing to roll back';
  end if;
end
$$;
