// Supabase Edge Function: Stubby's scout.
//
//   POST /functions/v1/stubby-scout
//     { "focus": "pottery" }                 an admin's Find picks (signed in, admins only)
//     { "mode": "ask", "ask": "outdoors...",  a person asks (signed in). "answers": {"who": "solo"} is their
//       "answers"?, "questions"? }           answer to Stubby's one question; "questions": true asks to be
//                                            asked that question first, which uses no ask; "stream": true
//                                            answers as server-sent events (see handler.ts);
//                                            "followUp": {"of": askId, "kind": "cheaper", "titles": [...]}
//                                            follows a deck (the first after an ask is free).
//     { "mode": "restock" }                  the morning schedule (no sign-in; see handler.ts)
//
// Deploy WITHOUT gateway JWT verification, because the morning schedule has no sign-in:
//   supabase functions deploy stubby-scout --no-verify-jwt
// The admin and ask modes check the caller's token themselves (auth.getUser(token)), and the
// restock can only ever search each source once a day.
//
// Secrets (see README.md): ANTHROPIC_API_KEY, STUBBY_SCOUT_ENABLED=true, STUBBY_IP_SALT (32+ random
// characters; without it guests are refused); optional ANTHROPIC_WORKSPACE_ID, ALLOWED_ORIGINS and limits
// (GUEST_DAILY_MESSAGE_LIMIT, USER_DAILY_MESSAGE_LIMIT, GUEST_GLOBAL_DAILY_CAP and the rest in readSettings).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { CITY, EMPTY_PROFILE, handleScout, readSettings, type PersonProfile } from "./handler.ts";
import { readSignals, readTaste } from "./taste.ts";
import { accessOf, allowedOrigins, clientIp, corsFor, ipHash, originAllowed, type Access } from "../_shared/access.ts";
import { claimTurn, readAccess } from "./claim.ts";
import { pickKey } from "./picks.ts";
import { emptyPersonalization, parsePersonalization } from "../_shared/personalization.ts";
import { runV3 } from "./v3/orchestrator.ts";
import { createV3Provider } from "./v3/provider.ts";
import { sooshAdapter } from "./v3/soosh.ts";
import { claudeCareModel } from "./v3/careModel.ts";
import { emptyCapability, parseCapability } from "../_shared/capabilityProfile.ts";
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
  const { data, error } = await client.from("corners").select("id, name, space_slug, slug").eq("hidden", false).order("name").limit(1000);
  if (error) throw error;
  return ((data ?? []) as { id: number; name: string; space_slug: string | null; slug: string | null }[]).map((c) => ({
    id: c.id,
    name: c.name,
    spaceSlug: c.space_slug ?? undefined,
    slug: c.slug ?? undefined,
  }));
}

/** The caller's own profile, passes and Pursuits, read as them: the database's rules keep it to their own rows. */
async function profileOf(client: typeof server, userId: string): Promise<PersonProfile> {
  const [priv, passes, pursuits, personalization] = await Promise.all([
    client.from("profile_private").select("picks, free_windows, monthly_budget, city, area").eq("user_id", userId).maybeSingle(),
    client.from("user_passes").select("kind, label, place").eq("user_id", userId).limit(20),
    client
      .from("pursuits")
      .select("id, title, hobby_slug, sub_hobby")
      .eq("user_id", userId)
      .is("finished_at", null)
      .is("paused_at", null)
      .is("let_go_at", null)
      .is("archived_at", null)
      .eq("is_plan", false)
      .limit(10),
    client.from("stubby_capabilities").select("personalization").eq("user_id", userId).maybeSingle(),
  ]);
  const p = (priv.data ?? {}) as Record<string, unknown>;
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    ...EMPTY_PROFILE,
    personalization: (() => { try { return personalization.data ? parsePersonalization(personalization.data.personalization) : emptyPersonalization(); } catch { return emptyPersonalization(); } })(),
    picks: strings(p.picks),
    windows: strings(p.free_windows),
    monthlyBudget: typeof p.monthly_budget === "number" ? p.monthly_budget : null,
    city: typeof p.city === "string" ? p.city : null,
    area: typeof p.area === "string" ? p.area : null,
    passes: ((passes.data ?? []) as { kind: string; label: string; place: string | null }[]).map((r) => ({ kind: r.kind, label: r.label, place: r.place ?? null })),
    pursuits: ((pursuits.data ?? []) as { id: string; title: string; hobby_slug: string | null; sub_hobby: string | null }[]).map((r) => ({ id: r.id, title: r.title, corner: r.hobby_slug && r.sub_hobby ? `${r.hobby_slug}/${r.sub_hobby}` : null })),
  };
}
async function insertOnce(client: typeof server, table: string, row: Record<string, unknown>) {
  const { error } = await client.from(table).insert(row);
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

const ORIGINS = allowedOrigins(env("ALLOWED_ORIGINS"));

// The startup check, cached for 5 minutes per instance: the database is ready for guests and the
// IP salt is set. Until both are true every guest ask is refused.
let ready: { ok: boolean; at: number } | null = null;
async function guestReady(): Promise<boolean> {
  if (ready && Date.now() - ready.at < 5 * 60_000) return ready.ok;
  const salt = env("STUBBY_IP_SALT");
  let ok = !!salt && salt.length >= 16;
  if (ok) {
    const { data, error } = await server.rpc("stubby_guest_ready");
    ok = !error && data === true;
  }
  if (!ok) console.error("stubby-scout: guests not ready (migrations, gate or STUBBY_IP_SALT missing)");
  ready = { ok, at: Date.now() };
  return ok;
}

/** The response with CORS for this origin only (the handler's own "*" is replaced). */
function withCors(res: Response, origin: string | null): Response {
  const headers = new Headers(res.headers);
  headers.delete("access-control-allow-origin");
  for (const [k, v] of Object.entries(corsFor(origin, ORIGINS))) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (!originAllowed(origin, ORIGINS)) return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403, headers: { "content-type": "application/json" } });
  try {
    return withCors(await serve(req), origin);
  } catch (e) {
    // Never a stack, a query or a provider's error body: the name of the error goes to the log, nothing to the client.
    console.error("stubby-scout: unhandled", (e as Error)?.name ?? "unknown");
    return withCors(new Response(JSON.stringify({ error: "Something went wrong. Try again in a bit." }), { status: 500, headers: { "content-type": "application/json" } }), origin);
  }
});

function serve(req: Request): Promise<Response> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  // As the caller: every read and write here goes through the database's own rules.
  const caller = createClient(env("SUPABASE_URL")!, env("SUPABASE_ANON_KEY")!, { ...opts, global: { headers: { Authorization: auth } } });
  const settings = readSettings(env);
  let me: Access | null | undefined;
  const access = async () => {
    if (me !== undefined) return me;
    me = await accessOf(
      token,
      async (t) => {
        const { data } = await caller.auth.getUser(t);
        return data?.user ? { id: data.user.id, is_anonymous: (data.user as { is_anonymous?: boolean }).is_anonymous } : null;
      },
      () => readAccess((fn, args) => caller.rpc(fn, args)),
    );
    return me;
  };
  const userId = async () => (await access())?.id ?? null;

  return handleScout(req, {
    settings,
    now: () => Date.now(),
    userId,
    async whoIs() {
      const a = await access();
      return { guest: a?.guest ?? true, member: a?.member ?? false, adult21: a?.adult21 ?? false };
    },
    ipHash: () => ipHash(clientIp(req.headers), env("STUBBY_IP_SALT")),
    guestReady,
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
      profile: (id) => profileOf(caller as typeof server, id),
      async capability(id) {
        const { data, error } = await caller.from("stubby_capabilities").select("profile").eq("user_id", id).maybeSingle();
        if (error || !data) return emptyCapability();
        try { return parseCapability(data.profile); } catch { return emptyCapability(); }
      },
      async taste(id) {
        const { data } = await caller.from("stubby_profiles").select("city, interests, timing, budget").eq("user_id", id).maybeSingle();
        return readTaste(data);
      },
      async signals(id) {
        const recent=iso(Date.now()-60*86400000);
        let response=await caller.from("stubby_feedback").select("signal, title, kind, reason, scope").eq("user_id",id).gte("created_at",recent).order("created_at",{ascending:false}).limit(20);
        // Compatible reader can be deployed before additive columns exist.
        if(response.error && ["42703","PGRST204"].includes(response.error.code)) response=await caller.from("stubby_feedback").select("signal, title, kind").eq("user_id",id).gte("created_at",recent).order("created_at",{ascending:false}).limit(20) as typeof response;
        return readSignals(response.data);
      },
    },
    server: {
      async claimSource() {
        const { data, error } = await server.rpc("claim_scout_source");
        if (error) throw error;
        const r = (Array.isArray(data) ? data[0] : data) as Record<string, any> | null;
        if (!r?.run_id) return null;
        return { runId: r.run_id, name: r.name, focus: r.focus, searchDomain: r.search_domain ?? null, trustedHost: r.trusted_host ?? null };
      },
      claimAsk: (user, l) => claimTurn((fn, args) => server.rpc(fn, args), user, l),
      async claimFreeFollowUp(user, askId, sinceMs) {
        const { data, error } = await server
          .from("stubby_asks")
          .update({ free_follow_up_used: true })
          .eq("id", askId)
          .eq("user_id", user)
          .eq("free_follow_up_used", false)
          .gte("asked_at", iso(sinceMs))
          .select("id");
        if (error) throw error;
        return Array.isArray(data) && data.length === 1;
      },
      async finishRun(id, r) {
        await server.from("scout_runs").update({ finished_at: new Date().toISOString(), ...r }).eq("id", id);
      },
      async finishAsk(id, { dropped, trace, ...r }) {
        // Why each candidate was dropped and how the deck was chosen (titles, reasons and rules only,
        // never the ask), for debugging. Before migration 20261111000000 there's no decision_trace
        // column: the drop reasons are still saved; before 20261109000000, the counts.
        const reasons = dropped?.map((d) => ({ title: d.title.slice(0, 80), reason: d.reason.slice(0, 120) })) ?? null;
        const asks = () => server.from("stubby_asks");
        const { error } = await asks().update({ ...r, drop_reasons: reasons, decision_trace: trace ?? null }).eq("id", id);
        if (!error) return;
        const second = await asks().update({ ...r, drop_reasons: reasons }).eq("id", id);
        if (second.error) await asks().update(r).eq("id", id);
      },
      async asksSince(user, ms) {
        const { count, error } = await server.from("stubby_asks").select("id", { count: "exact", head: true }).eq("user_id", user).gte("asked_at", iso(ms));
        if (error) throw error;
        return count ?? 0;
      },
      async oldestAskSince(user, ms) {
        const { data, error } = await server.from("stubby_asks").select("asked_at").eq("user_id", user).gte("asked_at", iso(ms)).order("asked_at", { ascending: true }).limit(1);
        if (error) throw error;
        const at = (data as { asked_at: string }[] | null)?.[0]?.asked_at;
        return at ? Date.parse(at) : null;
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
    async v3(input) {
      const selected = createV3Provider(env, { maxSearches: input.searchLimit });
      // Their own Pursuits and Corners first (no network), then Claude's web search.
      const own = sooshAdapter({ pursuits: input.profile.pursuits, picks: input.profile.picks });
      return runV3(input, { discovery: [own, selected.adapter], usage: selected.usage });
    },
    careModel: claudeCareModel({ apiKey: env("ANTHROPIC_API_KEY") ?? "", workspaceId: env("ANTHROPIC_WORKSPACE_ID") || null, model: env("STUBBY_CLAUDE_MODEL") || env("STUBBY_SCOUT_MODEL") || DEFAULT_MODEL }),
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
        prompt: r.prompt,
        onProgress: r.onProgress,
        workspaceId: env("ANTHROPIC_WORKSPACE_ID") || null,
        now: Date.now(),
      }),
  });
}
