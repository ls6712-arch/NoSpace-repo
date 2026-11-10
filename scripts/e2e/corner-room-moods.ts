// A Corner's room in each light (Morning, Golden hour, Night rain), as screenshots, on the production build
// with fixture Supabase responses. No live account or production data is used.
//
// Usage: node scripts/e2e/corner-room-moods.ts [--out DIR] [--dist DIR] [--corner pottery]
// Used to compare the room before and after a change to the engine: run it on both and look at the pairs.
// Motion is reduced and every wait is counted in frames, so two runs differ only by where the characters are
// in their loops.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright-core";
import { buildFixtures, ME } from "../visual/fixtures.ts";
import { installSupabaseMock, seededSession, FIXTURE_ORIGIN, FIXTURE_ANON_KEY } from "../visual/mock-supabase.ts";

const root = process.cwd();
const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const out = path.resolve(arg("--out") ?? path.join(os.tmpdir(), "soosh-corner-room-moods"));
const dist = path.resolve(arg("--dist") ?? fs.mkdtempSync(path.join(os.tmpdir(), "soosh-corner-room-moods-build-")));
fs.mkdirSync(out, { recursive: true });
if (!arg("--dist")) {
  const result = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], {
    cwd: root, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY },
  });
  assert.equal(result.status, 0);
}
const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const headers = Object.fromEntries(config.headers.filter((h: { source: string }) => h.source === "/(.*)").flatMap((h: { headers: { key: string; value: string }[] }) => h.headers.map((x) => [x.key, x.value])));
const mime: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".html": "text/html", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const file = path.resolve(dist, "." + new URL(req.url!, "http://local").pathname);
  const target = file.startsWith(dist + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(dist, "index.html");
  res.writeHead(200, { ...headers, "content-type": mime[path.extname(target)] ?? "application/octet-stream" });
  fs.createReadStream(target).pipe(res);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const report = { scope: "Production build and real CSP with mocked Supabase. No live account, database write or real device.", checks: [] as string[], errors: [] as string[] };
const pass = (value: string) => { report.checks.push(value); console.log("PASS", value); };

// Fixture wall rows. Three people: A is in the middle of a bowl, B finished a mug and A started because of B,
// and the viewer has a piece in progress. C's finished piece started nobody.
const A = "22222222-2222-4222-8222-222222222222";
const B = "33333333-3333-4333-8333-333333333333";
const C = "44444444-4444-4444-8444-444444444444";
const row = (o: Record<string, unknown>) => ({
  author_avatar_url: null, is_mine: false, pursuit_title: null, media_type: "written", media_url: null, media_urls: null, media_paths: null,
  finished_at: null, has_finisher_stub: false, inspired_by_post_id: null, inspired_by_first_name: null, started_because: [], ...o,
});
const MAKING = [
  row({ wall: "making", post_id: 9001, author_id: A, author_first_name: "Fixture A", pursuit_id: "p-a", pursuit_title: "A pinch bowl", caption: "Rim is wavy.", posted_at: "2026-11-09T10:00:00Z", inspired_by_post_id: 9002, inspired_by_first_name: "Fixture B" }),
  row({ wall: "making", post_id: 9003, author_id: ME, author_first_name: "Me", is_mine: true, pursuit_id: null, caption: "First go on the wheel.", posted_at: "2026-11-08T10:00:00Z" }),
];
const MADE = [
  row({ wall: "made", post_id: 9002, author_id: B, author_first_name: "Fixture B", pursuit_id: "p-b", pursuit_title: "A lemon mug", caption: "Four evenings.", posted_at: "2026-11-07T10:00:00Z", finished_at: "2026-11-07T12:00:00Z", started_because: ["Fixture A"] }),
  row({ wall: "made", post_id: 9004, author_id: C, author_first_name: "Fixture C", pursuit_id: "p-c", pursuit_title: "Nesting bowls", caption: "Three bowls.", posted_at: "2026-11-06T10:00:00Z", finished_at: "2026-11-06T12:00:00Z" }),
];
const CHAIN = [
  { chain_no: 1, pos: 1, author_id: B, author_first_name: "Fixture B", pursuit_id: "p-b", pursuit_title: "A lemon mug", last_post_id: 9002 },
  { chain_no: 1, pos: 2, author_id: A, author_first_name: "Fixture A", pursuit_id: "p-a", pursuit_title: null, last_post_id: 9001 },
];
const rpcReplies = {
  corner_wall: (a: Record<string, unknown>) => (a.p_before ? [] : a.p_wall === "making" ? MAKING : MADE),
  corner_passed_along: () => CHAIN,
};
const corner = arg("--corner") ?? "pottery";
const MOODS = [["morning", "Morning"], ["golden", "Golden hour"], ["night", "Night rain"]] as const;

const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  for (const view of [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, hasTouch: view.name === "phone", reducedMotion: "reduce", colorScheme: "light", timezoneId: "America/New_York" });
    await installSupabaseMock(context, buildFixtures(new Date()), path.join(root, "scripts/visual/database.types.ts"), { rpcReplies });
    await context.route("**/*", (route) => { const url = new URL(route.request().url()); return url.origin === origin || url.origin === FIXTURE_ORIGIN ? route.fallback() : route.abort(); });
    await context.addInitScript(({ session }) => { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); sessionStorage.setItem("soosh.stubby.hello.v1", "1"); }, { session: seededSession() });
    for (const [mood, label] of MOODS) {
      const page = await context.newPage();
      page.on("pageerror", (e) => report.errors.push(`${view.name} ${mood}: ${e.message}`));
      await page.goto(`${origin}/#/corners/${corner}`, { waitUntil: "networkidle" });
      const world = page.locator(`[data-corner-world=${corner}]`);
      const enter = world.getByRole("button", { name: "Enter the Corner", exact: true });
      await enter.waitFor();
      await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>("[data-corner-world] h1 ~ button")?.disabled, null, { timeout: 30000 });
      await enter.click();
      await world.getByRole("button", { name: label, exact: true }).click();
      // The one-time hint arrives once the walls have loaded. Close it so it does not cover the room.
      // It follows a sign, so it moves every frame: wait for it, then click without waiting for it to hold still.
      const gotIt = world.getByRole("button", { name: "Got it", exact: true });
      // It shows once per person, so only the first room of a run has it.
      if (await gotIt.waitFor({ timeout: 10000 }).then(() => true, () => false)) await gotIt.dispatchEvent("click");
      // Wait in frames, not seconds: the room advances at most a twentieth of a second per frame, and a
      // headless browser draws slowly, so a clock wait would catch the camera at a different point each run.
      // 450 frames is long enough for the camera to settle and the light to finish easing.
      await page.evaluate((frames) => new Promise<void>((done) => { let n = 0; const tick = () => (++n >= frames ? done() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), 450);
      // A character may be mid-sentence. Speech bubbles are not part of the room's look, so leave them out.
      await page.addStyleTag({ content: "[data-corner-world] div.pointer-events-none.will-change-transform { display: none !important; }" });
      await page.screenshot({ path: path.join(out, `${corner}-${view.name}-${mood}.png`) });
      pass(`${corner} ${view.name} ${label}`);
      await page.close();
    }
    await context.close();
  }
  void ME;
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log("Screens and report:", out);
