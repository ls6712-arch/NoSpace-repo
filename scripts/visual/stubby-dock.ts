// Screenshots of the Stubby dock, from the fixture person in the fixture Supabase. The asks count, the two
// "Found for you" picks and the scout itself are answered here; no database or function is touched.
//
//   node scripts/visual/stubby-dock.ts --out docs/qa/stubby-dock [--dist <built dir>] [--widths 390,1280] [--themes light,dark]
//
// Per width and theme it saves, and FAILS (exit 1) when what the name claims is not on screen:
//   home-dock          Home with Stubby in the corner, clear of the tab bar and its Log a Moment button
//   home-nudge         Home after 4 seconds with "Free tonight? Ask Stubby." (from 744px; a phone never shows it)
//   panel-picks        the panel open: quick ideas and 2 found picks; a phone's sheet covers the dock
//   panel-zero         the panel at 0 asks left: no quick ideas
//   calendar           Calendar with exactly one Stubby (the dock's) and no Ask Stubby box
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { buildFixtures } from "./fixtures.ts";
import { FIXTURE_ANON_KEY, FIXTURE_ORIGIN, installSupabaseMock, seededSession } from "./mock-supabase.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const args = process.argv.slice(2);
const opt = (n: string, d?: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt("out", "docs/qa/stubby-dock")!);
const WIDTHS = opt("widths", "390,1280")!.split(",").map(Number);
const THEMES = opt("themes", "light,dark")!.split(",") as ("light" | "dark")[];
const HEIGHT: Record<number, number> = { 390: 844, 1280: 860 };
const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".html": "text/html" };

function build(dist: string) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY } });
  if (r.status !== 0) throw new Error("build failed");
}

const day = 86_400_000;
const PICKS = [
  { id: 1, title: "Wheel night at a Greenpoint studio", place: "Greenpoint, Brooklyn", starts_at: new Date(Date.now() + day).toISOString(), ends_at: null, price: "$35", url: "https://example.com/wheel", note: null },
  { id: 2, title: "Free sunset run along the Hudson", place: "Hudson River Park", starts_at: new Date(Date.now() + 2 * day).toISOString(), ends_at: null, price: "Free", url: "https://example.com/run", note: "Price not listed" },
];

/** The asks used in the last 24 hours (3 a day), the picks, and the scout. Registered after the fixture mock, so these win. */
async function stubbyRoutes(ctx: BrowserContext, state: { used: number }) {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${FIXTURE_ORIGIN}/rest/v1/stubby_asks**`, (route) =>
    route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json", "content-range": `*/${state.used}` }, body: "[]" }),
  );
  await ctx.route(`${FIXTURE_ORIGIN}/rest/v1/personal_picks**`, (route) =>
    route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(PICKS) }),
  );
  await ctx.route(`${FIXTURE_ORIGIN}/functions/v1/**`, (route) =>
    route.request().method() === "OPTIONS"
      ? route.fulfill({ status: 200, headers: cors })
      : route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({ picks: PICKS, asksLeft: 3 - state.used }) }),
  );
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function main() {
  const dist = path.resolve(opt("dist", "") || path.join(ROOT, "dist-stubby-dock"));
  if (!opt("dist")) build(dist);
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((q, res) => { const u = (q.url ?? "/").split("?")[0]; let f = path.join(dist, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html"); res.setHeader("content-type", MIME[path.extname(f)] ?? "text/html"); res.end(fs.readFileSync(f)); });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  const notes: string[] = [];
  try {
    for (const th of THEMES) for (const w of WIDTHS) {
      const phone = w < 744;
      const state = { used: 1 };
      const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHT[w] ?? 900 }, hasTouch: phone, isMobile: phone, colorScheme: th, reducedMotion: "reduce", timezoneId: "America/New_York" });
      await installSupabaseMock(ctx, buildFixtures(new Date(), { calendarQa: true }), path.join(HERE, "database.types.ts"));
      await stubbyRoutes(ctx, state);
      await ctx.addInitScript(([t, se]) => {
        if (location.protocol !== "http:") return;
        localStorage.setItem("soosh-theme-preference", t as string);
        localStorage.setItem("sb-fixture-auth-token", JSON.stringify(se));
        sessionStorage.setItem("soosh.stubbyDock.hello", "1");
      }, [th, seededSession()] as const);
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      const shot = async (name: string, p: Page = page) => {
        const file = `${name}-${w}-${th}.png`;
        await p.waitForTimeout(400);
        await p.screenshot({ path: path.join(OUT, file) });
        notes.push(`- ${file}`);
      };
      const dock = () => page.locator("[data-stubby-dock]");
      const open = async () => {
        await page.getByRole("button", { name: "Ask Stubby", expanded: false }).click();
        await page.getByRole("dialog", { name: "Something different?" }).waitFor({ timeout: 10000 });
      };
      const close = async () => {
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5000 });
      };

      // 1. Home with the dock, clear of the tab bar and Log a Moment (no nudge yet: it is shown today already).
      await page.addInitScript(() => location.protocol === "http:" && localStorage.setItem("soosh.stubbyNudge.lastShown", new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())));
      await page.goto(`http://localhost:${port}/#/my-space`);
      await dock().waitFor({ timeout: 15000 });
      const dockBox = (await dock().getByRole("button", { name: "Ask Stubby" }).boundingBox())!;
      if (dockBox.width < 44 || dockBox.height < 44) throw new Error(`the dock is under 44px (${dockBox.width}x${dockBox.height})`);
      const bar = page.getByRole("navigation", { name: "Main" });
      if (await bar.isVisible()) {
        const barBox = (await bar.boundingBox())!;
        if (overlaps(dockBox, barBox)) throw new Error("the dock covers the tab bar");
        const log = (await bar.getByRole("link", { name: "Log a Moment" }).boundingBox())!;
        if (overlaps(dockBox, log)) throw new Error("the dock covers Log a Moment");
      }
      await shot("home-dock");

      // 2. The nudge: once a day, from 744px wide. A fresh page with no day recorded.
      // Park the first page, or its own 4 second timer would record today first (the once-a-day rule at work).
      await page.goto("about:blank");
      const fresh = await ctx.newPage();
      await fresh.addInitScript(() => localStorage.removeItem("soosh.stubbyNudge.lastShown"));
      await fresh.goto(`http://localhost:${port}/#/my-space`);
      await fresh.locator("[data-stubby-dock]").waitFor({ timeout: 15000 });
      await fresh.waitForTimeout(4600);
      const nudge = fresh.getByRole("button", { name: "Free tonight? Ask Stubby." });
      if (phone) {
        if (await nudge.count()) throw new Error("the nudge showed on a phone");
      } else {
        await nudge.waitFor({ timeout: 3000 });
        await shot("home-nudge", fresh);
      }
      await fresh.close();
      await page.goto(`http://localhost:${port}/#/my-space`);
      await dock().waitFor({ timeout: 15000 });

      // 3. The panel: quick ideas, 2 found picks; a phone's sheet covers the dock.
      await open();
      await page.getByRole("group", { name: "Quick ideas" }).waitFor({ timeout: 10000 });
      if ((await page.getByText("Found for you").count()) < 2) throw new Error("the 2 found picks are not in the panel");
      if (phone) {
        const top = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest("[data-stubby-dock]"), [dockBox.x + dockBox.width / 2, dockBox.y + dockBox.height / 2]);
        if (top) throw new Error("the dock sits above the open sheet");
      }
      await shot("panel-picks");
      await close();

      // 4. The panel at 0 asks left: no quick ideas.
      state.used = 3;
      await page.reload();
      await dock().waitFor({ timeout: 15000 });
      await open();
      await page.getByText("That’s your 3 for today. Stubby can look again tomorrow.").waitFor({ timeout: 10000 });
      if (await page.getByRole("group", { name: "Quick ideas" }).count()) throw new Error("quick ideas shown at 0 asks left");
      await shot("panel-zero");
      await close();
      state.used = 1;

      // 5. Calendar: one Stubby, and no Ask Stubby box under the calendar.
      await page.goto(`http://localhost:${port}/#/calendar?view=week`);
      await page.waitForSelector("main h1", { timeout: 15000 });
      await dock().waitFor({ timeout: 15000 });
      const stubbys = await page.locator("[data-stubby-state]").count();
      if (stubbys !== 1) throw new Error(`Calendar shows ${stubbys} Stubbys`);
      if (await page.locator("main").getByText("Something different?").count()) throw new Error("Calendar still has its own Ask Stubby box");
      await shot("calendar");

      if (errors.length) throw new Error(`page errors: ${errors.join("; ")}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(OUT, "README.md"), `# Stubby dock, QA screenshots\n\nMade by \`scripts/visual/stubby-dock.ts\` from the fixture person in the visual harness (no database). Reduced motion is on, so Stubby shows his resting faces. The nudge is never shown below 744px, so there is no phone nudge shot.\n\n${notes.join("\n")}\n`);
  console.log(notes.join("\n"));
}
main().catch((e) => { console.error(e); process.exit(1); });
