// Round 4 QA: the sign-up age and Terms checkbox at 390px, against the
// fixture Supabase. Fails (exit 1) if sign-up is not blocked until it is ticked.
//
//   node scripts/visual/qa-round4.ts --out docs/qa/round-4
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
const OUT = path.resolve(ROOT, opt("out", "docs/qa/round-4")!);
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

async function signup(browser: Awaited<ReturnType<typeof chromium.launch>>, port: number) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: "light", reducedMotion: "reduce", deviceScaleFactor: 2 });
  await installSupabaseMock(ctx, buildFixtures(), TYPES);
  const page = await ctx.newPage();
  const errs: string[] = []; page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  await page.goto(`http://localhost:${port}/#/login?mode=signup`); await page.waitForTimeout(1500);
  const box = page.getByLabel(LABEL);
  const google = page.getByRole("button", { name: "Continue with Google" });
  const submit = page.getByRole("button", { name: "Sign up" });
  check("checkbox shows on sign-up", await box.isVisible().catch(() => false));
  check("checkbox starts unticked", !(await box.isChecked().catch(() => true)));
  check("Google is blocked until ticked", await google.isDisabled());
  check("Sign up is blocked until ticked", await submit.isDisabled());
  check("Terms is linked", (await page.getByRole("link", { name: "Terms", exact: true }).getAttribute("href"))?.endsWith("/terms") ?? false);
  check("Privacy Policy is linked", (await page.getByRole("link", { name: "Privacy Policy" }).getAttribute("href"))?.endsWith("/privacy-policy") ?? false);
  await page.screenshot({ path: path.join(OUT, "signup-unchecked.png"), fullPage: true });
  await box.check();
  check("Google unblocks once ticked", await google.isEnabled());
  check("Sign up unblocks once ticked", await submit.isEnabled());
  await page.screenshot({ path: path.join(OUT, "signup-checked.png"), fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("no horizontal scroll", overflow <= 0);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click(); await page.waitForTimeout(500);
  check("log in form has no checkbox", (await page.getByLabel(LABEL).count()) === 0);
  check("no page errors", errs.length === 0);
  await ctx.close();
}

async function onboardingFallback(browser: Awaited<ReturnType<typeof chromium.launch>>, port: number) {
  const fx = buildFixtures();
  const me = (fx.profiles as Array<Record<string, unknown>>).find((p) => p.id === ME)!;
  me.onboarding_completed = false; me.onboarding_completed_at = null; me.terms_accepted_at = null; me.display_name = "maya";
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: "light", reducedMotion: "reduce", deviceScaleFactor: 2 });
  await installSupabaseMock(ctx, fx, TYPES);
  await ctx.addInitScript((session) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); } catch { /* blocked */ } }, seededSession());
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/#/`); await page.waitForTimeout(2500);
  const box = page.getByLabel(LABEL);
  check("onboarding asks once when no acceptance is recorded", await box.isVisible().catch(() => false));
  await page.getByLabel("Name").fill("Maya Okafor");
  check("Continue is blocked until ticked", await page.getByRole("button", { name: "Continue" }).isDisabled());
  await page.screenshot({ path: path.join(OUT, "onboarding-terms-needed.png"), fullPage: true });
  await box.check();
  check("Continue unblocks once ticked", await page.getByRole("button", { name: "Continue" }).isEnabled());
  await ctx.close();
}

const main = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  const dist = path.join(OUT, ".dist");
  build(dist);
  const srv = await serve(dist);
  try { await signup(browser, srv.port); await onboardingFallback(browser, srv.port); }
  catch (e) { check(`ran to the end (${String(e).split("\n")[0].slice(0, 100)})`, false); }
  srv.close(); fs.rmSync(dist, { recursive: true, force: true });
  await browser.close();
  fs.writeFileSync(path.join(OUT, "terms-check.tsv"), results.join("\n") + "\n");
  console.log(results.join("\n"));
  process.exit(failed ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
