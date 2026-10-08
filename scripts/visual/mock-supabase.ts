// Plays the part of Supabase for the visual harness, entirely through
// Playwright network interception: auth, PostgREST reads, RPCs, storage
// objects and the realtime socket. The app under test is an unmodified
// production build pointed at https://fixture.supabase.co.
import type { BrowserContext } from "playwright-core";
import { ME, MEDIA_ORIGIN } from "./fixtures.ts";
import { empty, json, parseForeignKeys, select, type AnyRow, type Ctx, type Fixtures, type Reply } from "./postgrest.ts";

export const FIXTURE_ORIGIN = "https://fixture.supabase.co";
export const FIXTURE_ANON_KEY = "fixture-anon-key";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** A signed-in session in the shape supabase-js persists under sb-<ref>-auth-token. */
export function seededSession(userId = ME) {
  const exp = Math.floor(Date.now() / 1000) + 86400;
  const user = { id: userId, aud: "authenticated", role: "authenticated", email: "maya@example.test", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const access_token = ["e30", b64({ sub: userId, role: "authenticated", aud: "authenticated", exp, email: user.email }), "fixture"].join(".");
  return { access_token, token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "fixture-refresh", user };
}

const PALETTE = [["#E8D5AC", "#C96F49"], ["#D6E0C8", "#7C8A54"], ["#CFDDE8", "#5C7C97"], ["#F0D6D2", "#D98A82"], ["#EADFCF", "#8A6A49"]];
/** A flat, warm placeholder "photo" so media tiles have real pixels without any asset files. */
function placeholderSvg(name: string): string {
  const n = parseInt(name.replace(/\D/g, "") || "0", 10);
  const [bg, fg] = PALETTE[n % PALETTE.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><rect width="640" height="640" fill="${bg}"/><circle cx="${200 + (n % 4) * 60}" cy="${300 - (n % 3) * 40}" r="${130 + (n % 3) * 20}" fill="${fg}" opacity=".85"/><rect x="120" y="470" width="400" height="22" rx="11" fill="${fg}" opacity=".35"/></svg>`;
}

export interface MockReport { unservedTables: Set<string>; unhandledRpc: Set<string>; requests: number }

export interface MockOptions {
  /** Hold every image response this long, so layout shift while photos load is measurable. */
  imageDelayMs?: number;
  /** Hold every image response until this promise resolves (measure the page with the photos still pending). */
  imageGate?: Promise<void>;
  /** Answer every image request with a 404, to exercise broken-image fallbacks. */
  brokenImages?: boolean;
}

export async function installSupabaseMock(context: BrowserContext, fixtures: Fixtures, typesPath: string, opts: MockOptions = {}): Promise<MockReport> {
  const ctx: Ctx = { fixtures, fks: parseForeignKeys(typesPath) };
  const report: MockReport = { unservedTables: new Set(), unhandledRpc: new Set(), requests: 0 };
  const session = seededSession();
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };

  const rpc = (fn: string, args: AnyRow): unknown => {
    const messages = (fixtures.messages ?? []) as AnyRow[];
    switch (fn) {
      case "participation_message_summaries": {
        const byP = new Map<number, AnyRow[]>();
        for (const m of messages) { if (m.participation_id != null) byP.set(m.participation_id as number, [...(byP.get(m.participation_id as number) ?? []), m]); }
        return [...byP].map(([participation_id, ms]) => { const last = [...ms].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).at(-1)!; return { participation_id, last_message_id: last.id, last_message_body: last.body, last_message_created_at: last.created_at, last_message_from_user: last.from_user, message_count: ms.length, unread_count: ms.filter((m) => m.from_user !== ME).length ? 1 : 0 }; });
      }
      case "you_inspired_this_month": return 0;
      // The database stamps the time itself; the client sends only the version.
      case "accept_terms": {
        const rows = (fixtures.terms_acceptances ?? (fixtures.terms_acceptances = [])) as AnyRow[];
        const version = String(args.p_version ?? "");
        let row = rows.find((r) => r.user_id === session.user.id && r.terms_version === version);
        if (!row) { row = { user_id: session.user.id, terms_version: version, accepted_at: new Date().toISOString() }; rows.push(row); }
        return row.accepted_at;
      }
      default: report.unhandledRpc.add(fn); void args; return [];
    }
  };

  const sendImage = async (route: import("playwright-core").Route, name: string) => {
    if (opts.imageGate) await opts.imageGate;
    if (opts.imageDelayMs) await new Promise((r) => setTimeout(r, opts.imageDelayMs));
    if (opts.brokenImages) return route.fulfill({ status: 404, headers: cors, body: "not found" });
    return route.fulfill({ status: 200, headers: { ...cors, "content-type": "image/svg+xml", "cache-control": opts.imageDelayMs ? "no-store" : "max-age=3600" }, body: placeholderSvg(name) });
  };
  // Seed photos come from Unsplash; serve the same flat placeholders so screens look the same offline.
  await context.route("https://images.unsplash.com/**", (route) => sendImage(route, new URL(route.request().url()).pathname));

  await context.route(`${FIXTURE_ORIGIN}/**`, async (route) => {
    report.requests++;
    const req = route.request(); const url = new URL(req.url()); const method = req.method();
    const reply = (r: Reply) => route.fulfill({ status: r.status, headers: { ...cors, ...r.headers }, body: r.body });
    if (method === "OPTIONS") return reply(empty(204));
    const p = url.pathname;
    if (p.startsWith("/auth/v1/")) {
      if (p.endsWith("/user")) return reply(json(200, session.user));
      if (p.endsWith("/token")) return reply(json(200, session));
      if (p.endsWith("/logout")) return reply(empty(204));
      return reply(json(200, {}));
    }
    if (p.startsWith("/storage/v1/object/public/")) {
      const name = p.split("/").pop() ?? "0";
      return sendImage(route, name);
    }
    if (p.startsWith("/storage/v1/object/sign/")) {
      const name = p.split("/").pop() ?? "0";
      // createSignedUrls is a POST with {paths}; the signed URL it returns is then fetched with GET.
      if (route.request().method() === "GET") return sendImage(route, name);
      let paths: string[] = [];
      try { paths = (JSON.parse(route.request().postData() ?? "{}") as { paths?: string[] }).paths ?? []; } catch { /* no body */ }
      if (paths.length) return reply(json(200, paths.map((path) => ({ path, signedURL: `/object/sign/moment-media/${encodeURIComponent(path.split("/").pop() ?? "0")}?token=fixture`, error: null }))));
      return reply(json(200, { signedURL: `/object/sign/x/${name}` }));
    }
    if (p.startsWith("/storage/v1/")) return reply(json(200, []));
    if (p.startsWith("/rest/v1/rpc/")) {
      let args: AnyRow = {}; try { args = JSON.parse(req.postData() || "{}"); } catch { /* no body */ }
      return reply(json(200, rpc(p.slice("/rest/v1/rpc/".length), args)));
    }
    if (p.startsWith("/rest/v1/")) {
      const table = p.slice("/rest/v1/".length);
      if (method === "GET" || method === "HEAD") {
        const r = select(ctx, table, url, req.headers()["accept"] ?? "", (req.headers()["prefer"] ?? "").includes("count="));
        if (r.status === 404) report.unservedTables.add(table);
        return reply(method === "HEAD" ? { ...r, body: "" } : r);
      }
      // Writes are acknowledged, never stored: each screenshot starts from the same state.
      let echo: unknown = []; try { const b = JSON.parse(req.postData() || "null"); echo = Array.isArray(b) ? b : b ? [b] : []; } catch { /* no body */ }
      const wantsBody = (req.headers()["prefer"] ?? "").includes("return=representation");
      if (!wantsBody) return reply(empty(method === "POST" ? 201 : 204));
      return reply((req.headers()["accept"] ?? "").includes("vnd.pgrst.object") ? json(200, (echo as unknown[])[0] ?? {}) : json(method === "POST" ? 201 : 200, echo));
    }
    return reply(json(404, { message: "not mocked" }));
  });
  // Placeholder images are plain public URLs on the fixture origin; nothing else leaves the machine.
  await context.routeWebSocket(/fixture\.supabase\.co\/realtime/, (ws) => { ws.onMessage(() => { /* accept and stay quiet */ }); });
  void MEDIA_ORIGIN;
  return report;
}
