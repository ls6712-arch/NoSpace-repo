// Supabase Edge Function: Stubby's scout.
//
//   POST /functions/v1/stubby-scout
//     { "mode": "member", "focus": "pottery this weekend" }  a signed-in member asks (3 a day)
//     { "focus": "run clubs" }                               an admin, from City picks
//     header x-scout-sweep: <token>                          the morning cron job
//
// Deploy WITHOUT gateway JWT verification, because the cron job has no user. The function
// checks every caller itself (handler.ts): the sweep token against Vault, a member or admin
// by their session (auth.getUser), admin by profiles.is_admin.
//   supabase functions deploy stubby-scout --no-verify-jwt
// Secrets: ANTHROPIC_API_KEY, STUBBY_SCOUT_ENABLED=true; optional limits in README.md.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. The service role is
// used only after the caller is checked, and only for the scout's own tables.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { CITY, handleScout, readSettings } from "./handler.ts";
import { pickKey } from "./picks.ts";
import { runSearch } from "./search.ts";

const env = (k: string) => Deno.env.get(k);
const DEFAULT_MODEL = "claude-haiku-5-5";
const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve((req) => {
  const settings = readSettings(env);
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");

  return handleScout(req, {
    settings,
    now: () => Date.now(),
    auth: {
      async sweepTokenOk(token) {
        const { data, error } = await db.rpc("scout_sweep_token_ok", { p_token: token });
        return !error && data === true;
      },
      async caller() {
        if (!jwt) return null;
        const { data, error } = await db.auth.getUser(jwt);
        if (error || !data?.user) return null;
        const { data: p } = await db.from("profiles").select("is_admin").eq("id", data.user.id).maybeSingle();
        return { id: data.user.id, isAdmin: !!(p as { is_admin?: boolean } | null)?.is_admin };
      },
    },
    db: {
      async runsSince(ms, filter = {}) {
        let q = db.from("scout_runs").select("id", { count: "exact", head: true }).gte("started_at", new Date(ms).toISOString());
        if (filter.kind) q = q.eq("kind", filter.kind);
        if (filter.userId) q = q.eq("started_by", filter.userId);
        const { count, error } = await q;
        if (error) throw error;
        return count ?? 0;
      },
      async startRun(r) {
        const { data, error } = await db
          .from("scout_runs")
          .insert({ city: CITY, kind: r.kind, focus: r.focus, started_by: r.startedBy, watch_id: r.watchId })
          .select("id")
          .single();
        if (error) throw error;
        return (data as { id: number }).id;
      },
      async finishRun(id, r) {
        await db.from("scout_runs").update({ finished_at: new Date().toISOString(), ...r }).eq("id", id);
      },
      async nextWatch() {
        const cutoff = new Date(Date.now() - 20 * 3_600_000).toISOString();
        const { data, error } = await db
          .from("scout_watches")
          .select("id, query")
          .eq("city", CITY)
          .eq("active", true)
          .or(`last_run_at.is.null,last_run_at.lt.${cutoff}`)
          .order("last_run_at", { ascending: true, nullsFirst: true })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return (data as { id: number; query: string } | null) ?? null;
      },
      async markWatch(id) {
        await db.from("scout_watches").update({ last_run_at: new Date().toISOString() }).eq("id", id);
      },
      async corners() {
        const { data, error } = await db.from("corners").select("id, name").eq("hidden", false).order("name").limit(1000);
        if (error) throw error;
        return (data ?? []) as { id: number; name: string }[];
      },
      async existingKeys(fromMs, toMs) {
        const { data, error } = await db
          .from("city_picks")
          .select("title, starts_at")
          .eq("city", CITY)
          .gte("starts_at", new Date(fromMs).toISOString())
          .lt("starts_at", new Date(toMs).toISOString())
          .limit(2000);
        if (error) throw error;
        return new Set(((data ?? []) as { title: string; starts_at: string }[]).map((r) => pickKey(r.title, Date.parse(r.starts_at))));
      },
      async insertPick(row) {
        const { error } = await db.from("city_picks").insert(row);
        if (!error) return true;
        if (error.code === "23505") return false;
        throw error;
      },
    },
    search: (focus, cornerNames, maxSearches) =>
      runSearch({
        apiKey: env("ANTHROPIC_API_KEY")!,
        model: env("STUBBY_SCOUT_MODEL") || DEFAULT_MODEL,
        maxSearches,
        focus,
        cornerNames,
        now: Date.now(),
      }),
  });
});
