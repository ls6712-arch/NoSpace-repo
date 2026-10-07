// Takes the 390px QA screenshots for docs/qa/round-2 against the same
// fixture Supabase the visual harness uses.
//
//   node scripts/visual/qa-shots.ts --out docs/qa/round-2 [--dist <already-built dir>]
//
// Needs a Chromium (PLAYWRIGHT_BROWSERS_PATH). Text is checked, not just
// photographed: every page is also scanned for horizontal scroll.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import { buildFixtures, PURSUIT_ID, SPACE_SLUG } from "./fixtures.ts";
import { FIXTURE_ANON_KEY, FIXTURE_ORIGIN, installSupabaseMock, seededSession } from "./mock-supabase.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const TYPES = path.join(HERE, "database.types.ts");
const args = process.argv.slice(2);
const opt = (n: string, d?: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt("out", "docs/qa/round-2")!);
const W = 390, H = 844;

const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".html": "text/html" };

function build(dist: string) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY } });
  if (r.status !== 0) throw new Error("build failed");
}

function serve(dist: string): Promise<{ port: number; close: () => void }> {
  const server = http.createServer((q, res) => {
    const u = (q.url ?? "/").split("?")[0];
    let f = path.join(dist, u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html");
    res.setHeader("content-type", MIME[path.extname(f)] ?? "text/html"); res.end(fs.readFileSync(f));
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ port: (server.address() as { port: number }).port, close: () => server.close() })));
}

interface Shot { name: string; route: string; signedOut?: boolean; setup?: (p: Page) => Promise<void>; errorTables?: boolean }
const click = (text: string) => async (p: Page) => { await p.getByText(text).first().click({ timeout: 8000 }); await p.waitForTimeout(600); };

const SHOTS: Shot[] = [
  { name: "01-landing", route: "/", signedOut: true },
  { name: "02-home", route: "/my-space" },
  { name: "03-discover", route: "/discover" },
  { name: "04-shelf-own", route: "/you" },
  { name: "05-shelf-other", route: "/u/theo" },
  { name: "06-pursuit", route: `/pursuit/${PURSUIT_ID}` },
  { name: "07-log-from-nav", route: "/create" },
  { name: "08-log-from-pursuit", route: `/create?pursuit=${PURSUIT_ID}` },
  { name: "09-log-from-corner", route: "/create?sub=pottery&hobby=crafts-making", setup: click("Write it down") },
  { name: "10-log-saved", route: "/create", setup: async (p) => { await click("Write it down")(p); await p.getByPlaceholder(/what happened/i).first().fill("Glazed the last three bowls"); await p.getByRole("button", { name: /Keep it private|Share/ }).first().click({ timeout: 8000 }); await p.waitForTimeout(1200); } },
  { name: "11-space", route: `/space/${SPACE_SLUG}` },
  { name: "12-search-results", route: "/search?q=pottery" },
  { name: "13-search-none", route: "/search?q=zzzzqx" },
  { name: "14-messages", route: "/messages" },
  { name: "15-notifications", route: "/inbox" },
  { name: "16-settings", route: "/settings" },
  { name: "17-empty-state", route: "/people?q=zzzzqx" },
  { name: "18-error-state", route: "/discover", errorTables: true },
];

const main = async () => {
  const dist = path.resolve(opt("dist") ?? path.join(OUT, ".dist"));
  if (!opt("dist")) build(dist);
  const srv = await serve(dist);
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  fs.mkdirSync(OUT, { recursive: true });
  const report: string[] = [];
  for (const s of SHOTS) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: "light", reducedMotion: "reduce", deviceScaleFactor: 2 });
    await installSupabaseMock(ctx, buildFixtures(), TYPES);
    if (s.errorTables) await ctx.route(`${FIXTURE_ORIGIN}/rest/v1/posts*`, (r) => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "boom" }) }));
    if (!s.signedOut) await ctx.addInitScript((session) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); } catch { /* storage blocked */ } }, seededSession());
    const page = await ctx.newPage();
    const errs: string[] = []; page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    try {
      await page.goto(`http://localhost:${srv.port}/#${s.route}`); await page.waitForTimeout(2000);
      if (s.setup) await s.setup(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await page.screenshot({ path: path.join(OUT, `${s.name}.png`), fullPage: true });
      report.push(`${s.name}\thorizontal overflow ${overflow}px${errs.length ? `\tpage errors: ${errs.join(" | ")}` : ""}`);
    } catch (e) { report.push(`${s.name}\tFAILED ${String(e).split("\n")[0].slice(0, 120)}`); }
    await ctx.close();
  }
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(OUT, "qa-report.tsv"), report.join("\n") + "\n");
  console.log(report.join("\n"));
};
main().catch((e) => { console.error(e); process.exit(1); });
