/**
 * Rules for supabase/migrations/, checked in CI on every PR (scripts/check-migrations.ts).
 *
 * Every merge to main is a production database deploy (founder, Nov 3, 2026), so the base branch's
 * migrations are what production has recorded. Checked against live on Nov 3, 2026: the two sets
 * of versions were identical. Migration tools track a migration by its version alone, so:
 *
 *   1. No two migrations share a version. The second is treated as already applied and skipped
 *      (this happened to 20261111000000: the member RPC gate never ran).
 *   2. A migration the base branch doesn't have must sort after every migration it does have.
 *      One that sorts earlier is skipped by tools that only apply newer versions, or applied out
 *      of order.
 *   3. Every file is a migration (`<14 digits>_<name>.sql`) or a rollback (`rollback_<14 digits>_<name>.sql`).
 *      A rollback isn't matched to its migration: 12 older ones keep the version their migration
 *      had before it was renumbered, and they are history.
 *
 * Pure: give it file names, get problems back.
 */

const MIGRATION = /^(\d{14})_([a-z0-9_]+)\.sql$/;
const ROLLBACK = /^rollback_(\d{14}_[a-z0-9_]+\.sql)$/;

export interface Migration {
  version: string;
  file: string;
}

/** The migrations among `files` (bare file names), skipping rollbacks and anything else. */
export function migrationsIn(files: readonly string[]): Migration[] {
  const out: Migration[] = [];
  for (const file of files) {
    const m = MIGRATION.exec(file);
    if (m) out.push({ version: m[1], file });
  }
  return out.sort((a, b) => (a.version === b.version ? a.file.localeCompare(b.file) : a.version < b.version ? -1 : 1));
}

/**
 * Problems with the migration folder. `head`: the file names in the PR. `base`: the file names on
 * the branch it merges into (what production has), or null when there is none to compare with.
 */
export function migrationProblems(head: readonly string[], base: readonly string[] | null): string[] {
  const problems: string[] = [];
  const migrations = migrationsIn(head);

  // 3. Only migrations and rollbacks.
  for (const file of head) {
    if (!MIGRATION.test(file) && !ROLLBACK.test(file)) problems.push(`${file}: not a migration (<14 digits>_<name>.sql) or a rollback (rollback_<14 digits>_<name>.sql).`);
  }

  // 1. One migration per version.
  const byVersion = new Map<string, string[]>();
  for (const m of migrations) byVersion.set(m.version, [...(byVersion.get(m.version) ?? []), m.file]);
  for (const [version, files] of byVersion) {
    if (files.length > 1) problems.push(`Version ${version} is used by ${files.length} migrations (${files.join(", ")}). Only the first would run; give the new one a later version.`);
  }

  // 2. New migrations go after everything production has.
  if (base) {
    const before = migrationsIn(base);
    const latest = before.at(-1);
    const old = new Set(before.map((m) => m.file));
    if (latest) {
      for (const m of migrations) {
        if (!old.has(m.file) && m.version <= latest.version) {
          problems.push(`${m.file} is new but sorts at or before ${latest.file}, which production already has. Give it a version after ${latest.version}.`);
        }
      }
    }
  }

  return problems;
}
