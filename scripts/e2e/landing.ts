// Production landing page behind its real CSP, with Supabase replaced by fixtures.
// No live database, Claude request, signup or invitation is performed.
// PLAYWRIGHT_CHROMIUM=/usr/bin/chromium npm run e2e:landing
// Optional: --dist dist-e2e --human (reuse the guest build with human onboarding enabled).
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, type Route } from "playwright-core";
import { contrastInPage } from "../visual/contrast.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const arg = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const out = path.resolve(arg("--out") ?? path.join(os.tmpdir(), "soosh-landing-e2e"));
const dist = path.resolve(ROOT, arg("--dist") ?? fs.mkdtempSync(path.join(os.tmpdir(), "soosh-landing-build-")));
const human = args.includes("--human");
const SUPA = "https://fixture.supabase.co";
fs.mkdirSync(out, { recursive: true });
if (!arg("--dist")) {
  const result = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], {
    cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: SUPA, VITE_SUPABASE_ANON_KEY: "fixture-anon-key", VITE_HUMAN_ONBOARDING: String(human) },
  });
  assert.equal(result.status, 0, "Production build failed");
}
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const headers = Object.fromEntries(vercel.headers.filter((h: { source: string }) => h.source === "/(.*)").flatMap((h: { headers: { key: string; value: string }[] }) => h.headers.map(x => [x.key, x.value])));
const types: Record<string, string> = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  const name = path.resolve(dist, "." + decodeURIComponent(new URL(req.url!, "http://local").pathname));
  const file = name.startsWith(dist + path.sep) && fs.existsSync(name) && fs.statSync(name).isFile() ? name : path.join(dist, "index.html");
  res.writeHead(200, { ...headers, "content-type": types[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || ["/usr/bin/chromium", "/opt/pw-browsers"].flatMap(p => {
  if (p.endsWith("chromium")) return fs.existsSync(p) ? [p] : [];
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter(n => n.startsWith("chromium-")).map(n => path.join(p, n, "chrome-linux/chrome"));
}).find(p => fs.existsSync(p));
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}) }).catch(error => {
  server.close();
  throw error;
});
const report = { scope: "Local production build with real CSP and mocked Supabase. External fonts are blocked; system fallbacks are inspected. No live provider validation.", humanOnboarding: human, checks: [] as string[], views: [] as unknown[], errors: [] as string[] };
const passed = (name: string) => { report.checks.push(name); console.log("PASS", name); };
let guestsOpen = true;
const counts = { anonymousSignups: 0, asks: 0, writes: 0 };
const id = "00000000-0000-4000-8000-00000000e2e1";
const exp = () => Math.floor(Date.now() / 1000) + 3600;
const user = { id, aud: "authenticated", role: "authenticated", email: "", is_anonymous: true, app_metadata: { provider: "anonymous" }, user_metadata: {}, identities: [], created_at: "2026-11-02T12:00:00Z" };
const token = () => ["e30", Buffer.from(JSON.stringify({ sub: id, role: "authenticated", aud: "authenticated", exp: exp(), is_anonymous: true })).toString("base64url"), "guest"].join(".");
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
async function fixture(route: Route) {
  const req = route.request(), url = new URL(req.url());
  const json = (body: unknown, status = 200) => route.fulfill({ status, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(body) });
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  if (url.pathname === "/auth/v1/settings") return json({ external: { anonymous_users: guestsOpen, google: true, email: true } });
  if (url.pathname === "/auth/v1/signup") {
    counts.anonymousSignups++;
    return json({ access_token: token(), token_type: "bearer", expires_in: 3600, expires_at: exp(), refresh_token: "fixture-refresh", user });
  }
  if (url.pathname === "/auth/v1/user") return json(user);
  if (url.pathname === "/functions/v1/stubby-scout") {
    if (req.postDataJSON()?.status) return json({ asksLeft: 3, perDay: 3, accountPerDay: 6, guest: true });
    counts.asks++;
    return json({ error: "Stubby couldn’t look just now. Try again in a bit." }, 503);
  }
  // Existing public Corners bootstrap: a read RPC, despite using HTTP POST.
  if (url.pathname === "/rest/v1/rpc/corner_activity_30d") return json([]);
  if (req.method() !== "GET") counts.writes++;
  return json((req.headers().accept ?? "").includes("vnd.pgrst.object") ? null : []);
}

try {
  for (const view of [
    { name: "mobile", width: 390, height: 844, dark: false, touch: true },
    { name: "desktop", width: 1440, height: 1000, dark: false, touch: false },
    { name: "mobile-dark", width: 390, height: 844, dark: true, touch: true },
    { name: "small-phone", width: 320, height: 720, dark: false, touch: true },
    { name: "tablet", width: 768, height: 1024, dark: false, touch: true },
  ]) {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, hasTouch: view.touch, colorScheme: view.dark ? "dark" : "light", reducedMotion: "reduce" });
    await context.addInitScript(dark => localStorage.setItem("soosh-theme-preference", dark ? "dark" : "light"), view.dark);
    await context.route("**/*", route => {
      const u = new URL(route.request().url());
      if (u.origin === origin) {
        if (u.pathname === "/api/geo") return route.fulfill({ contentType: "application/json", body: '{"city":"New York"}' });
        return route.continue();
      }
      if (u.origin === SUPA) return fixture(route);
      return route.abort();
    });
    const page = await context.newPage();
    page.on("pageerror", e => report.errors.push(`${view.name}: ${e.message}`));
    await page.goto(origin, { waitUntil: "networkidle" });
    const preview = page.getByRole("group", { name: "Try an activity example" });
    await preview.getByRole("heading", { name: "Sketch an object" }).waitFor();
    assert.equal(await page.locator("main").count(), 1);
    assert.equal(await page.locator("main main").count(), 0);
    assert.equal(await page.getByText("What would you like to make more room for?", { exact: true }).count(), human ? 1 : 0);
    const initial = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, imageRequests: performance.getEntriesByType("resource").filter(x => /unsplash/.test(x.name)).length, controls: [...document.querySelectorAll<HTMLElement>(".lp a,.lp button,.lp summary")].filter(e => {
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.top > -100 && (r.height < 44 || r.width < 44);
    }).map(e => ({ text: e.textContent?.trim(), height: e.getBoundingClientRect().height, width: e.getBoundingClientRect().width })) }));
    assert(initial.scrollWidth <= initial.width, `${view.name}: horizontal overflow`);
    assert.equal(initial.imageRequests, 0);
    assert.deepEqual(initial.controls, [], `${view.name}: undersized touch targets`);
    const wrappedNavLabels = await page.locator(".lp-nav-actions a").evaluateAll(links => links.filter(link => {
      const r=document.createRange();r.selectNodeContents(link);return r.getClientRects().length > 1;
    }).map(link=>link.textContent));
    assert.deepEqual(wrappedNavLabels,[],`${view.name}: wrapped navigation labels`);
    const contrast = await page.evaluate(contrastInPage);
    assert.deepEqual(contrast.failures, [], `${view.name}: text contrast`);
    report.views.push({ name: view.name, ...initial, contrast });
    await page.screenshot({ path: path.join(out, `${view.name}-hero.png`) });
    await page.screenshot({ path: path.join(out, `${view.name}-full.png`), fullPage: true });
    const outside = preview.getByRole("button", { name: "Outside", exact: true });
    if (view.touch) await outside.tap(); else { await outside.focus(); await page.keyboard.press("Enter"); }
    await preview.getByRole("heading", { name: "Take a photo walk" }).waitFor();
    assert.equal(await outside.getAttribute("aria-pressed"), "true");
    await preview.getByRole("button", { name: "Another example" }).click();
    await preview.getByRole("heading", { name: "Listen for birds" }).waitFor();
    await preview.getByRole("button", { name: "Another example" }).click();
    await preview.getByRole("heading", { name: "Take a photo walk" }).waitFor();
    const summary = preview.locator("summary");
    await summary.focus(); await page.keyboard.press("Enter");
    assert(await preview.locator("details").evaluate((d: HTMLDetailsElement) => d.open));
    assert.match(await preview.innerText(), /Cost depends on the supplies you already have/);
    assert.match(await preview.innerText(), /Choose either option/);
    await page.keyboard.press("Enter");
    assert.equal(await preview.locator("details").evaluate((d: HTMLDetailsElement) => d.open), false);
    const gallery = page.getByRole("button", { name: /Music Play a song you know/ });
    if (view.touch) await gallery.tap(); else { await gallery.focus(); await page.keyboard.press("Enter"); }
    assert.equal(await preview.getByRole("heading", { name: "Play a song you know" }).evaluate(e => e === document.activeElement), true);
    assert(await preview.locator("details").evaluate((d: HTMLDetailsElement) => d.open));
    await preview.getByText("Electric guitar", { exact: true }).waitFor();
    const detailsContrast = await page.evaluate(contrastInPage);
    assert.deepEqual(detailsContrast.failures, [], `${view.name}: expanded details contrast`);
    assert.equal(await page.locator(".lp").evaluate(e => e.getAnimations({ subtree: true }).some(a => a.playState === "running")), false, "Reduced motion still animates");
    await preview.screenshot({ path: path.join(out, `${view.name}-details.png`) });
    const how = page.getByRole("button", { name: "How it works", exact: true }).last();
    await how.click();
    assert.equal(await page.locator("#how-heading").evaluate(e => e === document.activeElement), true);
    assert(!new URL(page.url()).hash.includes("how"));
    const faq = page.locator("#faq summary").first();
    await faq.focus(); await page.keyboard.press("Enter");
    assert(await page.locator("#faq details").first().evaluate((d: HTMLDetailsElement) => d.open));
    assert.deepEqual(counts, { anonymousSignups: 0, asks: 0, writes: 0 }, "Examples had server side effects");
    passed(`${view.name}: layout, examples, details, keyboard/touch, FAQ, reduced motion and no side effects`);
    // The actual route and field are used; choosing an example never automatically submits it.
    await outside.click();
    await page.getByRole("link", { name: "Try Soosh", exact: true }).first().click();
    const field = page.getByRole("textbox", { name: "What are you in the mood for?", exact: true });
    await field.waitFor();
    assert.equal(await field.inputValue(), "I’d like to take a photo walk outside.");
    assert.equal(counts.anonymousSignups, 0); assert.equal(counts.asks, 0);
    await field.fill("pottery this weekend");
    assert.equal(await field.inputValue(), "pottery this weekend");
    passed(`${view.name}: chosen example enters the real editable field without an ask`);
    await context.close();
  }

  // Real request error/retry behavior, behind a mocked provider response.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await context.route("**/*", route => new URL(route.request().url()).origin === SUPA ? fixture(route) : new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on("pageerror", e => report.errors.push(e.message));
  await page.goto(origin + "/#/calendar", { waitUntil: "networkidle" });
  const field = page.getByRole("textbox", { name: "What are you in the mood for?", exact: true });
  await field.fill("photo walk outside");
  await page.getByRole("button", { name: "Ask Stubby", exact: true }).click();
  await page.getByRole("button", { name: "Try again", exact: true }).waitFor();
  assert.equal(counts.asks, 1); assert.equal(counts.anonymousSignups, 1);
  assert.equal(await field.inputValue(), "photo walk outside");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("button", { name: "Try again", exact: true }).waitFor();
  assert.equal(counts.asks, 2);
  assert.equal(await page.getByText("You’re going", { exact: true }).count(), 0);
  passed("Explicit real request: failed result keeps the draft, offers retry and never claims a saved plan");
  await context.close();

  guestsOpen = false;
  const closed = await browser.newContext();
  await closed.route("**/*", route => new URL(route.request().url()).origin === SUPA ? fixture(route) : new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const closedPage = await closed.newPage();
  await closedPage.goto(origin, { waitUntil: "networkidle" });
  await closedPage.getByRole("link", { name: "Log in", exact: true }).click();
  await closedPage.getByRole("heading", { name: "Welcome back.", exact: true }).waitFor();
  await closedPage.goto(origin, { waitUntil: "networkidle" });
  await closedPage.getByRole("link", { name: "Try Soosh", exact: true }).first().click();
  await closedPage.getByText("Log in to use Stubby.", { exact: true }).first().waitFor();
  assert.equal(await closedPage.getByRole("textbox", { name: "What are you in the mood for?" }).count(), 0);
  assert.equal(counts.anonymousSignups, 1);
  passed("Existing-account login and closed-guest entry use the real auth gates");
  await closed.close();
  assert.deepEqual(report.errors, []);
  console.log(`Landing browser checks passed. Evidence: ${out}`);
} finally {
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
