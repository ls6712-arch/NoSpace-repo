// Screenshots of Stubby, the main character of Calendar, from the fixture person in the fixture Supabase.
// The asks count, the picks and the scout itself are answered here; no database or
// function is touched.
//
//   node scripts/visual/stubby-calendar.ts --out docs/qa/stubby-calendar [--dist <built dir>] [--widths 390,1280] [--themes light,dark]
//
// Per width and theme it saves, and FAILS (exit 1) when what the name claims is not on screen:
//   calendar-stage     Calendar's top: one Stubby, above the toolbar, with his greeting in a bubble
//   asking             mid-ask: "On it. Checking a few places.", the field busy and Stop
//   picks-inline       the picks right under the stage as a deck, not in a dialog or sheet
//   deck-selection     after Keep: the next card in front ("2 of 3") and Your selection below
//   empty              nothing fits: Stubby shrugs, the honest line and why in the results, three ways on
//   out-of-asks        0 asks left: his out-of-asks line, the field off, no quick ideas
//   sticky             scrolled down: the slim sticky bar, clear of the header and the tab bar
//   home-no-stubby     Home with no floating Stubby
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext } from "playwright-core";
import { buildFixtures } from "./fixtures.ts";
import { FIXTURE_ANON_KEY, FIXTURE_ORIGIN, installSupabaseMock, seededSession } from "./mock-supabase.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const args = process.argv.slice(2);
const opt = (n: string, d?: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt("out", "docs/qa/stubby-calendar")!);
const WIDTHS = opt("widths", "390,1280")!.split(",").map(Number);
const THEMES = opt("themes", "light,dark")!.split(",") as ("light" | "dark")[];
const HEIGHT: Record<number, number> = { 390: 844, 1280: 860 };
const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".html": "text/html" };

/** Every line Stubby may greet with (src/app/lib/stubbyLines.ts), as patterns. */
const GREETINGS = [/^You’re free tonight from [\d:]+\. Want ideas\?$/, /^.+ at [\d:]+ tonight\. Want something after\?$/, /^Your weekend’s open\. Want ideas\?$/, /^Busy week! Want something for next week\?$/, /^What are you in the mood for\?$/];

function build(dist: string) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY } });
  if (r.status !== 0) throw new Error("build failed");
}

const day = 86_400_000;
const PICKS = [
  { id: 1, title: "Wheel night at a Greenpoint studio", place: "Greenpoint, Brooklyn", starts_at: new Date(Date.now() + day).toISOString(), ends_at: null, price: "$35", url: "https://example.com/wheel", note: null, kind: "event", why: "A drop-in class where coming alone is normal.", soonest_after: false, rank: 0, ask_id: 1, created_at: new Date().toISOString() },
  { id: 2, title: "Free sunset run along the Hudson", place: "Hudson River Park", starts_at: new Date(Date.now() + 2 * day).toISOString(), ends_at: null, price: "Free", url: "https://example.com/run", note: "Price not listed", kind: "event", why: "A free group run, close to you.", soonest_after: false, rank: 1, ask_id: 1, created_at: new Date().toISOString() },
  { id: 3, title: "Open studio sketch night", place: "Bushwick, Brooklyn", starts_at: new Date(Date.now() + 3 * day).toISOString(), ends_at: null, price: "$10", url: "https://example.com/sketch", note: null, kind: "event", why: "A drop-in where coming alone is normal.", soonest_after: false, rank: 2, ask_id: 1, created_at: new Date().toISOString() },
];

/** The asks used in the last 24 hours (3 a day), the picks (none until an ask finds them), and the scout, which waits until released. */
async function stubbyRoutes(ctx: BrowserContext, state: { used: number; found: boolean; release: (() => void) | null; empty?: boolean }) {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
  await ctx.route(`${FIXTURE_ORIGIN}/rest/v1/stubby_asks**`, (route) =>
    route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json", "content-range": `*/${state.used}` }, body: "[]" }),
  );
  await ctx.route(`${FIXTURE_ORIGIN}/rest/v1/personal_picks**`, (route) =>
    route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify(state.found ? PICKS : []) }),
  );
  await ctx.route(`${FIXTURE_ORIGIN}/functions/v1/**`, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 200, headers: cors });
    if (state.empty) {
      // Nothing survived: the empty state, with why.
      state.used += 1;
      return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({ picks: [], asksLeft: 3 - state.used, outcome: "nothing", askId: 2, understood: { when: "tonight" }, reasons: [{ key: "listing", count: 2 }, { key: "midnight", count: 1 }] }) });
    }
    await new Promise<void>((r) => (state.release = r));
    state.used += 1;
    state.found = true;
    return route.fulfill({ status: 200, headers: { ...cors, "content-type": "application/json" }, body: JSON.stringify({ picks: PICKS, asksLeft: 3 - state.used, outcome: "found", askId: 1 }) });
  });
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function main() {
  const dist = path.resolve(opt("dist", "") || path.join(ROOT, "dist-stubby-calendar"));
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
      const state = { used: 1, found: false, release: null as (() => void) | null, empty: false };
      const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHT[w] ?? 900 }, hasTouch: phone, isMobile: phone, colorScheme: th, reducedMotion: "reduce", timezoneId: "America/New_York" });
      await installSupabaseMock(ctx, buildFixtures(new Date(), { calendarQa: true }), path.join(HERE, "database.types.ts"));
      await stubbyRoutes(ctx, state);
      await ctx.addInitScript(([t, se]) => {
        if (location.protocol !== "http:") return;
        localStorage.setItem("soosh-theme-preference", t as string);
        localStorage.setItem("sb-fixture-auth-token", JSON.stringify(se));
        sessionStorage.setItem("soosh.stubby.hello", "1");
      }, [th, seededSession()] as const);
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      const shot = async (name: string) => {
        const file = `${name}-${w}-${th}.png`;
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(OUT, file) });
        notes.push(`- ${file}`);
      };
      const stage = page.locator("[data-stubby-stage]");
      const line = page.locator("[data-stubby-line]");
      const field = page.getByLabel("What are you in the mood for?");
      const openCalendar = async () => {
        await page.goto(`http://localhost:${port}/#/calendar?view=week`);
        await page.waitForSelector("main h1", { timeout: 15000 });
        await stage.waitFor({ timeout: 15000 });
        await page.getByText(/asks? left today/).waitFor({ timeout: 10000 });
      };

      // 1. The stage: one Stubby, above the toolbar, with a greeting.
      await openCalendar();
      const stubbys = await page.locator("[data-stubby-state]").count();
      if (stubbys !== 1) throw new Error(`Calendar shows ${stubbys} Stubbys`);
      if (!(await stage.locator("[data-stubby-state]").count())) throw new Error("the one Stubby is not on the stage");
      const greeting = (await line.textContent())?.trim() ?? "";
      if (!GREETINGS.some((g) => g.test(greeting))) throw new Error(`unexpected greeting: ${greeting}`);
      const stageBox = (await stage.boundingBox())!;
      const today = (await page.getByRole("button", { name: "Today", exact: true }).boundingBox())!;
      if (overlaps(stageBox, today) || stageBox.y + stageBox.height > today.y) throw new Error("the stage is not above the toolbar");
      if (await page.locator("[data-stubby-dock]").count()) throw new Error("a dock is still there");
      await shot("calendar-stage");

      // 2. Mid-ask: he is on it, the field is busy.
      await field.fill("pottery this weekend");
      await stage.getByRole("button", { name: "Ask Stubby" }).click();
      await page.getByText("On it. Checking a few places.").first().waitFor({ timeout: 5000 });
      await page.getByRole("button", { name: "Stop" }).waitFor({ timeout: 5000 });
      await shot("asking");

      // 3. The picks, inline under the stage.
      while (!state.release) await page.waitForTimeout(50);
      state.release();
      await page.getByText("Here’s what I’d pick for you.").waitFor({ timeout: 10000 });
      await page.locator("[data-stubby-results]").getByText("Wheel night at a Greenpoint studio", { exact: true }).waitFor({ timeout: 10000 });
      if (await page.getByRole("dialog").count()) throw new Error("the picks opened in a dialog");
      const results = (await page.locator("[data-stubby-results]").boundingBox())!;
      if (results.y < stageBox.y + stageBox.height - 1) throw new Error("the picks are not under the stage");
      await shot("picks-inline");

      // 3b. The deck: Keep the front card into Your selection; the next comes forward.
      await page.locator("[data-stubby-deck-front]").getByRole("button", { name: "Keep" }).click();
      await page.getByRole("heading", { name: "Your selection" }).waitFor({ timeout: 5000 });
      await page.locator("[data-stubby-deck-front]").getByText("2 of 3").waitFor({ timeout: 5000 });
      await shot("deck-selection");

      // 4. The sticky bar, once the stage has scrolled away; clear of the header and the tab bar.
      await page.evaluate(() => window.scrollTo(0, 1200));
      const sticky = page.locator("[data-stubby-sticky]");
      await sticky.waitFor({ timeout: 5000 });
      const stickyBox = (await sticky.boundingBox())!;
      const header = page.locator("header.ns-site-header");
      if (await header.isVisible()) {
        const h = (await header.boundingBox())!;
        if (overlaps(stickyBox, h)) throw new Error("the sticky bar covers the header");
      }
      const bar = page.getByRole("navigation", { name: "Main" });
      if (await bar.isVisible()) {
        const b = (await bar.boundingBox())!;
        if (b.y < 800 && overlaps(stickyBox, b)) throw new Error("the sticky bar covers the tab bar");
      }
      await shot("sticky");
      if (phone) {
        // It steps aside while a sheet is open.
        await page.getByRole("button", { name: "Show" }).click();
        await page.getByRole("dialog").waitFor({ timeout: 5000 });
        if (await sticky.count()) throw new Error("the sticky bar stays over an open sheet");
        await page.keyboard.press("Escape");
        await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 5000 });
      }
      await sticky.click();
      await page.waitForFunction(() => document.activeElement?.getAttribute("id") === document.querySelector("[data-stubby-stage] input")?.id, null, { timeout: 5000 });

      // 4b. Nothing fits: Stubby shrugs, and the results say so too, with why and three ways on.
      state.empty = true;
      state.used = 0;
      await field.fill("pottery tonight");
      await stage.getByRole("button", { name: "Ask Stubby" }).click();
      const empty = page.locator("[data-stubby-empty]");
      await empty.waitFor({ timeout: 10000 });
      await empty.getByText("2 were listing pages, 1 was after midnight").waitFor({ timeout: 5000 });
      if ((await empty.getByRole("button").count()) !== 3) throw new Error("the empty state doesn't offer three ways on");
      await page.getByText("Nothing fit this time. Try asking another way.").first().waitFor({ timeout: 5000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot("empty");
      state.empty = false;

      // 5. Out of asks.
      state.used = 3;
      state.found = false;
      // Same URL, so reload: a hash change alone would keep the page as it is.
      await page.reload();
      await stage.waitFor({ timeout: 15000 });
      await page.getByText("That’s 3 for today. I’ll look again tomorrow.").waitFor({ timeout: 10000 });
      if (!(await field.isDisabled())) throw new Error("the field is on at 0 asks left");
      if (await page.getByRole("group", { name: "Quick ideas" }).count()) throw new Error("quick ideas shown at 0 asks left");
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot("out-of-asks");

      // 6. Home: no floating Stubby.
      await page.goto(`http://localhost:${port}/#/my-space`);
      await page.waitForSelector("main h1", { timeout: 15000 });
      await page.waitForTimeout(800);
      const floating = await page.evaluate(() =>
        [...document.querySelectorAll("[data-stubby-state]")].some((el) => {
          for (let n: Element | null = el; n; n = n.parentElement) if (getComputedStyle(n).position === "fixed") return true;
          return false;
        }),
      );
      if (floating || (await page.locator("[data-stubby-dock]").count())) throw new Error("a Stubby floats on Home");
      await shot("home-no-stubby");

      if (errors.length) throw new Error(`page errors: ${errors.join("; ")}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(OUT, "README.md"), `# Stubby on Calendar, QA screenshots\n\nMade by \`scripts/visual/stubby-calendar.ts\` from the fixture person in the visual harness (no database). Reduced motion is on, so Stubby shows his resting faces. The scout is held until the "asking" shot is taken, then answers with two picks.\n\n${notes.join("\n")}\n`);
  console.log(notes.join("\n"));
}
main().catch((e) => { console.error(e); process.exit(1); });
