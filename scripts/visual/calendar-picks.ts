// Screenshots of Stubby's picks (calendar PR 3), from the calendar QA person in the fixture Supabase:
// every window free, a Pottery pick near Gowanus on $50 a month, one block ("Dentist") tomorrow evening, four
// Pottery listings two days ahead, one over budget, and an open group that needs the host's approval.
// The fixture exists only in this harness (scripts/visual/fixtures.ts, calendarQa); no database has it.
//
//   node scripts/visual/calendar-picks.ts --out docs/qa/calendar/pr3 [--dist <built dir>] [--widths 390,1440] [--themes light,dark]
//
// Per width and theme it saves, in order, and FAILS (exit 1) when what the name claims is not on screen:
//   pick                       the first pick, with its label, time and Keep
//   not-this-swap              after Not this, the next match is in its place
//   third-not-this             after the 3rd Not this on the same stretch, plain free time and no pick
//   ask-to-join                the group that needs approval says Ask to join, not Keep
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import { buildFixtures } from "./fixtures.ts";
import { FIXTURE_ANON_KEY, FIXTURE_ORIGIN, installSupabaseMock, seededSession } from "./mock-supabase.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const args = process.argv.slice(2);
const opt = (n: string, d?: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt("out", "docs/qa/calendar/pr3")!);
const WIDTHS = opt("widths", "390,1440")!.split(",").map(Number);
const THEMES = opt("themes", "light,dark")!.split(",") as ("light" | "dark")[];
const HEIGHT: Record<number, number> = { 390: 844, 744: 1024, 1440: 900 };
const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".html": "text/html" };

function build(dist: string) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY } });
  if (r.status !== 0) throw new Error("build failed");
}

const pickButton = (page: Page, title: string) => page.getByRole("button", { name: new RegExp(`^Stubby’s pick, .*${title}`) });

async function main() {
  const dist = path.resolve(opt("dist", "") || path.join(ROOT, "dist-calendar-picks"));
  if (!opt("dist")) build(dist);
  fs.mkdirSync(OUT, { recursive: true });
  const server = http.createServer((q, res) => { const u = (q.url ?? "/").split("?")[0]; let f = path.join(dist, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html"); res.setHeader("content-type", MIME[path.extname(f)] ?? "text/html"); res.end(fs.readFileSync(f)); });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  const notes: string[] = [];
  try {
    for (const th of THEMES) for (const w of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHT[w] ?? 900 }, hasTouch: w < 744, isMobile: w < 744, colorScheme: th, reducedMotion: "reduce", timezoneId: "America/New_York" });
      await installSupabaseMock(ctx, buildFixtures(new Date(), { calendarQa: true }), path.join(HERE, "database.types.ts"));
      await ctx.addInitScript(([t, se]) => { localStorage.setItem("soosh-theme-preference", t as string); localStorage.setItem("sb-fixture-auth-token", JSON.stringify(se)); }, [th, seededSession()] as const);
      const page = await ctx.newPage();
      await page.goto(`http://localhost:${port}/#/calendar?view=week`);
      await page.waitForSelector("main h1", { timeout: 15000 });
      const shot = async (name: string, day: number) => {
        const file = `${name}-${w}-${th}.png`;
        // A phone lists the days, so the day itself is the picture; a wide screen shows the whole week.
        if (w < 744) await page.locator(`#week-day-${day}`).screenshot({ path: path.join(OUT, file) });
        else await page.screenshot({ path: path.join(OUT, file), fullPage: true });
        notes.push(`- ${file}`);
      };
      const wait = (loc: ReturnType<typeof pickButton>) => loc.first().waitFor({ timeout: 15000 });
      const notThis = async (title: string) => {
        await pickButton(page, title).first().click();
        await page.getByRole("dialog").getByRole("button", { name: "Not this" }).click();
        await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5000 });
      };

      // 1. A pick: the soonest thing that fits the day, in the Corner picked, inside the budget. (Raku firing is over it.)
      await wait(pickButton(page, "Kiln open day"));
      if ((await page.getByText("Raku firing").count()) > 0) throw new Error("a listing over the budget was offered");
      await shot("pick", 2);

      // 2. Not this: the next match swaps in.
      await notThis("Kiln open day");
      await wait(pickButton(page, "Hand-building basics"));
      if ((await pickButton(page, "Kiln open day").count()) > 0) throw new Error("Not this left the same pick on screen");
      await shot("not-this-swap", 2);

      // 3. Two more: the 3rd Not this falls back to plain free time. (Glaze swap was never offered: three is the most.)
      await notThis("Hand-building basics");
      await wait(pickButton(page, "Wheel throwing night"));
      await notThis("Wheel throwing night");
      await page.waitForTimeout(500);
      const left = await page.getByRole("button", { name: /^Stubby’s pick, .*(Kiln open day|Hand-building basics|Wheel throwing night|Glaze swap)/ }).count();
      if (left > 0) throw new Error("a pick was still offered after the 3rd Not this");
      // A phone's day tiles keep their Find something link; the wide time grid shows the plain free stretch instead.
      const find = w < 744
        ? await page.locator("#week-day-2").getByRole("link", { name: "Find something" }).count()
        : await page.getByRole("button", { name: /^Free / }).count();
      if (find === 0) throw new Error("no plain free time after the 3rd Not this");
      await shot("third-not-this", 2);

      // 4. A group that needs the host's approval says Ask to join, never Keep.
      await page.getByRole("button", { name: "Ask to join" }).first().waitFor({ timeout: 15000 });
      if ((await page.getByRole("button", { name: "Keep", exact: true }).count()) > 0) throw new Error("Keep is shown for a pick that needs approval");
      await shot("ask-to-join", 3);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(OUT, "README.md"), `# Stubby's picks, QA screenshots\n\nMade by \`scripts/visual/calendar-picks.ts\` from the calendar QA fixture person (\`calendarQa\` in \`scripts/visual/fixtures.ts\`). The fixture lives only in the visual harness, never in a database.\n\n${notes.join("\n")}\n`);
  console.log(notes.join("\n"));
}
main().catch((e) => { console.error(e); process.exit(1); });
