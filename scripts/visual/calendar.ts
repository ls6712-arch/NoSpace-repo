// Screenshots and checks for the calendar (/calendar): Month, Week, Day and List at 390, 744 and 1440px,
// light and dark, against the fixture Supabase.
//
//   node scripts/visual/calendar.ts --out docs/qa/calendar/pr1 [--dist <built dir>] [--widths 390,744,1440] [--themes light,dark]
//
// FAILS (exit 1) when a view has sideways page scroll, more than one coral fill inside the page, or text under 12px.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { buildFixtures } from "./fixtures.ts";
import { FIXTURE_ANON_KEY, FIXTURE_ORIGIN, installSupabaseMock, seededSession } from "./mock-supabase.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const args = process.argv.slice(2);
const opt = (n: string, d?: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt("out", "docs/qa/calendar/pr1")!);
const WIDTHS = opt("widths", "390,744,1440")!.split(",").map(Number);
const THEMES = opt("themes", "light,dark")!.split(",") as ("light" | "dark")[];
const HEIGHT: Record<number, number> = { 390: 844, 744: 1024, 1440: 900 };
const VIEWS = ["month", "week", "day", "list"];
const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".html": "text/html" };

function build(dist: string) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY } });
  if (r.status !== 0) throw new Error("build failed");
}

/** Runs in the page. */
function measure() {
  const main = document.querySelector("main") ?? document.body;
  const coral = [...main.querySelectorAll<HTMLElement>("*")].filter((el) => {
    const bg = getComputedStyle(el).backgroundColor;
    return el.getBoundingClientRect().width > 40 && el.className.toString().includes("bg-accent") && !el.className.toString().includes("bg-accent/") && bg !== "rgba(0, 0, 0, 0)";
  }).length;
  const small = [...main.querySelectorAll<HTMLElement>("*")].filter((el) => {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? "").trim());
    return own && parseFloat(getComputedStyle(el).fontSize) < 12 && el.getBoundingClientRect().width > 0;
  }).map((el) => `${el.tagName}:${(el.textContent ?? "").trim().slice(0, 20)}`);
  return { sideways: document.documentElement.scrollWidth > window.innerWidth + 1, coral, small, title: document.querySelector("main h1")?.textContent ?? "" };
}

async function main() {
  const dist = path.resolve(opt("dist", "") || path.join(ROOT, "dist-calendar"));
  if (!opt("dist")) build(dist);
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((q, res) => { const u = (q.url ?? "/").split("?")[0]; let f = path.join(dist, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html"); res.setHeader("content-type", MIME[path.extname(f)] ?? "text/html"); res.end(fs.readFileSync(f)); });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  const fails: string[] = [];
  const lines = ["| view | width | theme | title | sideways | coral fills | text under 12px |", "|---|---|---|---|---|---|---|"];
  try {
    for (const th of THEMES) for (const w of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHT[w] ?? 900 }, hasTouch: w < 744, isMobile: w < 744, colorScheme: th, reducedMotion: "reduce" });
      await installSupabaseMock(ctx, buildFixtures(), path.join(HERE, "database.types.ts"));
      await ctx.addInitScript(([t, se]) => { localStorage.setItem("soosh-theme-preference", t as string); localStorage.setItem("sb-fixture-auth-token", JSON.stringify(se)); }, [th, seededSession()] as const);
      for (const view of VIEWS) {
        const p = await ctx.newPage();
        await p.goto(`http://localhost:${port}/#/calendar?view=${view}`);
        await p.waitForSelector("main h1", { timeout: 15000 });
        await p.waitForTimeout(1200);
        const m = await p.evaluate(measure);
        const name = `${view}-${w}-${th}`;
        await p.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
        lines.push(`| ${view} | ${w} | ${th} | ${m.title} | ${m.sideways ? "YES" : "no"} | ${m.coral} | ${m.small.length} |`);
        if (m.sideways) fails.push(`${name}: sideways page scroll`);
        if (m.coral > 1) fails.push(`${name}: ${m.coral} coral fills`);
        if (m.small.length) fails.push(`${name}: text under 12px: ${m.small.slice(0, 3).join(", ")}`);
        await p.close();
      }
      // The Make a plan sheet, and the time sheet from a tap on empty hours (a click on the grid from 744px, a tap on a day on a phone).
      const sheets = await ctx.newPage();
      await sheets.goto(`http://localhost:${port}/#/calendar?view=week`);
      await sheets.waitForSelector("main h1", { timeout: 15000 });
      await sheets.waitForTimeout(800);
      await sheets.getByRole("button", { name: "Make a plan", exact: true }).first().click();
      await sheets.waitForTimeout(800);
      const planShot = `make-a-plan-${w}-${th}`;
      await sheets.screenshot({ path: path.join(OUT, `${planShot}.png`) });
      lines.push(`| make a plan sheet | ${w} | ${th} | ${(await sheets.getByRole("dialog").first().textContent())?.slice(0, 24) ?? ""} | no | n/a | n/a |`);
      await sheets.keyboard.press("Escape");
      if (w >= 744) {
        await sheets.waitForTimeout(400);
        await sheets.locator(".cursor-cell").first().click({ position: { x: 20, y: 300 } });
        await sheets.waitForTimeout(800);
        await sheets.screenshot({ path: path.join(OUT, `time-sheet-${w}-${th}.png`) });
      }
      await sheets.close();
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(OUT, "measurements.md"), `${lines.join("\n")}\n\n${fails.length ? `FAILED\n\n${fails.map((f) => `- ${f}`).join("\n")}` : "All checks passed."}\n`);
  console.log(lines.join("\n"));
  if (fails.length) { console.error(fails.join("\n")); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
