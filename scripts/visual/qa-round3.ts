// Round 3 QA: onboarding (flag off and on) and the Undo toast, at 390px,
// against the fixture Supabase. Fails (exit 1) if a step does not show.
//
//   node scripts/visual/qa-round3.ts --out docs/qa/round-3
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
const OUT = path.resolve(ROOT, opt("out", "docs/qa/round-3")!);
const W = 390, H = 844;
const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".html": "text/html" };

function build(dist: string, mainForm: boolean) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY, VITE_ONBOARDING_MAIN_FORM: mainForm ? "true" : "false" } });
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

async function run(browser: Awaited<ReturnType<typeof chromium.launch>>, port: number, flag: "off" | "on") {
  const fx = buildFixtures();
  // A brand-new account: not onboarded, name made up from the email address.
  const me = (fx.profiles as Array<Record<string, unknown>>).find((p) => p.id === ME)!;
  me.onboarding_completed = false; me.onboarding_completed_at = null; me.display_name = "maya"; me.username = "maya";
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: "light", reducedMotion: "reduce", deviceScaleFactor: 2 });
  await installSupabaseMock(ctx, fx, TYPES);
  await ctx.addInitScript((session) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); } catch { /* blocked */ } }, seededSession());
  const page = await ctx.newPage();
  const errs: string[] = []; page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  const shot = (n: string) => page.screenshot({ path: path.join(OUT, `onboarding-flag-${flag}-${n}.png`), fullPage: true });
  await page.goto(`http://localhost:${port}/#/`); await page.waitForTimeout(2500);

  // Step 0: the name field starts empty (never the email prefix), and is required.
  const name = page.getByLabel("Name");
  check(`flag ${flag}: name step shows first`, await name.isVisible().catch(() => false));
  check(`flag ${flag}: name is not prefilled from the email`, (await name.inputValue().catch(() => "x")) === "");
  await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(300);
  check(`flag ${flag}: empty name is refused`, await page.getByText("What should people call you?").nth(1).isVisible().catch(() => false) || (await page.getByText("What should people call you?").count()) > 1);
  await shot("0-name-empty");
  await name.fill("  Maya   Okafor ");
  check(`flag ${flag}: preview shows the trimmed name`, await page.getByText("Maya Okafor", { exact: true }).first().isVisible().catch(() => false));
  await shot("0-name-filled");
  await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(1200);

  // Step 1: first Moment.
  if (flag === "on") {
    check("flag on: the Log a Moment form is the first Moment step", await page.getByRole("heading", { name: "Log a Moment" }).isVisible().catch(() => false));
    await shot("1-moment");
    await page.getByPlaceholder(/what happened/i).first().fill("Glazed the last three bowls");
    await page.getByRole("button", { name: /Keep it private|Share/ }).first().click({ timeout: 8000 }); await page.waitForTimeout(1200);
    const undo = page.getByRole("button", { name: "Undo" });
    check("flag on: Undo shows after saving", await undo.isVisible().catch(() => false));
    await shot("1-moment-saved-undo");
    await undo.click(); await page.waitForTimeout(800);
    check("flag on: Undo returns to the form", await page.getByRole("heading", { name: "Log a Moment" }).isVisible().catch(() => false));
    await shot("1-moment-after-undo");
    await page.getByRole("button", { name: /Keep it private|Share/ }).first().click({ timeout: 8000 }); await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(800);
  } else {
    await shot("1-moment");
    await page.getByRole("textbox").first().fill("Glazed the last three bowls");
    await page.getByRole("button", { name: "Only you" }).click();
    await page.getByRole("button", { name: "Log", exact: true }).click({ timeout: 8000 });
    await page.waitForTimeout(1200); await shot("1-moment-saved");
    await page.getByRole("button", { name: "Continue" }).first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  check(`flag ${flag}: tags step follows`, await page.getByText("What are you into?").isVisible().catch(() => false));
  await shot("2-tags");
  await page.getByRole("button", { name: "Continue" }).click(); await page.waitForTimeout(800);
  await shot("3-cover");
  check(`flag ${flag}: no page errors`, errs.length === 0);
  await ctx.close();
}

const main = async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  for (const flag of ["off", "on"] as const) {
    const dist = path.join(OUT, `.dist-${flag}`);
    build(dist, flag === "on");
    const srv = await serve(dist);
    try { await run(browser, srv.port, flag); } catch (e) { check(`flag ${flag}: ran to the end (${String(e).split("\n")[0].slice(0, 100)})`, false); }
    srv.close(); fs.rmSync(dist, { recursive: true, force: true });
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "onboarding-check.tsv"), results.join("\n") + "\n");
  console.log(results.join("\n"));
  process.exit(failed ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
