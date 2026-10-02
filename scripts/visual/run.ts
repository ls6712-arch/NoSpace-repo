// Visual regression runner. Builds the app against a fixture Supabase origin,
// intercepts every Supabase request with typed fixtures, and visits each
// screen at each width and theme: screenshots, plus layout detection
// (clipped / off-screen / wrapped-more text, page-level horizontal scroll).
//
//   node scripts/visual/run.ts                         build + run everything
//   node scripts/visual/run.ts --dist dist-fixture     reuse a build
//   node scripts/visual/run.ts --baseline <dist>       also diff against another build
//   node scripts/visual/run.ts --screens space-table,pursuit --widths 375 --themes dark
//   node scripts/visual/run.ts --selftest              prove the detector flags +45% type
//
// Needs a Chromium: set PLAYWRIGHT_CHROMIUM or rely on PLAYWRIGHT_BROWSERS_PATH.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright-core";
import { buildFixtures } from "./fixtures.ts";
import { cacheFonts } from "./fonts.ts";
import { detectInPage, diffDetections, INFLATE_CSS, type Detection } from "./detect.ts";
import { FIXTURE_ANON_KEY, FIXTURE_ORIGIN, installSupabaseMock, seededSession } from "./mock-supabase.ts";
import { SCREENS, type Screen } from "./screens.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const TYPES = path.join(HERE, "database.types.ts");
const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".html": "text/html" };
const HEIGHTS: Record<number, number> = { 375: 812, 768: 1024, 1440: 900 };

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string, d?: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const list = (n: string, d: string) => opt(n, d)!.split(",").map((s) => s.trim()).filter(Boolean);

function buildApp(outDir: string): string {
  console.log(`building the app against ${FIXTURE_ORIGIN} → ${outDir}`);
  const r = spawnSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY } });
  if (r.status !== 0) throw new Error("build failed");
  return outDir;
}

function serve(dist: string, fontsDir: string | undefined): Promise<{ port: number; close: () => void }> {
  const server = http.createServer((q, res) => {
    const u = (q.url ?? "/").split("?")[0]; res.setHeader("access-control-allow-origin", "*");
    let f = u.startsWith("/__fonts/") && fontsDir ? path.join(fontsDir, path.basename(u)) : path.join(dist, u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html");
    res.setHeader("content-type", MIME[path.extname(f)] ?? "text/html"); res.end(fs.readFileSync(f));
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ port: (server.address() as { port: number }).port, close: () => server.close() })));
}

interface RunOpts { dist: string; fontsDir?: string; screens: Screen[]; widths: number[]; themes: string[]; outDir?: string; inflate?: boolean }
type Results = Map<string, Detection>;
const keyFor = (theme: string, w: number, name: string) => `${theme}/${w}/${name}`;

async function runPass(browser: Browser, o: RunOpts): Promise<{ results: Results; unserved: string[]; unhandledRpc: string[]; notes: string[] }> {
  const srv = await serve(o.dist, o.fontsDir);
  const fontsCss = o.fontsDir && fs.existsSync(path.join(o.fontsDir, "fonts.css")) ? fs.readFileSync(path.join(o.fontsDir, "fonts.css"), "utf8").replaceAll("/__fonts/", `http://localhost:${srv.port}/__fonts/`) : undefined;
  const results: Results = new Map(); const unserved = new Set<string>(); const unhandled = new Set<string>(); const notes: string[] = [];
  for (const theme of o.themes) for (const w of o.widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHTS[w] ?? 900 }, colorScheme: theme as "light" | "dark", reducedMotion: "reduce", deviceScaleFactor: 1 });
    const report = await installSupabaseMock(ctx, buildFixtures(), TYPES);
    if (fontsCss) await ctx.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ status: 200, contentType: "text/css", body: fontsCss }));
    await ctx.addInitScript(([session, t]) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", t as string); } catch { /* storage blocked */ } }, [seededSession(), theme] as const);
    const page: Page = await ctx.newPage(); const errs: string[] = []; page.on("pageerror", (e) => errs.push(String(e).slice(0, 100)));
    for (const s of o.screens) {
      if (s.widths && !s.widths.includes(w)) continue;
      const tag = keyFor(theme, w, s.name);
      try {
        await page.goto(`http://localhost:${srv.port}/#${s.route}`); await page.waitForTimeout(1600);
        await page.evaluate(() => document.fonts.ready);
        if (s.setup) await s.setup(page);
        if (o.inflate) { await page.addStyleTag({ content: INFLATE_CSS }); await page.waitForTimeout(250); }
        const d = await page.evaluate(detectInPage); results.set(tag, d);
        if (o.outDir) { const dir = path.join(o.outDir, theme, String(w)); fs.mkdirSync(dir, { recursive: true }); await page.screenshot({ path: path.join(dir, `${s.name}.png`), fullPage: !s.setup }); }
      } catch (e) { notes.push(`${tag}: ${String(e).split("\n")[0].slice(0, 110)}`); }
    }
    if (errs.length) notes.push(`${theme}/${w}: page errors: ${[...new Set(errs)].slice(0, 3).join(" | ")}`);
    report.unservedTables.forEach((t) => unserved.add(t)); report.unhandledRpc.forEach((r) => unhandled.add(r));
    await ctx.close();
  }
  srv.close();
  return { results, unserved: [...unserved], unhandledRpc: [...unhandled], notes };
}

const total = (r: Results) => [...r.values()].reduce((n, d) => n + d.flags.length, 0);

async function main() {
  const fontsDir = opt("fonts") ? path.resolve(opt("fonts")!) : undefined;
  if (fontsDir && !fs.existsSync(path.join(fontsDir, "fonts.css"))) { console.log(`caching webfonts into ${fontsDir}`); cacheFonts(fontsDir, path.join(ROOT, "src/styles/fonts.css")); }
  const dist = path.resolve(opt("dist") ?? buildApp(fs.mkdtempSync(path.join(os.tmpdir(), "visual-dist-"))));
  const exe = process.env.PLAYWRIGHT_CHROMIUM ?? (() => { try { return execFileSync("bash", ["-lc", "ls -d ${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}/chromium-*/chrome-linux/chrome | head -1"], { encoding: "utf8" }).trim(); } catch { return undefined; } })();
  const browser = await chromium.launch({ executablePath: exe || undefined });
  const picked = list("screens", "all"); const screens = picked[0] === "all" ? SCREENS : SCREENS.filter((s) => picked.includes(s.name));
  const base: RunOpts = { dist, fontsDir, screens, widths: list("widths", "375,768,1440").map(Number), themes: list("themes", "light,dark"), outDir: opt("out") ? path.resolve(opt("out")!) : undefined };

  if (flag("selftest")) {
    const probe: RunOpts = { ...base, screens: SCREENS.filter((s) => ["my-space", "discover", "space-table"].includes(s.name)), widths: [375], themes: ["light"], outDir: undefined };
    const normal = await runPass(browser, probe); const inflated = await runPass(browser, { ...probe, inflate: true });
    const hs = (r: Results) => Math.max(0, ...[...r.values()].map((d) => d.hscroll));
    const ok = total(inflated.results) >= total(normal.results) + 5 && hs(inflated.results) > hs(normal.results);
    console.log(`selftest: normal ${total(normal.results)} flags / ${hs(normal.results)}px hscroll → +45% type ${total(inflated.results)} flags / ${hs(inflated.results)}px hscroll`);
    console.log(ok ? "selftest PASS: the detector sees inflated type" : "selftest FAIL: the detector did not react to +45% type");
    await browser.close(); process.exit(ok ? 0 : 1);
  }

  const after = await runPass(browser, base);
  const before = opt("baseline") ? await runPass(browser, { ...base, dist: path.resolve(opt("baseline")!), outDir: undefined }) : undefined;
  console.log(`\nscreens×widths×themes visited: ${after.results.size}   flagged elements: ${total(after.results)}   page-level horizontal scroll: ${[...after.results].filter(([, d]) => d.hscroll > 0).map(([k, d]) => `${k} (${d.hscroll}px)`).join(", ") || "none"}`);
  let newCount = 0; const untitled = new Map<string, number>(); const report: Record<string, unknown> = {};
  for (const [k, d] of after.results) {
    const diff = diffDetections(before?.results.get(k), d);
    if (before) { newCount += diff.newFlags.length; for (const f of diff.newFlags) console.log(`  NEW  ${k}  ${f.kind} ${f.axis} ${f.sel} "${f.text}"`); for (const w of diff.wrappedMore) console.log(`  WRAP ${k}  ${w.key.slice(0, 70)}  ${w.before}→${w.after} lines  ${w.fsBefore}→${w.fsAfter}px`); }
    for (const f of diff.untitledClips) untitled.set(`${f.sel.split(".")[0]} "${f.text}"`, (untitled.get(`${f.sel.split(".")[0]} "${f.text}"`) ?? 0) + 1);
    report[k] = { flags: d.flags, ...(before ? { diff } : {}) };
  }
  if (before) console.log(`new flags vs baseline: ${newCount}`);
  console.log(`clipped text without a title/aria-label (distinct): ${untitled.size}`); for (const [k, n] of untitled) console.log(`  ${k}  (${n} views)`);
  if (after.unserved.length) console.log(`fixture tables requested but not provided: ${after.unserved.join(", ")}`);
  if (after.unhandledRpc.length) console.log(`RPCs answered with a default: ${after.unhandledRpc.join(", ")}`);
  for (const n of after.notes) console.log(`note: ${n}`);
  if (base.outDir) { fs.mkdirSync(base.outDir, { recursive: true }); fs.writeFileSync(path.join(base.outDir, "report.json"), JSON.stringify(report, null, 1)); console.log(`screenshots + report.json → ${base.outDir}`); }
  await browser.close();
  process.exit(flag("strict") && (newCount > 0 || [...after.results.values()].some((d) => d.hscroll > 0)) ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
