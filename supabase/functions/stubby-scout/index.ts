// Supabase Edge Function: Stubby's scout.
//
//   POST /functions/v1/stubby-scout
//     { "focus": "pottery" }                 an admin's Find picks (signed in, admins only)
//     { "mode": "ask", "ask": "outdoors..." } a person asks for something different (signed in)
//     { "mode": "restock" }                  the morning schedule (no sign-in; see handler.ts)
//
// Deploy WITHOUT gateway JWT verification, because the morning schedule has no sign-in:
//   supabase functions deploy stubby-scout --no-verify-jwt
// The admin and ask modes check the caller's token themselves (auth.getUser(token)), and the
// restock can only ever search each source once a day.
//
// Secrets (see README.md): ANTHROPIC_API_KEY, STUBBY_SCOUT_ENABLED=true; optional ANTHROPIC_WORKSPACE_ID and limits.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { CITY, handleScout, readSettings } from "./handler.ts";
import { pickKey } from "./picks.ts";
import { runSearch } from "./search.ts";

const env = (k: string) => Deno.env.get(k);
const DEFAULT_MODEL = "claude-haiku-5-5";
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

// The server's own client: used only for the restock and asks, after their checks.
const server = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, opts);

const iso = (ms: number) => new Date(ms).toISOString();

async function existingKeys(client: typeof server, fromMs: number, toMs: number) {
  const { data, error } = await client.from("city_picks").select("title, starts_at").eq("city", CITY).gte("starts_at", iso(fromMs)).lt("starts_at", iso(toMs)).limit(2000);
  if (error) throw error;
  return new Set(((data ?? []) as { title: string; starts_at: string }[]).map((r) => pickKey(r.title, Date.parse(r.starts_at))));
}
async function corners(client: typeof server) {
  const { data, error } = await client.from("corners").select("id, name").eq("hidden", false).order("name").limit(1000);
  if (error) throw error;
  return (data ?? []) as { id: number; name: string }[];
}
async function insertOnce(client: typeof server, table: string, row: Record<string, unknown>) {
  const { error } = await client.from(table).insert(row);
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

Deno.serve((req) => {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  // As the caller: every read and write here goes through the database's own rules.
  const caller = createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, { ...opts, global: { headers: { Authorization: auth } } });
  const settings = readSettings(env);
  let me: string | null | undefined;
  const userId = async () => {
    if (me !== undefined) return me;
    if (!token) return (me = null);
    const { data } = await caller.auth.getUser(token);
    return (me = data?.user?.id ?? null);
  };

  return handleScout(req, {
    settings,
    now: () => Date.now(),
    userId,
    db: {
      async runsSince(ms) {
        const { count, error } = await caller.from("scout_runs").select("id", { count: "exact", head: true }).eq("kind", "admin").gte("started_at", iso(ms));
        if (error) throw error;
        return count ?? 0;
      },
      async startRun(focus) {
        const id = await userId();
        if (!id) return "forbidden";
        const { data, error } = await caller.from("scout_runs").insert({ city: CITY, focus, started_by: id, kind: "admin" }).select("id").single();
        if (error) {
          if (error.code === "42501") return "forbidden";
          throw error;
        }
        return (data as { id: number }).id;
      },
      async finishRun(id, r) {
        await caller.from("scout_runs").update({ finished_at: new Date().toISOString(), ...r }).eq("id", id);
      },
      corners: () => corners(caller as typeof server),
      existingKeys: (a, b) => existingKeys(caller as typeof server, a, b),
      insertPick: (row) => insertOnce(caller as typeof server, "city_picks", row),
    },
    server: {
      async claimSource() {
        const { data, error } = await server.rpc("claim_scout_source");
        if (error) throw error;
        const r = (Array.isArray(data) ? data[0] : data) as Record<string, any> | null;
        if (!r?.run_id) return null;
        return { runId: r.run_id, name: r.name, focus: r.focus, searchDomain: r.search_domain ?? null, trustedHost: r.trusted_host ?? null };
      },
      async claimAsk(user, perPerson, perDay) {
        const { data, error } = await server.rpc("claim_stubby_ask", { p_user: user, p_per_user: perPerson, p_global: perDay });
        if (error) throw error;
        return (data as number | null) ?? null;
      },
      async finishRun(id, r) {
        await server.from("scout_runs").update({ finished_at: new Date().toISOString(), ...r }).eq("id", id);
      },
      async finishAsk(id, r) {
        await server.from("stubby_asks").update(r).eq("id", id);
      },
      async asksSince(user, ms) {
        const { count, error } = await server.from("stubby_asks").select("id", { count: "exact", head: true }).eq("user_id", user).gte("asked_at", iso(ms));
        if (error) throw error;
        return count ?? 0;
      },
      async trustedHosts() {
        const { data, error } = await server.from("scout_sources").select("trusted_host").eq("enabled", true).not("trusted_host", "is", null);
        if (error) throw error;
        return ((data ?? []) as { trusted_host: string }[]).map((r) => r.trusted_host);
      },
      corners: () => corners(server),
      existingKeys: (a, b) => existingKeys(server, a, b),
      insertPick: (row) => insertOnce(server, "city_picks", row),
      insertPersonal: (row) => insertOnce(server, "personal_picks", row),
    },
    search: (r) =>
      runSearch({
        apiKey: env("ANTHROPIC_API_KEY")!,
        model: env("STUBBY_SCOUT_MODEL") || DEFAULT_MODEL,
        maxSearches: r.maxSearches,
        focus: r.focus,
        cornerNames: r.cornerNames,
        allowedDomains: r.allowedDomains,
        days: r.days,
        maxPicks: r.maxPicks,
        ask: r.ask,
        workspaceId: env("ANTHROPIC_WORKSPACE_ID") || null,
        now: Date.now(),
      }),
  });
});
