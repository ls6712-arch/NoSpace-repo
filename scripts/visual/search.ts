// Browser checks for the one search, against the fixture Supabase and a built app:
//
//   node scripts/visual/search.ts <built dir> <out dir>
//
// On Discover the search box sits directly under the title and is as wide as the content; tapping it opens /search with
// the cursor already in the box. Empty /search shows Busy this week and never says "Be the first". On desktop "/" opens
// the rail's Search from a page, is just a character while typing in a field, and focuses the box on /search.
// Writes 2x screenshots of Discover and empty Search at 390 and 1440px, light and dark. Exits 1 on any miss.
import fs from "node:fs"; import http from "node:http"; import path from "node:path"; import { fileURLToPath } from "node:url"; import { chromium } from "playwright-core";
import { buildFixtures } from "./fixtures.ts"; import { installSupabaseMock, seededSession } from "./mock-supabase.ts";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const a = process.argv.slice(2); const dist = a[0], out = a[1];
const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".woff2": "font/woff2", ".html": "text/html" };
const server = http.createServer((q, res) => { const u = (q.url ?? "/").split("?")[0]; let f = path.join(dist, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html"); res.setHeader("content-type", MIME[path.extname(f)] ?? "text/html"); res.end(fs.readFileSync(f)); });
await new Promise<void>((r) => server.listen(0, () => r())); const port = (server.address() as { port: number }).port;
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
fs.mkdirSync(out, { recursive: true });
const fails: string[] = [];
const ctxFor = async (w: number, h: number, th: "light" | "dark") => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 744, isMobile: w < 744, colorScheme: th, reducedMotion: "reduce", deviceScaleFactor: 2 });
  await installSupabaseMock(ctx, buildFixtures(), path.join(HERE, "database.types.ts"));
  await ctx.addInitScript(([t, se]) => { localStorage.setItem("soosh-theme-preference", t as string); localStorage.setItem("sb-fixture-auth-token", JSON.stringify(se)); }, [th, seededSession()] as const);
  return ctx;
};
const hide = (p: import("playwright-core").Page) => p.evaluate(() => document.querySelectorAll('[role="status"]').forEach((el) => { if (/not the live site/.test(el.textContent ?? "")) el.remove(); }));
for (const th of ["light", "dark"] as const) for (const [w, h] of [[390, 844], [1440, 900]] as const) {
  const ctx = await ctxFor(w, h, th);
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${port}/#/discover`); await p.waitForTimeout(2200); await hide(p);
  // The box is directly under the title and as wide as the content.
  const geo = await p.evaluate(() => {
    const h1 = document.querySelector("main h1")!.getBoundingClientRect();
    const box = document.querySelector('main input[type="search"]') as HTMLElement | null;
    const hdr = document.querySelector("main h1")!.closest("header")!.getBoundingClientRect();
    const r = box?.getBoundingClientRect();
    return { have: !!box, gap: r ? Math.round(r.top - hdr.bottom) : -1, left: Math.round(r?.left ?? -1), right: Math.round(r?.right ?? -1), hl: Math.round(hdr.left), hr: Math.round(document.querySelector("main h1")!.closest("header")!.firstElementChild!.getBoundingClientRect().right), h1: h1.top };
  });
  if (!geo.have) fails.push(`discover @${w}: no search box`); else if (Math.abs(geo.left - geo.hl) > 1 || Math.abs(geo.right - geo.hr) > 1) fails.push(`discover @${w}: box ${geo.left}-${geo.right} is not the content ${geo.hl}-${geo.hr}`);
  await p.screenshot({ path: path.join(out, `discover-${w}-${th}.png`) });
  if (th === "light") {
    await p.locator('main input[type="search"]').click();
    await p.waitForTimeout(800);
    const url = p.url().split("#")[1]; const focused = await p.evaluate(() => document.activeElement?.getAttribute("placeholder") ?? "none");
    if (url !== "/search") fails.push(`discover @${w}: tapping the box went to ${url}`);
    if (focused !== "Search Moments, people, Spaces") fails.push(`discover @${w}: after opening /search the focus is ${focused}`);
  }
  await p.goto(`http://localhost:${port}/#/search`); await p.waitForTimeout(2200); await hide(p);
  const txt = await p.evaluate(() => document.body.innerText);
  if (!txt.includes("Busy this week")) fails.push(`search @${w} ${th}: no Busy this week`);
  if (txt.includes("Be the first")) fails.push(`search @${w} ${th}: says Be the first`);
  await p.screenshot({ path: path.join(out, `search-empty-${w}-${th}.png`) });
  await ctx.close();
}
// "/" on desktop: opens the rail's Search from a page; not while typing; focuses the box on /search.
{
  const ctx = await ctxFor(1440, 900, "light");
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${port}/#/week`); await p.waitForTimeout(2200);
  await p.keyboard.press("/"); await p.waitForTimeout(500);
  const panel = await p.evaluate(() => document.activeElement?.getAttribute("placeholder") ?? "none");
  if (panel !== "Search Moments, people, Spaces") fails.push(`"/" on Week did not open the rail Search (focus: ${panel})`);
  await p.keyboard.press("Escape");
  await p.goto(`http://localhost:${port}/#/messages`); await p.waitForTimeout(2200);
  const field = p.getByPlaceholder(/Message /).first();
  if (await field.count()) { await field.click(); await p.keyboard.type("a/b"); const v = await field.inputValue(); if (v !== "a/b") fails.push(`typing "/" in a field gave "${v}"`); }
  await p.goto(`http://localhost:${port}/#/search`); await p.waitForTimeout(2200);
  await p.locator("body").click({ position: { x: 700, y: 600 } });
  await p.keyboard.press("/"); await p.waitForTimeout(300);
  const onPage = await p.evaluate(() => document.activeElement?.getAttribute("placeholder") ?? "none");
  if (onPage !== "Search Moments, people, Spaces") fails.push(`"/" on /search did not focus the box (${onPage})`);
  await ctx.close();
}
await b.close(); server.close();
console.log(fails.length ? fails.map((f) => "FAIL " + f).join("\n") : "all search checks pass");
process.exit(fails.length ? 1 : 0);
