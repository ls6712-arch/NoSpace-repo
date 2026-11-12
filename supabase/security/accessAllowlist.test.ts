import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Deny by default, checked on every PR (npm test in CI). A guest, a Stubby account or a signed-out
 * visitor may reach only what is listed in supabase/security/access-allowlist.json. This reads
 * every migration and edge function and fails when something new is reachable without an entry:
 *
 *   - a table made after the member gate without a restrictive "members only" policy, unless listed
 *   - a policy for the anon or public role on a table not listed
 *   - EXECUTE granted to anon on a function not listed
 *   - a view without security_invoker, unless listed
 *   - a Storage bucket not listed
 *   - an edge function not listed, or one that takes a JWT without _shared/access.ts
 *   - the list here and private.access_allowlist (written by migrations) disagreeing
 *
 * The live database is checked the same way by supabase/verification/member_gate_check.sql.
 */
type Kind = "rpc_anon" | "rpc_guest" | "rpc_account" | "table_nonmember" | "table_anon";
interface Allowlist {
  gateMigration: string;
  rpc_anon: string[];
  rpc_guest: string[];
  rpc_account: string[];
  table_nonmember: string[];
  table_anon: string[];
  invoker_exempt_views: string[];
  buckets: string[];
  edgeFunctions: Record<string, { auth: "token" | "caller"; why: string }>;
}

const root = path.resolve(__dirname, "../..");
const list = JSON.parse(fs.readFileSync(path.join(root, "supabase/security/access-allowlist.json"), "utf8")) as Allowlist;
const migDir = path.join(root, "supabase/migrations");
// Applied migrations only, in order. Rollbacks undo; they never add access.
const migrations = fs
  .readdirSync(migDir)
  .filter((f) => /^\d{14}_.+\.sql$/.test(f))
  .sort()
  .map((f) => ({ file: f, sql: stripComments(fs.readFileSync(path.join(migDir, f), "utf8")) }));
const afterGate = migrations.filter((m) => m.file > list.gateMigration);
const fromGate = migrations.filter((m) => m.file >= list.gateMigration);

function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

const KINDS: Kind[] = ["rpc_anon", "rpc_guest", "rpc_account", "table_nonmember", "table_anon"];

/** private.access_allowlist as the migrations leave it. */
function allowlistFromMigrations(): Record<Kind, Set<string>> {
  const out = Object.fromEntries(KINDS.map((k) => [k, new Set<string>()])) as Record<Kind, Set<string>>;
  for (const { sql } of migrations) {
    if (!/insert\s+into\s+private\.access_allowlist/i.test(sql)) continue;
    // Rows are ('kind', 'name', 'reason'); a reason may hold a semicolon, so rows are read directly.
    for (const row of sql.matchAll(/\(\s*'(\w+)'\s*,\s*'(\w+)'\s*,\s*'(?:[^']|'')*'\s*\)/g)) {
      if ((KINDS as string[]).includes(row[1])) out[row[1] as Kind].add(row[2]);
    }
    for (const del of sql.matchAll(/delete\s+from\s+private\.access_allowlist\s+where\s+kind\s*=\s*'(\w+)'\s+and\s+name\s+in\s*\(([^)]*)\)/gi)) {
      for (const n of del[2].matchAll(/'(\w+)'/g)) out[del[1] as Kind]?.delete(n[1]);
    }
  }
  return out;
}

describe("access allowlist: deny by default", () => {
  it("the member gate migration exists", () => {
    expect(migrations.some((m) => m.file === list.gateMigration)).toBe(true);
  });

  it("matches private.access_allowlist as the migrations write it", () => {
    const db = allowlistFromMigrations();
    for (const k of KINDS) expect([...db[k]].sort(), k).toEqual([...list[k]].sort());
  });

  it("every table made after the gate is members only, or listed with its own narrower policy", () => {
    const missing: string[] = [];
    for (const { file, sql } of afterGate) {
      for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)) {
        const t = m[1];
        const membersOnly = new RegExp(`create\\s+policy\\s+"members only"\\s+on\\s+public\\.${t}\\s+as\\s+restrictive`, "i").test(sql);
        const listed = list.table_nonmember.includes(t) && new RegExp(`on\\s+public\\.${t}\\s+as\\s+restrictive`, "i").test(sql);
        const rls = new RegExp(`alter\\s+table\\s+public\\.${t}\\s+enable\\s+row\\s+level\\s+security`, "i").test(sql);
        if (!rls || (!membersOnly && !listed)) missing.push(`${file}: public.${t}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every policy a signed-out visitor could match is on a listed table", () => {
    const unlisted: string[] = [];
    for (const { file, sql } of afterGate) {
      for (const m of sql.matchAll(/create\s+policy\s+"[^"]+"\s+on\s+public\.(\w+)([^;]*);/gi)) {
        const body = m[2];
        const roles = /\bto\s+([\w,\s]+?)(?:\s+using|\s+with\s+check|$)/i.exec(body)?.[1] ?? "public";
        if (/\b(anon|public)\b/i.test(roles) && !list.table_anon.includes(m[1])) unlisted.push(`${file}: public.${m[1]}`);
      }
    }
    expect(unlisted).toEqual([]);
  });

  it("EXECUTE goes to anon only for listed functions", () => {
    const unlisted: string[] = [];
    for (const { file, sql } of fromGate) {
      for (const m of sql.matchAll(/grant\s+execute\s+on\s+function\s+public\.(\w+)[^;]*\bto\s+([^;]+);/gi)) {
        if (/\banon\b/i.test(m[2]) && !list.rpc_anon.includes(m[1])) unlisted.push(`${file}: public.${m[1]}`);
      }
    }
    expect(unlisted).toEqual([]);
  });

  it("every view made after the gate runs as the caller (security_invoker)", () => {
    const definer: string[] = [];
    for (const { file, sql } of afterGate) {
      for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+public\.(\w+)([^;]*?)\bas\b/gi)) {
        if (!/security_invoker\s*=\s*(true|on)/i.test(m[2]) && !list.invoker_exempt_views.includes(m[1])) definer.push(`${file}: public.${m[1]}`);
      }
    }
    expect(definer).toEqual([]);
  });

  it("every Storage bucket is listed", () => {
    const unlisted: string[] = [];
    for (const { file, sql } of migrations) {
      for (const m of sql.matchAll(/insert\s+into\s+storage\.buckets[^;]*?values\s*\(\s*'([\w-]+)'/gi)) {
        if (!list.buckets.includes(m[1])) unlisted.push(`${file}: ${m[1]}`);
      }
    }
    expect(unlisted).toEqual([]);
  });

  it("every edge function is listed, and any that takes a user's token checks it through _shared/access.ts", () => {
    const dir = path.join(root, "supabase/functions");
    const fns = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith("_")).map((d) => d.name);
    expect(fns.sort()).toEqual(Object.keys(list.edgeFunctions).sort());
    for (const fn of fns) {
      const src = fs.readFileSync(path.join(dir, fn, "index.ts"), "utf8");
      const auth = list.edgeFunctions[fn].auth;
      if (auth === "caller") expect(src, fn).toMatch(/from "\.\.\/_shared\/access\.ts"/);
      // A token-only function must never read an Authorization header.
      if (auth === "token") expect(src, fn).not.toMatch(/authorization/i);
    }
  });

  it("guest and account RPCs are read-only or their own (no admin, Space or messaging RPC is listed)", () => {
    const risky = /^(admin_|create_|approve_|ban_|invite_host|send_|join_|request_|accept_host|demote|remove_member|set_space|update_space|rsvp|cancel_|unsend|feature_|confirm_)/;
    expect([...list.rpc_guest, ...list.rpc_account].filter((f) => risky.test(f))).toEqual([]);
  });
});
