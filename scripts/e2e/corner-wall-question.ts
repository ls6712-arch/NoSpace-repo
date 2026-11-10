// Log a Moment's "in progress or finished" choice, on the production build with fixture Supabase responses.
// No live account or production data is used, and nothing is written anywhere: the mock acknowledges writes.
//
// Checks: the choice appears on a Corner with a room (Pottery) and nowhere else; it uses that Corner's labels;
// it is not asked for a private Moment; "in progress" writes no Pursuit; "finished" with no Pursuit saves one
// that is finished in its first write (never an open row) and then links the Moment to it; Undo removes it.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium, type Page } from "playwright-core";
import { buildFixtures } from "../visual/fixtures.ts";
import { installSupabaseMock, seededSession, FIXTURE_ORIGIN, FIXTURE_ANON_KEY } from "../visual/mock-supabase.ts";

const root = process.cwd();
const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const out = path.resolve(arg("--out") ?? path.join(os.tmpdir(), "soosh-corner-wall-question"));
const dist = path.resolve(arg("--dist") ?? fs.mkdtempSync(path.join(os.tmpdir(), "soosh-corner-wall-question-build-")));
fs.mkdirSync(out, { recursive: true });
if (!arg("--dist")) {
  const result = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], {
    cwd: root, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY },
  });
  assert.equal(result.status, 0);
}
const mime: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".html": "text/html", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const file = path.resolve(dist, "." + new URL(req.url!, "http://local").pathname);
  const target = file.startsWith(dist + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(dist, "index.html");
  res.writeHead(200, { "content-type": mime[path.extname(target)] ?? "application/octet-stream" });
  fs.createReadStream(target).pipe(res);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const report = { scope: "Production build with mocked Supabase. No live account, no database write.", checks: [] as string[], errors: [] as string[] };
const pass = (value: string) => { report.checks.push(value); console.log("PASS", value); };

interface Write { method: string; table: string; query: string; body: Record<string, unknown> }

const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}) });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, reducedMotion: "reduce", colorScheme: "light", timezoneId: "America/New_York" });
  await installSupabaseMock(context, buildFixtures(new Date()), path.join(root, "scripts/visual/database.types.ts"));
  await context.route("**/*", (route) => { const url = new URL(route.request().url()); return url.origin === origin || url.origin === FIXTURE_ORIGIN ? route.fallback() : route.abort(); });
  await context.addInitScript(({ session }) => { if (location.protocol === "about:") return; localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); sessionStorage.setItem("soosh.stubby.hello.v1", "1"); }, { session: seededSession() });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  const writes: Write[] = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.origin !== FIXTURE_ORIGIN || !url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/rest/v1/rpc/") || ["GET", "HEAD", "OPTIONS"].includes(r.method())) return;
    let body: unknown = {}; try { body = JSON.parse(r.postData() || "{}"); } catch { /* no body */ }
    writes.push({ method: r.method(), table: url.pathname.slice("/rest/v1/".length), query: url.search, body: (Array.isArray(body) ? body[0] : body) as Record<string, unknown> });
  });

  const openLog = async (query: string, line: string) => {
    // A hash-only change does not reload, so leave the app first: each Moment starts from a fresh form.
    await page.goto("about:blank");
    await page.goto(`${origin}/#/create?${query}`, { waitUntil: "networkidle" });
    // Opened from a Corner, Log starts on the form. Opened bare, it starts on the camera.
    const textOnly = page.getByRole("button", { name: "Text only, no photo or video" }).first();
    if (await textOnly.isVisible().catch(() => false)) await textOnly.click();
    await page.getByPlaceholder(/what happened/i).first().fill(line);
  };
  const choice = (p: Page) => p.getByRole("radiogroup", { name: "How far along", exact: true });
  const post = async () => {
    await page.getByRole("button", { name: "Post", exact: true }).first().click();
    await page.getByText(/^Posted to /).first().waitFor();
    await page.waitForTimeout(800);
  };

  // 1. A Corner with a room asks, with its own two labels, in progress picked.
  await openLog("hobby=crafts-making&sub=pottery", "A blue bowl\nglazed twice");
  await choice(page).waitFor();
  assert.deepEqual(await choice(page).getByRole("radio").allInnerTexts(), ["Still making", "Made it"]);
  assert.equal(await choice(page).getByRole("radio", { name: "Still making", exact: true }).getAttribute("aria-checked"), "true");
  await page.screenshot({ path: path.join(out, "pottery-question.png") });
  pass("Pottery asks Still making or Made it, with Still making picked");

  // 2. Not asked for a Moment only its owner sees.
  await page.getByRole("radio", { name: "Only you" }).first().click();
  assert.equal(await choice(page).count(), 0);
  await page.getByRole("radio", { name: "Followers" }).first().click();
  await choice(page).waitFor();
  pass("the question goes away for a private Moment and comes back for followers");

  // 3. In progress: the Moment is saved and no Pursuit is written.
  writes.length = 0;
  await post();
  assert(writes.some((w) => w.method === "POST" && w.table === "posts"), "the Moment is saved");
  assert.equal(writes.filter((w) => w.table === "pursuits").length, 0, "Still making writes no Pursuit");
  pass("Still making saves the Moment and writes no Pursuit");

  // 4. Finished, with no Pursuit: one Pursuit, finished in its first write, then the Moment linked to it.
  await openLog("hobby=crafts-making&sub=pottery", "A blue bowl\nglazed twice");
  await choice(page).getByRole("radio", { name: "Made it", exact: true }).click();
  await page.screenshot({ path: path.join(out, "pottery-made-it.png") });
  writes.length = 0;
  await post();
  const pursuitWrites = writes.filter((w) => w.table === "pursuits");
  const first = pursuitWrites[0];
  assert(first, "a Pursuit is saved");
  assert.equal(first.method, "POST");
  assert.equal(first.body.title, "A blue bowl");
  assert.equal(first.body.hobby_slug, "crafts-making");
  assert.equal(first.body.sub_hobby, "pottery");
  assert.equal(first.body.shared, false, "a followers-only Moment makes a Pursuit that is not shared");
  assert(typeof first.body.finished_at === "string" && first.body.finished_at.length > 0, "finished in its first write");
  assert.equal(first.body.finished_at, first.body.started_at);
  for (const w of pursuitWrites) assert(!("finished_at" in w.body) || w.body.finished_at !== null, "no write ever leaves the Pursuit open");
  const id = String(first.body.id);
  const link = writes.findIndex((w) => w.method === "PATCH" && w.table === "posts" && w.body.pursuit_id === id);
  assert(link > writes.indexOf(first), "the Moment is linked to the Pursuit after the Pursuit exists");
  assert.equal(writes.filter((w) => w.table === "stubs").length, 0);
  pass("Made it with no Pursuit saves one already-finished Pursuit titled from the Moment, then links the Moment");

  // 5. Undo takes the Pursuit back with the Moment.
  writes.length = 0;
  await page.getByRole("button", { name: "Undo", exact: true }).first().click();
  await choice(page).waitFor();
  await page.waitForTimeout(500);
  assert(writes.some((w) => w.method === "DELETE" && w.table === "pursuits" && w.query.includes(id)), "Undo removes the Pursuit made for the Moment");
  pass("Undo removes the Pursuit made for the Moment");

  // 6. A Corner without a room does not ask.
  await openLog("hobby=art-creative&sub=drawing", "A quick sketch");
  await page.getByText("Drawing", { exact: true }).first().waitFor();
  assert.equal(await choice(page).count(), 0);
  await page.screenshot({ path: path.join(out, "drawing-no-question.png") });
  pass("a Corner without a room (Drawing) does not ask");

  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log("Screens and report:", out);
