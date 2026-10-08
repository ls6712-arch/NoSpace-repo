// Round 5 QA: the one-time Terms prompt for an existing account with no
// recorded acceptance, at 390px, against the fixture Supabase. Fails (exit 1)
// if it can be skipped, or if the client supplies the time.
//
//   node scripts/visual/qa-round5.ts --out docs/qa/round-5
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import { buildFixtures, ME } from "./fixtures.ts";
import { FIXTURE_ANON_KEY, FIXTURE_ORIGIN, installSupabaseMock, seededSession } from "./mock-supabase.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const TYPES = path.join(HERE, "database.types.ts");
const args = process.argv.slice(2);
const opt = (n: string, d?: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt("out", "docs/qa/round-5")!);
const W = 390, H = 844;
const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".html": "text/html" };

function build(dist: string) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY } });
  if (r.status !== 0) throw new Error("build failed");
}
function serve(dist: string): Promise<{ port: number; close: () => void }> {
  const server = http.createServer((q, res) => {
    let f = path.join(dist, (q.url ?? "/").split("?")[0]);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html");
    res.setHeader("content-type", MIME[path.extname(f)] ?? "text/html"); res.end(fs.readFileSync(f));
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ port: (server.address() as { port: number }).port, close: () => server.close() })));
}

const results: string[] = [];
let failed = false;
const check = (name: string, ok: boolean) => { results.push(`${ok ? "PASS" : "FAIL"}\t${name}`); if (!ok) failed = true; };
const LABEL = /16 or older and agree to the Terms and Privacy Policy/;

async function existingAccount(browser: Awaited<ReturnType<typeof chromium.launch>>, port: number) {
  const fx = buildFixtures();
  // An onboarded account from before the checkbox existed: nothing recorded,
  // and named after its email so the name prompt is waiting behind the Terms.
  const me = (fx.profiles as Array<Record<string, unknown>>).find((p) => p.id === ME)!;
  me.display_name = "maya";
  const acceptances = (fx as Record<string, unknown>).terms_acceptances as Array<Record<string, unknown>>;
  (fx as Record<string, unknown>).terms_acceptances = acceptances.filter((a) => a.user_id !== ME);
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: "light", reducedMotion: "reduce", deviceScaleFactor: 2 });
  await installSupabaseMock(ctx, fx, TYPES);
  await ctx.addInitScript((session) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); } catch { /* blocked */ } }, seededSession());
  const rpcBodies: string[] = [];
  const profileWrites: string[] = [];
  ctx.on("request", (r) => {
    const u = r.url();
    if (u.includes("/rest/v1/rpc/accept_terms")) rpcBodies.push(r.postData() ?? "");
    if (u.includes("/rest/v1/profiles") && r.method() !== "GET") profileWrites.push(`${r.method()} ${r.postData() ?? ""}`);
  });
  const page = await ctx.newPage();
  const errs: string[] = []; page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(`http://localhost:${port}/#/my-space`); await page.waitForTimeout(2500);

  const box = page.getByLabel(LABEL);
  const cont = page.getByRole("button", { name: "Continue" });
  check("the Terms prompt shows on the next visit", await box.isVisible().catch(() => false));
  check("the name prompt waits behind it", (await page.getByText("Is this how you’d like to be known?").count()) === 0);
  check("Continue is blocked until ticked", await cont.isDisabled());
  check("there is no close button", (await page.getByRole("button", { name: /close/i }).count()) === 0);
  await page.screenshot({ path: path.join(OUT, "existing-account-terms-unchecked.png") });

  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  check("Escape does not dismiss it", await box.isVisible().catch(() => false));
  await page.mouse.click(10, 400); await page.waitForTimeout(300);
  check("clicking outside does not dismiss it", await box.isVisible().catch(() => false));

  await box.check();
  check("Continue unblocks once ticked", await cont.isEnabled());
  await page.screenshot({ path: path.join(OUT, "existing-account-terms-checked.png") });
  await cont.click(); await page.waitForTimeout(1200);

  check("accepting asks the database once", rpcBodies.length === 1);
  check("the client sent only the version, no time", rpcBodies.every((b) => { try { return Object.keys(JSON.parse(b)).join() === "p_version"; } catch { return false; } }));
  check("the client wrote nothing to profiles itself", profileWrites.length === 0);
  const mine = ((fx as Record<string, unknown>).terms_acceptances as Array<Record<string, unknown>>).filter((a) => a.user_id === ME);
  check("one record of the current version, stamped by the server side", mine.length === 1 && typeof mine[0].accepted_at === "string");
  check("the Terms prompt is gone", !(await box.isVisible().catch(() => false)));
  check("the name prompt follows, once", await page.getByText("Is this how you’d like to be known?").isVisible().catch(() => false));
  await page.screenshot({ path: path.join(OUT, "existing-account-after-accept.png") });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("no horizontal scroll", overflow <= 0);
  check("no page errors", errs.length === 0);

  // Next visit: already recorded, so nothing is asked again.
  await page.goto(`http://localhost:${port}/#/discover`); await page.reload(); await page.waitForTimeout(2000);
  check("not asked again on the next visit", !(await box.isVisible().catch(() => false)));
  await ctx.close();
}

async function acceptedAnOlderVersion(browser: Awaited<ReturnType<typeof chromium.launch>>, port: number) {
  const fx = buildFixtures();
  // Accepted before: but only an older version, so a new version asks again.
  (fx as Record<string, unknown>).terms_acceptances = [{ user_id: ME, terms_version: "2026-01-01", accepted_at: "2026-01-01T00:00:00Z" }];
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: "light", reducedMotion: "reduce", deviceScaleFactor: 2 });
  await installSupabaseMock(ctx, fx, TYPES);
  await ctx.addInitScript((session) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); } catch { /* blocked */ } }, seededSession());
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/#/my-space`); await page.waitForTimeout(2500);
  check("a record of only an older version asks again", await page.getByLabel(LABEL).isVisible().catch(() => false));
  await ctx.close();
}

async function alreadyAccepted(browser: Awaited<ReturnType<typeof chromium.launch>>, port: number) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: "light", reducedMotion: "reduce", deviceScaleFactor: 2 });
  await installSupabaseMock(ctx, buildFixtures(), TYPES);
  await ctx.addInitScript((session) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); } catch { /* blocked */ } }, seededSession());
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/#/my-space`); await page.waitForTimeout(2500);
  check("an account with a record of the current version is never asked", !(await page.getByLabel(LABEL).isVisible().catch(() => false)));
  await ctx.close();
}

const main = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  const dist = path.join(OUT, ".dist");
  build(dist);
  const srv = await serve(dist);
  try { await existingAccount(browser, srv.port); await acceptedAnOlderVersion(browser, srv.port); await alreadyAccepted(browser, srv.port); }
  catch (e) { check(`ran to the end (${String(e).split("\n")[0].slice(0, 100)})`, false); }
  srv.close(); fs.rmSync(dist, { recursive: true, force: true });
  await browser.close();
  fs.writeFileSync(path.join(OUT, "terms-existing-check.tsv"), results.join("\n") + "\n");
  console.log(results.join("\n"));
  process.exit(failed ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
