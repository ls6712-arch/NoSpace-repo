// Supabase Edge Function: Stubby's scout.
//
//   POST /functions/v1/stubby-scout   body: { "focus": "pottery, running" }   (focus optional)
//
// Called from the City picks admin page with the admin's own session. Every database call
// runs as that person, so the database's rules decide: only admins can start a run or save a
// pick, and every pick is saved as a draft. Nothing is published here.
//
// Deploy WITH JWT verification (the default):
//   supabase functions deploy stubby-scout
// Secrets (see README.md): ANTHROPIC_API_KEY, STUBBY_SCOUT_ENABLED=true, and optionally
// STUBBY_SCOUT_MODEL, STUBBY_SCOUT_RUNS_PER_DAY, STUBBY_SCOUT_MAX_SEARCHES.
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { CITY, handleScout, readSettings } from "./handler.ts";
import { pickKey } from "./picks.ts";
import { runSearch } from "./search.ts";

const env = (k: string) => Deno.env.get(k);
const DEFAULT_MODEL = "claude-haiku-5-5";

Deno.serve((req) => {
  const db = createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: req.headers.get("authorization") ?? "" } },
  });
  const settings = readSettings(env);

  return handleScout(req, {
    settings,
    now: () => Date.now(),
    db: {
      async runsSince(ms) {
        const { count, error } = await db.from("scout_runs").select("id", { count: "exact", head: true }).gte("started_at", new Date(ms).toISOString());
        if (error) throw error;
        return count ?? 0;
      },
      async startRun(focus) {
        const { data: who } = await db.auth.getUser();
        if (!who?.user) return "forbidden";
        const { data, error } = await db.from("scout_runs").insert({ city: CITY, focus, started_by: who.user.id }).select("id").single();
        if (error) {
          if (error.code === "42501") return "forbidden";
          throw error;
        }
        return (data as { id: number }).id;
      },
      async finishRun(id, r) {
        await db.from("scout_runs").update({ finished_at: new Date().toISOString(), ...r }).eq("id", id);
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
          .limit(1000);
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
    search: (focus, cornerNames) =>
      runSearch({
        apiKey: env("ANTHROPIC_API_KEY")!,
        model: env("STUBBY_SCOUT_MODEL") || DEFAULT_MODEL,
        maxSearches: settings.maxSearches,
        focus,
        cornerNames,
        now: Date.now(),
      }),
  });
});
