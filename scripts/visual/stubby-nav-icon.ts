// Screenshots of the rail item for /calendar (named Stubby, with his mark as its icon), from the fixture person in the fixture Supabase.
//
//   node scripts/visual/stubby-nav-icon.ts --out docs/qa/stubby-nav-icon [--dist <built dir>] [--themes light,dark]
//
// At 1280px, per theme, it saves the page and a close-up of the rail, with Calendar inactive (Home)
// and active (Calendar). It FAILS (exit 1) when the item has no Stubby mark, the mark is
// not about 22px wide and level with the other rail icons, it is coral while inactive or not coral
// while active, it isn't decorative, or the label isn't "Stubby".
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
const OUT = path.resolve(ROOT, opt("out", "docs/qa/stubby-nav-icon")!);
const THEMES = opt("themes", "light,dark")!.split(",") as ("light" | "dark")[];
const W = 1280;
const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".html": "text/html" };

function build(dist: string) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY } });
  if (r.status !== 0) throw new Error("build failed");
}

async function main() {
  const dist = path.resolve(opt("dist", "") || path.join(ROOT, "dist-stubby-nav-icon"));
  if (!opt("dist")) build(dist);
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((q, res) => { const u = (q.url ?? "/").split("?")[0]; let f = path.join(dist, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html"); res.setHeader("content-type", MIME[path.extname(f)] ?? "text/html"); res.end(fs.readFileSync(f)); });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  const notes: string[] = [];
  try {
    for (const th of THEMES) {
      const ctx = await browser.newContext({ viewport: { width: W, height: 860 }, deviceScaleFactor: 2, colorScheme: th, reducedMotion: "reduce", timezoneId: "America/New_York" });
      await installSupabaseMock(ctx, buildFixtures(new Date(), { calendarQa: true }), path.join(HERE, "database.types.ts"));
      await ctx.addInitScript(([t, se]) => {
        if (location.protocol !== "http:") return;
        localStorage.setItem("soosh-theme-preference", t as string);
        localStorage.setItem("sb-fixture-auth-token", JSON.stringify(se));
        sessionStorage.setItem("soosh.stubby.hello", "1");
      }, [th, seededSession()] as const);
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      const rail = page.getByRole("navigation", { name: "Main" }).first();
      const calendar = rail.getByRole("link", { name: "Stubby", exact: true });

      for (const [state, route] of [["inactive", "/my-space"], ["active", "/calendar?view=week"]] as const) {
        await page.goto(`http://localhost:${port}/#${route}`);
        await page.waitForSelector("main h1", { timeout: 15000 });
        await calendar.waitFor({ timeout: 10000 });
        const icon = calendar.locator("[data-stubby-nav-icon]");
        if ((await icon.count()) !== 1) throw new Error(`${th} ${state}: the item has no Stubby mark`);
        if ((await icon.getAttribute("aria-hidden")) !== "true") throw new Error(`${th} ${state}: the mark is not decorative`);
        if (!(await calendar.getByText("Stubby", { exact: true }).first().isVisible())) throw new Error(`${th} ${state}: the label is gone`);
        const current = await calendar.getAttribute("aria-current");
        if ((current === "page") !== (state === "active")) throw new Error(`${th} ${state}: aria-current is ${current}`);
        const svg = (await icon.locator("svg").boundingBox())!;
        if (Math.abs(svg.width - 22) > 0.5) throw new Error(`${th} ${state}: the mark is ${svg.width}px wide`);
        // Level with the other rail icons: the same centre line as Home's.
        const home = (await rail.getByRole("link", { name: "Home", exact: true }).locator("svg").first().boundingBox())!;
        const homeRow = (await rail.getByRole("link", { name: "Home", exact: true }).boundingBox())!;
        const calRow = (await calendar.boundingBox())!;
        const offset = Math.abs(svg.y + svg.height / 2 - calRow.y - (home.y + home.height / 2 - homeRow.y));
        if (offset > 1) throw new Error(`${th} ${state}: the mark sits ${offset}px off the other icons' line`);
        if (Math.abs(calRow.height - homeRow.height) > 0.5) throw new Error(`${th} ${state}: the Stubby row is ${calRow.height}px, Home's ${homeRow.height}px`);
        const body = await icon.evaluate((el) => getComputedStyle(el.querySelector("path")!).fill);
        const coral = body !== "none" && !/rgba\(0, 0, 0, 0\)|transparent/.test(body);
        if (coral !== (state === "active")) throw new Error(`${th} ${state}: the body is ${body}`);
        await page.waitForTimeout(300);
        const file = `rail-${state}-${W}-${th}.png`;
        await page.screenshot({ path: path.join(OUT, file) });
        const close = `rail-${state}-closeup-${th}.png`;
        const box = (await rail.boundingBox())!;
        await page.screenshot({ path: path.join(OUT, close), clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 460) } });
        notes.push(`- ${file} (and ${close}): Stubby ${state}, body ${body}`);
      }
      if (errors.length) throw new Error(`page errors: ${errors.join("; ")}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(OUT, "README.md"), `# Stubby on the rail (the Calendar item), QA screenshots\n\nMade by \`scripts/visual/stubby-nav-icon.ts\` from the fixture person in the visual harness (no database), at 1280px (2x pixels, so the close-ups are sharp). The rail item for /calendar is named Stubby, with his mark as its icon. Inactive is Home (the mark is an outline in the rail's colour); active is Calendar (the full coral mark). Each page has a close-up of the rail.\n\n${notes.join("\n")}\n`);
  console.log(notes.join("\n"));
}
main().catch((e) => { console.error(e); process.exit(1); });
