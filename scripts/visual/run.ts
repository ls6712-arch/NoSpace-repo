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
//   node scripts/visual/run.ts --carousel             the multi-photo carousel: announced, keyboard, mouse arrows, dots
//   node scripts/visual/run.ts --art --out <dir>      crops every illustration in dark and light and reports its luminance (glow)
//   node scripts/visual/run.ts --images               image boxes keep their size when photos arrive, below-fold images are lazy, broken photos fall back
//   node scripts/visual/run.ts --fixed                header / Pursuits bar / bottom tab bar: no overlap, no covered content, with and without safe-area insets (notch 47px / home indicator 34px, on phones tall enough to have them)
//   node scripts/visual/run.ts --profiles [--chromium-standin] [--only SE,iPad]  the six device profiles (WebKit for iOS, Chromium for the rest) x light/dark: layout + contrast + touch
//   node scripts/visual/run.ts --contrast             WCAG contrast of every text/background pair (4.5:1, 3:1 large), light + dark; --strict fails on any
//   node scripts/visual/run.ts --touch                 touch-target audit: 44x44px hit areas, and overlaps
//
// Needs a Chromium: set PLAYWRIGHT_CHROMIUM or rely on PLAYWRIGHT_BROWSERS_PATH.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit, type Browser, type BrowserType, type Page } from "playwright-core";
import { buildFixtures } from "./fixtures.ts";
import { cacheFonts } from "./fonts.ts";
import { detectInPage, diffDetections, INFLATE_CSS, type Detection } from "./detect.ts";
import { touchAuditInPage, type TouchResult } from "./touch.ts";
import { contrastInPage, type ContrastResult } from "./contrast.ts";
import { iosChecksInPage, type IosResult } from "./ios.ts";
import { fixedBarsInPage, type FixedBarsResult } from "./fixedbars.ts";
import { imagesInPage, clsObserverInit, type ImgSnapshot } from "./images.ts";
import { FIXTURE_ANON_KEY, FIXTURE_ORIGIN, installSupabaseMock, seededSession } from "./mock-supabase.ts";
import { SCREENS, type Screen } from "./screens.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const TYPES = path.join(HERE, "database.types.ts");
const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".html": "text/html" };
const HEIGHTS: Record<number, number> = { 375: 812, 768: 1024, 1440: 900 };
// --profiles: the device sizes the design has to hold on. iOS devices run in WebKit, the rest in Chromium.
// Viewports are CSS pixels, portrait; the two iPads are 768 (iPad / mini) and 834 (iPad Pro 11").
const PROFILES = [
  { name: "iPhone SE", w: 375, h: 667, engine: "webkit", touch: true },
  { name: "iPhone 15", w: 393, h: 852, engine: "webkit", touch: true },
  { name: "Android (Pixel-class)", w: 412, h: 915, engine: "chromium", touch: true },
  { name: "iPad", w: 768, h: 1024, engine: "webkit", touch: true },
  { name: "iPad Pro 11in", w: 834, h: 1194, engine: "webkit", touch: true },
  { name: "Desktop", w: 1440, h: 900, engine: "chromium", touch: false },
] as const;

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
        await page.goto("about:blank"); await page.goto(`http://localhost:${srv.port}/#${s.route}`); await page.waitForTimeout(1600);
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

async function touchPass(browser: Browser, o: RunOpts): Promise<Map<string, TouchResult>> {
  const srv = await serve(o.dist, o.fontsDir); const out = new Map<string, TouchResult>();
  const W = o.widths[0] ?? 375, H0 = HEIGHTS[W] ?? 812;
  for (const theme of o.themes) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H0 }, hasTouch: true, isMobile: true, colorScheme: theme as "light" | "dark", reducedMotion: "reduce", deviceScaleFactor: 1 });
    await installSupabaseMock(ctx, buildFixtures(), TYPES);
    await ctx.addInitScript(([session, t]) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", t as string); } catch { /* storage blocked */ } }, [seededSession(), theme] as const);
    const page = await ctx.newPage();
    for (const s of o.screens) {
      try {
        await page.setViewportSize({ width: W, height: H0 });
        await page.goto("about:blank"); await page.goto(`http://localhost:${srv.port}/#${s.route}`); await page.waitForTimeout(1500); if (s.setup) await s.setup(page);
        const h = await page.evaluate(() => Math.min(document.documentElement.scrollHeight, 20000)); await page.setViewportSize({ width: W, height: Math.max(H0, h) }); await page.waitForTimeout(300);
        out.set(`${theme}/${W}/${s.name}`, await page.evaluate(touchAuditInPage, 44));
      } catch (e) { console.log(`note: touch ${theme}/${s.name}: ${String(e).split("\n")[0].slice(0, 100)}`); }
    }
    await ctx.close();
  }
  srv.close(); return out;
}

async function contrastPass(browser: Browser, o: RunOpts): Promise<Map<string, ContrastResult>> {
  const srv = await serve(o.dist, o.fontsDir); const out = new Map<string, ContrastResult>();
  for (const theme of o.themes) for (const w of o.widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHTS[w] ?? 900 }, colorScheme: theme as "light" | "dark", reducedMotion: "reduce", deviceScaleFactor: 1 });
    await installSupabaseMock(ctx, buildFixtures(), TYPES);
    await ctx.addInitScript(([session, t]) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", t as string); } catch { /* storage blocked */ } }, [seededSession(), theme] as const);
    const page = await ctx.newPage();
    for (const s of o.screens) {
      if (s.widths && !s.widths.includes(w)) continue;
      try { await page.goto("about:blank"); await page.goto(`http://localhost:${srv.port}/#${s.route}`); await page.waitForTimeout(1500); if (s.setup) await s.setup(page); out.set(`${theme}/${w}/${s.name}`, await page.evaluate(contrastInPage)); }
      catch (e) { console.log(`note: contrast ${theme}/${w}/${s.name}: ${String(e).split("\n")[0].slice(0, 100)}`); }
    }
    await ctx.close();
  }
  srv.close(); return out;
}

async function iosPass(browser: Browser, o: RunOpts): Promise<Map<string, IosResult>> {
  const srv = await serve(o.dist, o.fontsDir); const out = new Map<string, IosResult>();
  const ctx = await browser.newContext({ viewport: { width: o.widths[0], height: HEIGHTS[o.widths[0]] ?? 900 }, hasTouch: true, colorScheme: "light", reducedMotion: "reduce", deviceScaleFactor: 1 });
  await installSupabaseMock(ctx, buildFixtures(), TYPES);
  await ctx.addInitScript((session) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); } catch { /* storage blocked */ } }, seededSession());
  const page = await ctx.newPage();
  for (const s of o.screens) {
    try { await page.goto("about:blank"); await page.goto(`http://localhost:${srv.port}/#${s.route}`); await page.waitForTimeout(1500); if (s.setup) await s.setup(page); out.set(`${o.widths[0]}/${s.name}`, await page.evaluate(iosChecksInPage)); }
    catch (e) { console.log(`note: ios ${o.widths[0]}/${s.name}: ${String(e).split("\n")[0].slice(0, 100)}`); }
  }
  await ctx.close(); srv.close(); return out;
}

async function fixedPass(browser: Browser, o: RunOpts): Promise<Map<string, FixedBarsResult>> {
  const srv = await serve(o.dist, o.fontsDir); const out = new Map<string, FixedBarsResult>(); const W = o.widths[0];
  const ctx = await browser.newContext({ viewport: { width: W, height: HEIGHTS[W] ?? 900 }, hasTouch: true, colorScheme: "light", reducedMotion: "reduce", deviceScaleFactor: 1 });
  await installSupabaseMock(ctx, buildFixtures(), TYPES);
  await ctx.addInitScript((session) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); } catch { /* storage blocked */ } }, seededSession());
  const page = await ctx.newPage();
  for (const s of o.screens) for (const insets of (HEIGHTS[W] ?? 900) >= 800 ? [{ top: 0, bottom: 0 }, { top: 47, bottom: 34 }] : [{ top: 0, bottom: 0 }]) for (const phase of ["top", "bottom"] as const) {
    try {
      await page.goto("about:blank"); await page.goto(`http://localhost:${srv.port}/#${s.route}`); await page.waitForTimeout(1300); if (s.setup) await s.setup(page);
      await page.evaluate((ph) => window.scrollTo(0, ph === "top" ? 0 : document.documentElement.scrollHeight), phase); await page.waitForTimeout(500);
      const key = `${W}/${s.name}/inset${insets.top}-${insets.bottom}/${phase}`;
      out.set(key, await page.evaluate(fixedBarsInPage, { ...insets, phase }));
      if (o.outDir && process.env.FIXED_SHOTS) { await page.evaluate(({ top, bottom }) => { document.documentElement.style.setProperty("--safe-top", top + "px"); document.documentElement.style.setProperty("--safe-bottom", bottom + "px"); }, insets); await page.waitForTimeout(400); fs.mkdirSync(o.outDir, { recursive: true }); await page.screenshot({ path: path.join(o.outDir, key.replaceAll("/", "_") + ".png") }); }
    } catch (e) { console.log(`note: fixed ${W}/${s.name}: ${String(e).split("\n")[0].slice(0, 100)}`); }
  }
  await ctx.close(); srv.close(); return out;
}

interface ImagesResult { screenSources?: { v: number; node: string }[]; screen: string; total: number; moved: { sel: string; before: string; after: string }[]; shiftAfterRelease: number; notLazyBelow: string[]; brokenGlyphs: string[]; imgCount: number }
async function imagesPass(browser: Browser, o: RunOpts): Promise<ImagesResult[]> {
  const srv = await serve(o.dist, o.fontsDir); const out: ImagesResult[] = []; const W = o.widths[0];
  for (const s of o.screens) {
    // 1) photos held back, then released: do image boxes keep their size, and does the page shift?
    let release!: () => void; const gate = new Promise<void>((r) => { release = r; });
    const ctx = await browser.newContext({ viewport: { width: W, height: HEIGHTS[W] ?? 900 }, hasTouch: true, colorScheme: "light", reducedMotion: "reduce", deviceScaleFactor: 1 });
    await installSupabaseMock(ctx, buildFixtures(), TYPES, { imageGate: gate });
    await ctx.addInitScript((session) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); } catch { /* storage blocked */ } }, seededSession());
    await ctx.addInitScript(clsObserverInit);
    const page = await ctx.newPage(); const res: ImagesResult = { screen: `${W}/${s.name}`, total: 0, moved: [], shiftAfterRelease: 0, notLazyBelow: [], brokenGlyphs: [], imgCount: 0 };
    try {
      await page.goto("about:blank"); await page.goto(`http://localhost:${srv.port}/#${s.route}`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(1800); if (s.setup) await s.setup(page);
      const before = await page.evaluate(imagesInPage, { tag: true }); const cls0 = before.shifts;
      release(); await page.waitForTimeout(1500);
      const settled = await page.evaluate(imagesInPage, { tag: false }); // before scrolling: scrolling collapses the Pursuits bar spacer, which is not an image
      // walk the page so lazy images below the fold load too
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < Math.min(h, 12000); y += 500) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(120); }
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800);
      const after: ImgSnapshot = await page.evaluate(imagesInPage, { tag: false });
      res.shiftAfterRelease = Math.round((settled.shifts - cls0) * 1000) / 1000; res.imgCount = after.imgs.length; res.screenSources = settled.sources.slice(before.sources.length);
      const prior = new Map(before.imgs.map((i) => [i.id, i]));
      for (const a of after.imgs) { const b = prior.get(a.id); if (!b) continue; if (Math.abs(a.h - b.h) > 1 || Math.abs(a.w - b.w) > 1) res.moved.push({ sel: a.sel, before: `${b.w}x${b.h}`, after: `${a.w}x${a.h}` }); if (a.below && !a.lazy) res.notLazyBelow.push(a.sel); }
      res.total = res.moved.length;
    } catch (e) { console.log(`note: images ${W}/${s.name}: ${String(e).split("\n")[0].slice(0, 100)}`); }
    await ctx.close();
    // 2) every photo 404s: no broken-image glyph may remain
    const ctx2 = await browser.newContext({ viewport: { width: W, height: HEIGHTS[W] ?? 900 }, colorScheme: "light", reducedMotion: "reduce", deviceScaleFactor: 1 });
    await installSupabaseMock(ctx2, buildFixtures(), TYPES, { brokenImages: true });
    await ctx2.addInitScript((session) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); } catch { /* storage blocked */ } }, seededSession());
    const p2 = await ctx2.newPage();
    try {
      await p2.goto("about:blank"); await p2.goto(`http://localhost:${srv.port}/#${s.route}`); await p2.waitForTimeout(1800); if (s.setup) await s.setup(p2);
      const h = await p2.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < Math.min(h, 12000); y += 500) { await p2.evaluate((yy) => window.scrollTo(0, yy), y); await p2.waitForTimeout(120); }
      await p2.waitForTimeout(800);
      res.brokenGlyphs = (await p2.evaluate(imagesInPage, { tag: false })).imgs.filter((i) => i.broken).map((i) => i.sel);
    } catch (e) { console.log(`note: images(broken) ${W}/${s.name}: ${String(e).split("\n")[0].slice(0, 100)}`); }
    await ctx2.close(); out.push(res);
  }
  srv.close(); return out;
}

/** Crops of every large illustration (GeneratedArt, SubHobbyArt, WorldIllustration) in dark and light, photos all 404 so art fills the tiles. */
async function artPass(browser: Browser, o: RunOpts, outDir: string): Promise<string[]> {
  const srv = await serve(o.dist, o.fontsDir); const files: string[] = []; const W = o.widths[0];
  for (const theme of ["dark", "light"]) {
    const ctx = await browser.newContext({ viewport: { width: W, height: HEIGHTS[W] ?? 900 }, colorScheme: theme as "light" | "dark", reducedMotion: "reduce", deviceScaleFactor: 1 });
    await installSupabaseMock(ctx, buildFixtures(), TYPES, { brokenImages: true });
    await ctx.addInitScript(([session, th]) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", th as string); } catch { /* storage blocked */ } }, [seededSession(), theme] as const);
    const page = await ctx.newPage();
    for (const s of o.screens) {
      try {
        await page.goto("about:blank"); await page.goto(`http://localhost:${srv.port}/#${s.route}`); await page.waitForTimeout(1500); if (s.setup) await s.setup(page);
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < Math.min(h, 6000); y += 600) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await page.waitForTimeout(80); }
        const handles = await page.locator("svg[viewBox], .ns-hero-worlds-art").elementHandles(); let n = 0;
        for (const hd of handles) {
          const box = await hd.boundingBox(); if (!box || box.width < 110 || box.height < 70 || n >= 6) continue;
          await hd.scrollIntoViewIfNeeded().catch(() => undefined); await page.waitForTimeout(60);
          const f = path.join(outDir, `${theme}_${W}_${s.name}_${n}.png`); fs.mkdirSync(outDir, { recursive: true });
          try { await hd.screenshot({ path: f }); files.push(f); n++; } catch { /* detached */ }
        }
      } catch (e) { console.log(`note: art ${theme}/${s.name}: ${String(e).split("\n")[0].slice(0, 90)}`); }
    }
    await ctx.close();
  }
  srv.close(); return files;
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

  if (flag("carousel")) {
    // A Moment with three photos: announced "Photo n of 3", moves with the arrow keys and the mouse arrows, dots follow.
    const srv = await serve(dist, fontsDir); const results: string[] = []; let bad = 0;
    for (const [label, pointer] of [["touch", true], ["mouse", false]] as const) {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: pointer, isMobile: pointer, reducedMotion: "reduce" });
      await installSupabaseMock(ctx, buildFixtures(), TYPES);
      await ctx.addInitScript((session) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); } catch { /* storage blocked */ } }, seededSession());
      const page = await ctx.newPage(); await page.goto(`http://localhost:${srv.port}/#/moment/91`); await page.waitForTimeout(2200);
      const read = () => page.locator('[role="status"]').filter({ hasText: /Photo \d of \d/ }).first().textContent();
      const ok = (name: string, pass: boolean, extra = "") => { results.push(`  ${pass ? "ok  " : "FAIL"} [${label}] ${name}${extra ? " (" + extra + ")" : ""}`); if (!pass) bad++; };
      try {
        ok("announces the current photo", (await read())?.trim() === "Photo 1 of 3", String(await read()));
        const track = page.locator('[aria-roledescription="carousel"] > div').first(); await track.focus(); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(700); await page.evaluate(() => (document.activeElement as HTMLElement)?.dispatchEvent(new Event("scroll")));
        const afterKey = await track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth));
        ok("arrow key scrolls to the next photo", afterKey >= 1, `slide index ${afterKey}`);
        await page.waitForTimeout(400); ok("status follows the scroll", /Photo [23] of 3/.test((await read()) ?? ""), String(await read()));
        const next = page.getByRole("button", { name: "Next photo" });
        const visible = await next.isVisible().catch(() => false);
        ok(pointer ? "mouse arrows are hidden on touch" : "mouse arrows are shown with a fine pointer", pointer ? !visible : visible);
        if (!pointer) { const before = await track.evaluate((el) => el.scrollLeft); await next.click(); await page.waitForTimeout(700); ok("Next photo button moves", (await track.evaluate((el) => el.scrollLeft)) > before); }
        const dots = await page.locator('[aria-roledescription="carousel"] [aria-hidden="true"].pointer-events-none.absolute.inset-x-0 > span').count();
        ok("three dots, none of them buttons", dots === 3 && (await page.locator('[aria-roledescription="carousel"] button[aria-label^="Photo "]').count()) === 0, `${dots} dots`);
        await page.screenshot({ path: path.join(os.tmpdir(), `carousel-${label}.png`) });
      } catch (e) { ok("ran", false, String(e).split("\n")[0].slice(0, 100)); }
      await ctx.close();
    }
    srv.close(); console.log(`carousel check: ${results.length} assertions, ${bad} failed`); for (const r of results) console.log(r);
    await browser.close(); process.exit(bad > 0 ? 1 : 0);
  }

  if (flag("art")) {
    const outDir = path.resolve(opt("out") ?? path.join(os.tmpdir(), "art-crops")); const files = await artPass(browser, { ...base, widths: [base.widths[0]] }, outDir);
    const lum = (f: string) => { try { return parseFloat(execFileSync("convert", [f, "-colorspace", "Gray", "-format", "%[fx:mean]", "info:"], { encoding: "utf8" })); } catch { return NaN; } };
    // Share of pixels at 70% grey or brighter: a big bright patch on a dark page is what reads as a glow.
    const bright = (f: string) => { try { return parseFloat(execFileSync("convert", [f, "-colorspace", "Gray", "-threshold", "70%", "-format", "%[fx:mean]", "info:"], { encoding: "utf8" })); } catch { return NaN; } };
    const rows = files.map((f) => ({ f: path.basename(f), mean: lum(f), max: bright(f) })).filter((r) => !Number.isNaN(r.mean));
    const by = (th: string) => rows.filter((r) => r.f.startsWith(th));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    console.log(`art audit @${base.widths[0]}: ${rows.length} illustrations; mean luminance dark ${avg(by("dark").map((r) => r.mean)).toFixed(3)} / light ${avg(by("light").map((r) => r.mean)).toFixed(3)} (0 = black, 1 = white; dark page ~0.01)`);
    const glow = by("dark").filter((r) => r.mean > 0.45 || r.max > 0.08); console.log(`  dark illustrations that glow (mean grey > 0.45, or > 8% of pixels at 70% grey+): ${glow.length}`);
    for (const r of [...by("dark")].sort((a, b) => b.max - a.max).slice(0, 6)) console.log(`  dark mean ${r.mean.toFixed(3)} bright ${(r.max * 100).toFixed(1)}%  ${r.f}`);
    await browser.close(); process.exit(flag("strict") && glow.length > 0 ? 1 : 0);
  }

  if (flag("images")) {
    const all: ImagesResult[] = [];
    for (const w of base.widths) { HEIGHTS[w] = PROFILES.find((p) => p.w === w)?.h ?? HEIGHTS[w] ?? 900; all.push(...await imagesPass(browser, { ...base, widths: [w] })); }
    let boxes = 0, shiftSum = 0, glyphs = 0, nl = 0, imgs = 0; const movedBy = new Map<string, string>();
    for (const r of all) { imgs += r.imgCount; boxes += r.total; shiftSum += r.shiftAfterRelease; glyphs += r.brokenGlyphs.length; nl += r.notLazyBelow.length; for (const m of r.moved) movedBy.set(m.sel, `${m.before} -> ${m.after}  [${r.screen}]`); }
    console.log(`image audit: ${all.length} views, ${imgs} <img>/<video> seen; boxes that resized when the photo arrived: ${boxes} (${movedBy.size} distinct); layout shift after the photos arrive (sum of per-view scores): ${shiftSum.toFixed(3)}, worst view ${Math.max(0, ...all.map((r) => r.shiftAfterRelease)).toFixed(3)}; below-the-fold images not lazy: ${nl}; broken-image glyphs with every photo 404: ${glyphs}`);
    for (const [sel, d] of [...movedBy].slice(0, 30)) console.log(`  RESIZED ${sel}  ${d}`);
    for (const r of all) if (r.brokenGlyphs.length) console.log(`  BROKEN  ${r.screen}: ${[...new Set(r.brokenGlyphs)].slice(0, 4).join(", ")}`);
    for (const r of all.filter((x) => x.shiftAfterRelease > 0.02)) { const top = new Map<string, number>(); for (const s of r.screenSources ?? []) top.set(s.node, Math.max(top.get(s.node) ?? 0, s.v)); console.log(`  SHIFT   ${r.screen}  ${r.shiftAfterRelease}  moved: ${[...top].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, v]) => `${n} (${v.toFixed(3)})`).join(" | ")}`); }
    await browser.close(); process.exit(flag("strict") && (boxes > 0 || glyphs > 0 || nl > 0) ? 1 : 0);
  }

  if (flag("fixed")) {
    const rows = new Map<string, string[]>(); const warns = new Map<string, string[]>(); let n = 0;
    for (const w of base.widths) { HEIGHTS[w] = PROFILES.find((p) => p.w === w)?.h ?? HEIGHTS[w] ?? 900; const res = await fixedPass(browser, { ...base, widths: [w] }); n += res.size; for (const [k, r] of res) { for (const wn of r.warnings) { const kk = `${k.split("/")[0]}/${k.split("/")[1]}: ${wn}`; warns.set(kk, [...(warns.get(kk) ?? []), k.split("/").slice(2).join("/")]); } } for (const [k, r] of res) for (const pr of r.problems) rows.set(`${k.split("/")[0]}/${k.split("/")[1]}: ${pr}`, [...(rows.get(`${k.split("/")[0]}/${k.split("/")[1]}: ${pr}`) ?? []), k.split("/").slice(2).join("/")]); }
    console.log(`fixed chrome audit: ${n} states (screens x widths x safe-area insets x scroll top/bottom); ${rows.size} distinct problem(s)`);
    for (const [k, w] of rows) console.log(`  PROBLEM ${k}  [${w.slice(0, 4).join(", ")}${w.length > 4 ? ` +${w.length - 4}` : ""}]`);
    for (const [k, w] of warns) console.log(`  WARN    ${k}  [${w.slice(0, 4).join(", ")}${w.length > 4 ? ` +${w.length - 4}` : ""}]`);
    await browser.close(); process.exit(flag("strict") && rows.size > 0 ? 1 : 0);
  }

  if (flag("profiles")) {
    // Every device profile, every theme: layout detection, contrast, and (touch devices) the 44px audit.
    // An engine that isn't installed is reported as SKIPPED, never silently run in another engine.
    const launchers: Record<string, BrowserType> = { chromium, webkit };
    const rows: string[] = []; let bad = 0, skipped = 0, standIn = false; const details: Record<string, unknown>[] = [];
    const want = opt("only");
    for (const p of PROFILES) {
      if (want && !want.split(",").some((n) => p.name.toLowerCase().includes(n.trim().toLowerCase()))) continue;
      let b: Browser; let label: string = p.engine;
      try { b = await launchers[p.engine].launch(p.engine === "chromium" ? { executablePath: exe || undefined } : {}); }
      catch (e) {
        if (flag("chromium-standin") && p.engine === "webkit") { b = await chromium.launch({ executablePath: exe || undefined }); label = "chromium*"; standIn = true; }
        else { skipped++; rows.push(`${p.name.padEnd(22)} ${String(p.w).padStart(4)}x${String(p.h).padEnd(5)} ${p.engine.padEnd(8)} SKIPPED: ${p.engine} not installed here (${String(e).split("\n")[0].slice(0, 70)})`); continue; }
      }
      HEIGHTS[p.w] = p.h;
      const o: RunOpts = { ...base, widths: [p.w] };
      const lay = await runPass(b, o); const con = await contrastPass(b, o); const tch = p.touch ? await touchPass(b, o) : undefined;
      const ios = p.engine === "webkit" ? await iosPass(b, o) : undefined;
      const fx = p.w < 768 ? await fixedPass(b, o) : undefined; const fxProblems = fx ? new Set([...fx].flatMap(([, r]) => r.problems)).size : -1; const fxWarn = fx ? new Set([...fx].flatMap(([, r]) => r.warnings)).size : 0;
      const flags = total(lay.results), hs = [...lay.results].filter(([, d]) => d.hscroll > 0).length;
      const cf = new Set([...con].flatMap(([k, r]) => r.failures.map((f) => `${k.split("/")[0]}|${f.sel}|${f.text}|${f.fg}|${f.bg}`))).size;
      const small = tch ? new Set([...tch].flatMap(([, r]) => r.failing.filter((f) => f.reason === "small").map((f) => `${f.sel} ${f.text}`))).size : -1;
      const ov = tch ? new Set([...tch].flatMap(([, r]) => r.overlaps.map((x) => `${x.a}|${x.b}`))).size : -1;
      const smallInputs = ios ? new Set([...ios].flatMap(([, r]) => r.smallInputs.map((x) => `${x.sel} ${x.fontSize}px`))) : undefined;
      const safeBad = ios ? [...ios].filter(([, r]) => r.safe && (!r.safe.viewportFitCover || !r.safe.tokenIsEnv || r.safe.barFollowsToken === false)).length : 0;
      const safeSeen = ios ? [...ios].filter(([, r]) => r.safe?.barFollowsToken === true).length : 0;
      if (hs > 0 || cf > 0 || small > 0 || fxProblems > 0 || (smallInputs?.size ?? 0) > 0 || safeBad > 0 || (ios && safeSeen === 0)) bad++;
      details.push({ profile: p.name, engine: label, w: p.w, h: p.h, flags, hscroll: hs, contrastFailures: cf, touchSmall: small, overlaps: ov, smallInputs: smallInputs ? [...smallInputs] : null, safeAreaBadViews: ios ? safeBad : null, safeAreaBarViewsChecked: ios ? safeSeen : null, fixedChromeProblems: fxProblems < 0 ? null : fxProblems });
      rows.push(`${p.name.padEnd(22)} ${String(p.w).padStart(4)}x${String(p.h).padEnd(5)} ${label.padEnd(9)} views ${lay.results.size}  flagged ${flags}  hscroll ${hs}  contrast<4.5 ${cf}  touch<44 ${small < 0 ? "n/a" : small}  overlapping-pairs ${ov < 0 ? "n/a" : ov}${fxProblems >= 0 ? `  fixed-chrome ${fxProblems} (+${fxWarn} warn)` : ""}${ios ? `  input<16px ${smallInputs!.size}  safe-area ${safeBad === 0 && safeSeen > 0 ? "ok" : "FAIL"} (${safeSeen} views)` : ""}`);
      if (smallInputs?.size) for (const x of smallInputs) rows.push(`    input under 16px: ${x}`);
      await b.close();
    }
    console.log("\ndevice profiles (light + dark each):"); for (const r of rows) console.log("  " + r);
    if (standIn) console.log("  * chromium stand-in at the iOS viewport sizes: layout only; NOT a WebKit result (run on a Mac/CI with webkit installed)");
    if (base.outDir) { fs.mkdirSync(base.outDir, { recursive: true }); fs.writeFileSync(path.join(base.outDir, "report.json"), JSON.stringify({ profiles: details, skipped, standIn }, null, 1)); }
    await browser.close(); process.exit(flag("strict") && (bad > 0 || skipped > 0) ? 1 : 0);
  }

  if (flag("contrast")) {
    const res = await contrastPass(browser, base);
    let checked = 0; const fails = new Map<string, { f: ContrastResult["failures"][number]; where: Set<string> }>(); const media = new Map<string, number>();
    for (const [k, r] of res) { checked += r.checked; for (const f of r.failures) { const id = `${k.split("/")[0]}|${f.sel}|${f.text}|${f.fg}|${f.bg}`; const e = fails.get(id) ?? { f, where: new Set() }; e.where.add(k.split("/").slice(1).join("/")); fails.set(id, e); } for (const m of r.overMedia) media.set(m, (media.get(m) ?? 0) + 1); }
    console.log(`contrast audit: ${res.size} views, ${checked} text elements checked; ${fails.size} distinct pair(s) below 4.5:1 (3:1 for large text)`);
    for (const [id, { f, where }] of [...fails].sort((a, b) => a[1].f.ratio - b[1].f.ratio)) console.log(`  FAIL ${id.split("|")[0].padEnd(5)} ${f.ratio.toFixed(2)}:1 (need ${f.need}) ${f.fg} on ${f.bg} ${f.size}px  ${f.sel} "${f.text}"  [${[...where].slice(0, 3).join(", ")}${where.size > 3 ? ` +${where.size - 3}` : ""}]`);
    console.log(`text over photo/video, not judged by CSS (distinct): ${media.size}`); for (const [m, n] of [...media].slice(0, 25)) console.log(`  media ${m}  (${n} views)`);
    await browser.close(); process.exit(flag("strict") && fails.size > 0 ? 1 : 0);
  }

  if (flag("touch")) {
    const res = await touchPass(browser, { ...base, widths: [375] });
    const seen = new Map<string, { n: number; w: number; h: number; inline: boolean; reason: string; by?: string; bottom?: number }>(); let total = 0, fails = 0;
    const overlaps = new Map<string, number>();
    for (const [, r] of res) { total += r.total; fails += r.failing.length; for (const f of r.failing) { const k = `${f.sel} "${f.text}"`; const e = seen.get(k); seen.set(k, { n: (e?.n ?? 0) + 1, w: f.w, h: f.h, inline: f.inline, reason: f.reason, by: f.stolenBy, bottom: f.fromBottom }); } for (const o of r.overlaps) overlaps.set(`${o.a}  ⟷  ${o.b}`, Math.max(o.px, overlaps.get(`${o.a}  ⟷  ${o.b}`) ?? 0)); }
    const small = [...seen.values()].filter((e) => e.reason === "small").length;
    console.log(`touch audit @375 (hasTouch): interactive elements ${total}; no 44x44 hit area: ${small} distinct; corners shared with a neighbour: ${seen.size - small} distinct; overlapping 44px areas: ${overlaps.size} distinct pair(s)`);
    for (const [k, e] of [...seen].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${e.reason === "overlap" ? "SHARED" : "SMALL "} ${String(e.w).padStart(3)}x${String(e.h).padEnd(3)} ${e.inline ? "inline " : "       "} ${k}${e.by ? "  (hit lands on " + e.by + ")" : ""}  [${e.n} screen-runs${e.reason === "small" && e.bottom !== undefined ? `, ${e.bottom}px above page bottom` : ""}]`);
    for (const [k, px] of overlaps) console.log(`  OVERLAP ${px}px  ${k}`);
    await browser.close(); process.exit(flag("strict") && small > 0 ? 1 : 0);
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
