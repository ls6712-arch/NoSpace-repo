// End to end: a guest uses Stubby, signs up with Google (mocked) and lands back in the same chat.
//
//   node scripts/e2e/guest-stubby.ts                 build, then run
//   node scripts/e2e/guest-stubby.ts --dist dist-e2e reuse a build
//
// An unmodified production build is served with vercel.json's own headers (so the Content
// Security Policy is the real one), pointed at https://fixture.supabase.co, and every Supabase
// call is answered here through Playwright: anonymous sign-in, the guest's picks, the edge
// function (3 asks, then 429 GUEST_LIMIT_REACHED), linkIdentity and the Google redirect.
//
// The run: a guest opens Stubby (no sign-up first), skips the quick-context card, asks 3 times →
// the inline sign-up card shows → the 4th ask hits the limit (picks still readable) → Sign up →
// Continue with Google → back on Stubby as the same user, the 3 picks still there, the blocked ask
// sent for them, and "You're in." Fails on any page error or CSP violation.
//
// Needs a Chromium: PLAYWRIGHT_CHROMIUM, or /opt/pw-browsers, or PLAYWRIGHT_BROWSERS_PATH.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Route } from "playwright-core";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const SUPA = "https://fixture.supabase.co";
const ANON_KEY = "fixture-anon-key";
const GUEST_ID = "00000000-0000-4000-8000-00000000e2e1";

const args = process.argv.slice(2);
const distArg = args.includes("--dist") ? args[args.indexOf("--dist") + 1] : null;
const dist = path.resolve(ROOT, distArg ?? "dist-e2e");
if (!distArg) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: SUPA, VITE_SUPABASE_ANON_KEY: ANON_KEY } });
  if (r.status !== 0) throw new Error("build failed");
}

// ── the site, with vercel.json's headers ───────────────────────────────────
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8")) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
const siteHeaders = Object.fromEntries(vercel.headers.filter((h) => h.source === "/(.*)").flatMap((h) => h.headers.map((x) => [x.key, x.value])));
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json", ".ico": "image/x-icon", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  // Plays Google's side of the redirect: a full page load back to the site, tokens in the hash.
  if (url.pathname === "/oauth-bounce") {
    res.writeHead(302, { location: `/#${url.searchParams.get("h") ?? ""}` });
    return res.end();
  }
  let file = path.join(dist, decodeURIComponent(url.pathname));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, "index.html");
  res.writeHead(200, { ...siteHeaders, "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const ORIGIN = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

// ── Supabase, played here ──────────────────────────────────────────────────
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const exp = () => Math.floor(Date.now() / 1000) + 3600;
const tokenFor = (anonymous: boolean) => ["e30", b64({ sub: GUEST_ID, role: "authenticated", aud: "authenticated", exp: exp(), is_anonymous: anonymous }), anonymous ? "guest" : "account"].join(".");
const GUEST_TOKEN = tokenFor(true);
const ACCOUNT_TOKEN = tokenFor(false);
const userOf = (anonymous: boolean) => ({
  id: GUEST_ID,
  aud: "authenticated",
  role: "authenticated",
  email: anonymous ? "" : "guest.e2e@example.test",
  is_anonymous: anonymous,
  app_metadata: { provider: anonymous ? "anonymous" : "google" },
  user_metadata: {},
  identities: [],
  created_at: "2026-11-02T12:00:00Z",
});
const sessionOf = (anonymous: boolean) => ({ access_token: anonymous ? GUEST_TOKEN : ACCOUNT_TOKEN, token_type: "bearer", expires_in: 3600, expires_at: exp(), refresh_token: anonymous ? "guest-refresh" : "account-refresh", user: userOf(anonymous) });

/** How the fake Supabase treats guests: open, anonymous sign-ins off, or the function not ready. */
let guestMode: "open" | "off" | "notReady" = "open";

const state = {
  guestAsks: 0,
  accountAsks: [] as string[],
  revoked: [] as string[],
  picks: [] as Record<string, unknown>[],
  anonSignIns: 0,
  forgedFieldsSeen: 0,
};
const pickRow = (n: number) => ({
  id: 100 + n,
  user_id: GUEST_ID,
  title: n === 2 ? `<img src=x onerror="window.__xss=1">Pick ${n}` : `Pick ${n}`,
  place: "Greenpoint, Brooklyn",
  starts_at: new Date(Date.now() + (n + 2) * 3_600_000).toISOString(),
  ends_at: null,
  price: "free",
  url: `https://example.com/pick-${n}`,
  note: null,
  created_at: new Date().toISOString(),
  kind: "event",
  why: "Close to you.",
  soonest_after: false,
  rank: 0,
  ask_id: n,
  better_with_friend: false,
  corners: null,
});

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
const json = (route: Route, status: number, body: unknown, extra: Record<string, string> = {}) =>
  route.fulfill({ status, headers: { ...cors, "content-type": "application/json", ...extra }, body: JSON.stringify(body) });
const bearer = (route: Route) => (route.request().headers()["authorization"] ?? "").replace(/^Bearer\s+/i, "");

async function supabase(route: Route) {
  const req = route.request();
  if (process.env.E2E_DEBUG) console.log("  >", req.method(), req.url().replace(SUPA, "").slice(0, 110), (req.headers()["authorization"] ?? "").slice(-8));
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  const url = new URL(req.url());
  const p = url.pathname;
  const token = bearer(route);
  const anonymous = token === GUEST_TOKEN;

  // Auth
  if (p === "/auth/v1/settings") return json(route, 200, { external: { anonymous_users: guestMode !== "off", google: true, email: true } });
  if (p === "/auth/v1/signup") {
    state.anonSignIns += 1;
    if (guestMode === "off") return json(route, 422, { code: "anonymous_provider_disabled", msg: "Anonymous sign-ins are disabled" });
    return json(route, 200, sessionOf(true));
  }
  if (p === "/auth/v1/token") {
    const body = req.postDataJSON() as { refresh_token?: string };
    return json(route, 200, sessionOf(body.refresh_token === "guest-refresh"));
  }
  if (p === "/auth/v1/user" && req.method() === "GET") return json(route, 200, userOf(anonymous));
  if (p === "/auth/v1/user/identities/authorize") {
    // Google says yes: the same user, no longer anonymous, back on the site with tokens in the address.
    const s = sessionOf(false);
    const h = `access_token=${s.access_token}&refresh_token=${s.refresh_token}&expires_in=3600&expires_at=${s.expires_at}&token_type=bearer&type=signup`;
    return json(route, 200, { url: `${ORIGIN}/oauth-bounce?h=${encodeURIComponent(h)}` });
  }
  if (p === "/auth/v1/logout") {
    state.revoked.push(token === GUEST_TOKEN ? "guest" : "account");
    return route.fulfill({ status: 204, headers: cors });
  }

  // The edge function
  if (p === "/functions/v1/stubby-scout") {
    const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
    if (anonymous && guestMode === "notReady") return json(route, 503, { error: "Stubby isn't open to guests yet.", code: "GUESTS_NOT_READY" });
    if ("user_id" in body || "guest_id" in body) state.forgedFieldsSeen += 1;
    if (body.status === true) return json(route, 200, anonymous ? { asksLeft: 3 - state.guestAsks, perDay: 3, accountPerDay: 6, guest: true } : { asksLeft: 6 - state.guestAsks - state.accountAsks.length, perDay: 6, accountPerDay: 6, guest: false });
    if (anonymous) {
      if (state.guestAsks >= 3) return json(route, 429, { error: "That's 3 for today. I'll look again tomorrow.", code: "GUEST_LIMIT_REACHED", resetsAt: new Date(Date.now() + 20 * 3_600_000).toISOString() });
      state.guestAsks += 1;
      state.picks.push(pickRow(state.guestAsks));
      // The person's own count would allow more, but the 4th is refused (as by the network limit):
      // the 429 path, where what they typed is kept and sent after sign-up.
      return json(route, 200, { picks: [{}], outcome: "found", askId: state.guestAsks, asksLeft: Math.max(1, 3 - state.guestAsks), free: false, reasons: [], understood: { when: "tonight" } });
    }
    state.accountAsks.push(String(body.ask ?? ""));
    const n = 3 + state.accountAsks.length;
    state.picks.push(pickRow(n));
    return json(route, 200, { picks: [{}], outcome: "found", askId: n, asksLeft: 6 - n, free: false, reasons: [], understood: { when: "tonight" } });
  }

  // PostgREST
  if (p.startsWith("/rest/v1/")) {
    const table = p.slice("/rest/v1/".length);
    const one = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    if (table === "personal_picks" && req.method() === "GET") return json(route, 200, state.picks);
    if (table === "stubby_asks") return json(route, 200, [], { "content-range": `0-0/${anonymous ? state.guestAsks : state.guestAsks + state.accountAsks.length}` });
    if (table === "profiles" && req.method() === "GET" && !anonymous && token) {
      const row = { id: GUEST_ID, username: "guest_e2e", display_name: "guest.e2e", avatar_url: null, tagline: null, onboarding_completed_at: null, onboarding_completed: false, bio: null, cover_title: null, cover_tagline: null, cover_post_id: null, theme_preference: null, access: "active", invited_by: null, invite_allowance: 0, signed_up_from: "stubby", paused_at: null, deletion_requested_at: null };
      return json(route, 200, one ? row : [row]);
    }
    if (req.method() === "GET" || req.method() === "HEAD") return one ? json(route, 406, { code: "PGRST116" }) : json(route, 200, []);
    return json(route, 201, []);
  }
  return json(route, 404, {});
}

// ── the run ────────────────────────────────────────────────────────────────
const exe =
  process.env.PLAYWRIGHT_CHROMIUM ??
  (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined) ??
  (() => {
    try {
      return execFileSync("bash", ["-lc", "ls -d ${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}/chromium-*/chrome-linux/chrome | head -1"], { encoding: "utf8" }).trim() || undefined;
    } catch {
      return undefined;
    }
  })();
const browser = await chromium.launch({ executablePath: exe && fs.statSync(exe).isFile() ? exe : undefined });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.route(`${SUPA}/**`, supabase);
await context.route(`${ORIGIN}/api/geo`, (r) => json(r, 200, { city: "Brooklyn" }));
const page = await context.newPage();
const problems: string[] = [];
// Any page error fails the run, a Content Security Policy refusal included (HEIC conversion moved
// to the server so the policy needs no 'unsafe-eval').
page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
page.on("console", (m) => {
  if (process.env.E2E_DEBUG && m.type() !== "debug") console.log("  console", m.type(), m.text().slice(0, 200));
  if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) problems.push(`CSP: ${m.text()}`);
});

const step = (name: string) => console.log(`· ${name}`);
const fail = (why: string) => {
  throw new Error(why);
};

/**
 * Guests not open: a clean "Log in to use Stubby", no field, no error line, nothing made. Runs in
 * its own browser context (its own storage) so the main run starts from nothing.
 */
async function closedScenario(mode: "off" | "notReady") {
  guestMode = mode;
  const before = state.anonSignIns;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(`${SUPA}/**`, supabase);
  await ctx.route(`${ORIGIN}/api/geo`, (r) => json(r, 200, { city: "Brooklyn" }));
  const p = await ctx.newPage();
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to|Uncaught/i.test(m.text())) errors.push(m.text());
  });
  try {
    await p.goto(`${ORIGIN}/#/calendar`);
    await p.getByRole("heading", { level: 1, name: "Ask Stubby" }).waitFor();
    if (mode === "notReady") {
      // Sign-ins are on, so the field is there; the first ask finds out the server isn't ready.
      await p.locator("[data-context-card]").getByRole("button", { name: "Skip" }).click();
      await p.getByRole("button", { name: "Free tonight" }).click();
    }
    await p.locator("[data-guest-closed]").waitFor({ timeout: 10_000 });
    const panel = await p.locator("[data-guest-closed]").innerText();
    if (!panel.includes("Log in to use Stubby.")) fail(`${mode}: closed panel says: ${panel}`);
    if (!(await p.locator("[data-guest-closed]").getByRole("link", { name: "Log in" }).count())) fail(`${mode}: no Log in link`);
    if (!(await p.locator("[data-guest-closed]").getByRole("link", { name: "Sign up" }).count())) fail(`${mode}: no Sign up link`);
    if (await p.getByLabel("What are you in the mood for?").count()) fail(`${mode}: the ask field is still there`);
    if (await p.locator("[data-context-card]").count()) fail(`${mode}: the context card is still there`);
    const text = await p.locator("body").innerText();
    if (/went wrong|couldn.t look|try again|error/i.test(text)) fail(`${mode}: an error line is showing`);
    if (mode === "off" && state.anonSignIns !== before) fail("off: a guest sign-in was attempted though sign-ins are off");
    if (errors.length) fail(`${mode}: ${errors.join(" | ")}`);
  } finally {
    await ctx.close();
    guestMode = "open";
  }
}

try {
  step("anonymous sign-ins off: a clean 'Log in to use Stubby', no errors, no guest made");
  await closedScenario("off");
  step("server not ready for guests: the first ask turns into the same clean state");
  await closedScenario("notReady");
  state.anonSignIns = 0;

  step("a guest opens Stubby: no sign-up first");
  await page.goto(`${ORIGIN}/#/calendar`);
  await page.getByRole("heading", { level: 1, name: "Ask Stubby" }).waitFor();
  if ((await page.locator("[data-guest-signup]").count()) !== 1) fail("no Sign up button in Stubby's header");
  if (state.anonSignIns !== 0) fail("a guest was made just for opening the page");

  step("the quick-context card shows, prefilled from the IP, and Skip works");
  await page.locator("[data-context-card]").waitFor();
  await page.getByRole("button", { name: "Skip" }).click();
  await page.locator("[data-context-card]").waitFor({ state: "detached" });

  step("three asks; the 3rd brings the inline card");
  const field = page.getByLabel("What are you in the mood for?");
  await page.getByRole("button", { name: "Free tonight" }).click();
  await page.getByText("Pick 1", { exact: true }).waitFor();
  if (state.anonSignIns !== 1) fail(`expected one guest made on the first ask, got ${state.anonSignIns}`);
  for (const ask of ["pottery tonight", "a free run"]) {
    if (await page.locator("[data-inline-signup]").count()) fail("the inline card showed before the 3rd ask");
    await field.fill(ask);
    await page.getByRole("button", { name: "Ask Stubby", exact: true }).click();
    await page.waitForFunction((n) => document.body.innerText.includes(`2 of ${n}`) || document.body.innerText.includes("Pick"), 3);
  }
  await page.locator("[data-inline-signup]").waitFor();
  const cardText = await page.locator("[data-inline-signup]").innerText();
  if (!cardText.includes("Sign up to keep your picks and get 6 asks a day.")) fail(`inline card says: ${cardText}`);

  step("a pick's title with markup is shown as text");
  if ((await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)) === 1) fail("XSS: an onerror handler ran");

  step("the 4th ask hits the limit; what was found stays readable");
  // The card's own ✕ (labelled Not now); the deck's Not now is a different button.
  await page.locator("[data-inline-signup]").getByRole("button", { name: "Not now" }).click();
  await page.locator("[data-inline-signup]").waitFor({ state: "detached" });
  await field.fill("jazz tonight");
  await page.getByRole("button", { name: "Ask Stubby", exact: true }).click();
  await page.locator("[data-limit-panel]").waitFor();
  const panel = await page.locator("[data-limit-panel]").innerText();
  if (!/Sign up for 3 more asks today, or ask again after/.test(panel)) fail(`limit panel says: ${panel}`);
  if ((await page.getByRole("textbox", { name: "What are you in the mood for?" }).count()) !== 0) fail("the field is still there at the limit");
  await page.locator("[data-stubby-deck-front]").getByText(/^Pick \d$/).waitFor();

  step("Sign up → Continue with Google → back as the same user");
  await page.locator("[data-limit-panel]").getByRole("button", { name: "Sign up" }).click();
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.waitForURL(/#\/calendar/, { timeout: 15_000 });
  await page.getByText("You’re in. Your picks are saved.").waitFor({ timeout: 15_000 });

  step("the blocked ask is sent for them, the guest picks are all there, the old guest session is ended");
  await page.waitForFunction(() => document.body.innerText.includes("Pick 4"), undefined, { timeout: 15_000 });
  if (state.accountAsks[0] !== "jazz tonight") fail(`the blocked ask wasn't sent: ${JSON.stringify(state.accountAsks)}`);
  if (!state.revoked.includes("guest")) fail("the guest session was not revoked after sign-up");
  if (await page.locator("[data-guest-signup], [data-inline-signup], [data-limit-panel]").count()) fail("a signed-up user still sees a sign-up prompt");
  const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("soosh-guest-stubby")));
  if (stored.length) fail(`the guest session is still on this device: ${stored.join(", ")}`);
  if (state.forgedFieldsSeen) fail("the app sent a user_id or guest_id in a body");

  if (problems.length) fail(problems.join("\n"));
  console.log("PASS guest → 3 asks → card → limit → Google sign-up → same chat, draft sent");
} catch (e) {
  console.error(`FAIL ${(e as Error).message}`);
  if (problems.length) console.error(problems.join("\n"));
  await page.screenshot({ path: path.join(ROOT, "e2e-guest-stubby-failure.png"), fullPage: true }).catch(() => undefined);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
