// Disposable real PostgreSQL (WASM) integration. No network or live Supabase access.
// PGLITE_MODULE=/tmp/stubby-sql/node_modules/@electric-sql/pglite/dist/index.js node evals/stubby/sql-check.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
const alice = "00000000-0000-4000-8000-000000000001";
const bob = "00000000-0000-4000-8000-000000000002";
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const checks = [];
const login = async (id, anonymous = false) => {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: id, role: "authenticated", is_anonymous: anonymous })]);
  await db.exec("set role authenticated");
};
try {
  // A minimal Supabase-compatible auth fixture, not a substitute for the full project's gates.
  await db.exec(`
    create schema private; create table private.access_allowlist(kind text, name text, reason text, primary key(kind, name));
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, is_anonymous boolean default false);
    insert into auth.users(id) values ('${alice}'), ('${bob}');
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid(), auth.jwt() to authenticated, anon;
    create table public.stubby_feedback(user_id uuid not null references auth.users(id), title text);
    alter table public.stubby_feedback enable row level security;
    grant select, delete on public.stubby_feedback to authenticated;
    create policy "own feedback" on public.stubby_feedback for all to authenticated using (stubby_feedback.user_id = (select auth.uid()));
    insert into public.stubby_feedback values ('${alice}', 'private-a'), ('${bob}', 'private-b');
  `);
  const migration = read("supabase/migrations/20261112000000_stubby_capabilities.sql");
  await db.exec(migration); await db.exec(migration);
  checks.push("migration applies twice");
  try {
    await db.exec(read("supabase/verification/stubby_capabilities_check.sql"));
    throw new Error("Verification must roll back");
  } catch (e) {
    assert.match(e.message, /RESULTS:/);
    assert.doesNotMatch(e.message, /FAIL|ERROR|BLOCKED/);
    checks.push(e.message);
    await db.exec("rollback");
  }
  await login(alice);
  await assert.rejects(db.query("insert into public.stubby_capabilities(user_id, profile) values ($1, '{}'::jsonb)", [alice]), e => e.code === "23514");
  checks.push("malformed consent rejected by database");
  const profile = { version: 1, consent: { memory: true, onboarding: true, feedback: true } };
  await db.query("insert into public.stubby_capabilities(user_id, profile) values ($1, $2)", [alice, profile]);
  await login(bob);
  const updated = await db.query("update public.stubby_capabilities set profile = $1 where user_id = $2 returning user_id", [profile, alice]);
  assert.equal(updated.rows.length, 0);
  const removed = await db.query("delete from public.stubby_capabilities where user_id = $1 returning user_id", [alice]);
  assert.equal(removed.rows.length, 0);
  checks.push("cross-user update and delete denied");
  await assert.rejects(db.query("select public.forget_stubby_memory($1::uuid)", [alice]), e => e.code === "42501");
  checks.push("stale-account deletion rejected by the database");
  await login(alice);
  await db.query("select public.forget_stubby_memory($1::uuid)", [alice]);
  await db.exec("reset role");
  assert.equal((await db.query("select count(*)::int as n from public.stubby_capabilities where user_id = $1", [alice])).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int as n from public.stubby_feedback where user_id = $1", [alice])).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int as n from public.stubby_feedback where user_id = $1", [bob])).rows[0].n, 1);
  checks.push("forget physically deletes caller memory and feedback while retaining another user's data");
  await db.exec(read("supabase/migrations/rollback_20261112000000_stubby_capabilities.sql"));
  assert.equal((await db.query("select to_regclass('public.stubby_capabilities') as name")).rows[0].name, null);
  checks.push("rollback removes extension");
  const report = { runtime: "PGlite 0.5.15 PostgreSQL WASM", scope: "new migration with synthetic Supabase auth fixture, not full hosted schema", passed: true, checks };
  writeFileSync(fileURLToPath(new URL("./sql-report.json", import.meta.url)), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally { await db.close(); }
