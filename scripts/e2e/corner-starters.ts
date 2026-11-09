// Production UI and CSP with fixture Supabase responses.
// No live account, provider request or production data is used.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium, type Locator } from "playwright-core";
import { buildFixtures, ME } from "../visual/fixtures.ts";
import { installSupabaseMock, seededSession, FIXTURE_ORIGIN, FIXTURE_ANON_KEY } from "../visual/mock-supabase.ts";

const root = process.cwd();
const args = process.argv.slice(2);
const arg = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const out = path.resolve(arg("--out") ?? path.join(os.tmpdir(), "soosh-corner-starters"));
const dist = path.resolve(arg("--dist") ?? fs.mkdtempSync(path.join(os.tmpdir(), "soosh-corner-starters-build-")));
fs.mkdirSync(out, { recursive: true });
if (!arg("--dist")) {
  const result = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], {
    cwd: root, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY },
  });
  assert.equal(result.status, 0);
}
const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const headers = Object.fromEntries(config.headers.filter((h: { source: string }) => h.source === "/(.*)").flatMap((h: { headers: { key: string; value: string }[] }) => h.headers.map(x => [x.key, x.value])));
const mime: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".svg": "image/svg+xml", ".html": "text/html", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const file = path.resolve(dist, "." + new URL(req.url!, "http://local").pathname);
  const target = file.startsWith(dist + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(dist, "index.html");
  res.writeHead(200, { ...headers, "content-type": mime[path.extname(target)] ?? "application/octet-stream" });
  fs.createReadStream(target).pipe(res);
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}) });
const report = { scope: "Production build and real CSP with mocked Supabase. No live account, provider, database write or external-resource verification.", checks: [] as string[], errors: [] as string[] };
const pass = (value: string) => { report.checks.push(value); console.log("PASS", value); };
// Focused content captures omit fixed navigation/action overlays for legibility.
// All interaction, size and overflow checks run with the actual overlays visible.
async function captureContent(section: Locator, filename: string) {
  const page = section.page();
  await page.evaluate(() => document.querySelectorAll("body *").forEach(el => {
    if (["fixed", "sticky"].includes(getComputedStyle(el).position)) el.setAttribute("data-capture-overlay", "");
  }));
  try {
    await section.screenshot({ path: path.join(out, filename), style: "[data-capture-overlay], [data-capture-overlay] *, [data-capture-overlay]::before, [data-capture-overlay]::after { visibility: hidden !important; }" });
  } finally {
    await page.evaluate(() => document.querySelectorAll("[data-capture-overlay]").forEach(el => el.removeAttribute("data-capture-overlay")));
  }
}
try {
  for (const view of [
    { name: "mobile", width: 390, height: 844, touch: true, dark: false },
    { name: "desktop", width: 1440, height: 1000, touch: false, dark: false },
    { name: "small-phone", width: 320, height: 720, touch: true, dark: false },
    { name: "tablet", width: 768, height: 1024, touch: true, dark: false },
    { name: "dark", width: 390, height: 844, touch: true, dark: true },
  ]) {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, hasTouch: view.touch, reducedMotion: "reduce", colorScheme: view.dark ? "dark" : "light", timezoneId: "America/New_York" });
    const fixtures = buildFixtures(new Date());
    await installSupabaseMock(context, fixtures, path.join(root, "scripts/visual/database.types.ts"));
    const saves: Record<string, any>[] = [];
    let failNext = view.name === "mobile";
    await context.route("**/rest/v1/rpc/create_pursuit_workflow", async route => {
      const body = route.request().postDataJSON(); saves.push(body);
      if (failNext) { failNext = false; return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Fixture failure" }) }); }
      const project = body.p_project;
      const sample = fixtures.pursuits[0];
      fixtures.pursuits.push({ ...sample, id: project.id, user_id: ME, title: project.title, hobby_slug: project.hobbySlug, sub_hobby: project.subHobby, mode: project.mode, measure: project.measure, visibility: "private", finished_at: null, paused_at: null, let_go_at: null } as typeof sample);
      return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
    });
    await context.route("**/*", route => { const url = new URL(route.request().url()); return url.origin === origin || url.origin === FIXTURE_ORIGIN ? route.fallback() : route.abort(); });
    await context.addInitScript(({ session, dark }) => { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", dark ? "dark" : "light"); sessionStorage.setItem("soosh.stubby.hello.v1", "1"); }, { session: seededSession(), dark: view.dark });
    const page = await context.newPage(); page.on("pageerror", e => report.errors.push(e.message));
    await page.goto(origin + "/#/corners/drawing", { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Drawing", exact: true }).waitFor();
    // A member lands on Walls; the starter content lives on Your first time.
    await page.getByRole("tab", { name: "Your first time", exact: true }).click();
    const activities = page.locator("#corner-activities");
    const pursuits = page.locator("#corner-starter-pursuits");
    const resources = page.locator("#corner-resources");
    await resources.waitFor();
    assert.equal(await activities.locator("details").count(), 3);
    assert.equal(await pursuits.getByRole("link", { name: "Start a Pursuit", exact: true }).count(), 1);
    const resource = resources.getByRole("link", { name: "Visit website: The Public Domain Review", exact: true });
    assert.equal(await resource.getAttribute("href"), "https://publicdomainreview.org/");
    assert.equal(await resource.getAttribute("target"), "_blank");
    assert.equal(await resource.getAttribute("rel"), "noopener noreferrer");
    assert.equal(await resources.locator("iframe,img,video,audio").count(), 0);
    assert.equal(saves.length, 0);
    const summary = activities.locator("summary").first(); await summary.focus(); await page.keyboard.press("Enter");
    assert(await activities.locator("details").first().evaluate((node: HTMLDetailsElement) => node.open));
    await activities.getByText("Cost unknown. Check supplies, access and travel before starting.", { exact: true }).first().waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const shortControls = await page.locator("#corner-activities,#corner-starter-pursuits,#corner-resources").evaluateAll(nodes => nodes.flatMap(node => [...node.querySelectorAll("a,summary")]).filter(el => { const r=el.getBoundingClientRect(); return r.width && r.height && (r.width<44 || r.height<44); }).map(el=>el.textContent));
    assert.deepEqual(shortControls, []);
    await captureContent(activities, `${view.name}-activities.png`);
    await captureContent(pursuits, `${view.name}-pursuit.png`);
    await captureContent(resources, `${view.name}-resources.png`);
    await page.screenshot({ path: path.join(out, `${view.name}-full.png`), fullPage: true });
    await pursuits.getByRole("link", { name: "Start a Pursuit", exact: true }).click();
    await page.waitForURL(url => url.hash.includes("/pursuits/new?template=drawing-pursuit-01"));
    const title = page.getByRole("textbox", { name: "What do you want to do?", exact: true });
    await title.waitFor(); assert.equal(await title.inputValue(), "Make a small drawing collection");
    assert.equal(await page.getByRole("textbox", { name: "Checklist item", exact: true }).count(), 3);
    assert.equal(await page.getByRole("textbox", { name: "Checklist item", exact: true }).first().inputValue(), "Choose 3 subjects: Pick objects or views you can return to without buying anything.");
    assert.equal(saves.length, 0);
    await title.fill("My drawing collection");
    await page.getByRole("textbox", { name: "Checklist item", exact: true }).first().fill("Choose things from my desk");
    await page.screenshot({ path: path.join(out, `${view.name}-editable-pursuit.png`), fullPage: true });
    await page.getByRole("button", { name: "Start a Pursuit", exact: true }).click();
    if (view.name === "mobile") {
      await page.getByRole("alert").waitFor();
      assert.equal(await title.inputValue(), "My drawing collection");
      await page.getByRole("button", { name: "Start a Pursuit", exact: true }).click();
    }
    await page.waitForURL(url => /^#\/pursuit\/[^/]+$/.test(url.hash));
    assert.equal(saves.length, view.name === "mobile" ? 2 : 1);
    const saved = saves.at(-1)!;
    assert.equal(saved.p_project.title, "My drawing collection");
    assert.equal(saved.p_project.hobbySlug, "art-creative"); assert.equal(saved.p_project.subHobby, "drawing");
    assert.equal(saved.p_project.shared, false); assert.equal(saved.p_project.mode, "solo"); assert.equal(saved.p_project.ownerId, ME);
    assert.deepEqual(saved.p_invitees, []);
    assert.equal(saved.p_project.measure.workflow.items[0].title, "Choose things from my desk");
    assert.equal(saved.p_project.measure.workflow.items[1].title, "Draw each subject twice: Try a different line or viewpoint on the second version.");
    assert(saved.p_project.measure.workflow.items.every((item: { id: string }) => /^[\da-f-]{36}$/i.test(item.id)));
    if (saves.length === 2) assert.equal(saves[0].p_project.id, saved.p_project.id);
    pass(`${view.name}: visible activities/resources/Pursuit, keyboard disclosure, no auto-create, editable steps, existing private creation and ${view.name === "mobile" ? "retry" : "save"}`);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await installSupabaseMock(context, buildFixtures(new Date()), path.join(root, "scripts/visual/database.types.ts"));
  await context.route("**/*", route => { const u=new URL(route.request().url()); return u.origin === origin || u.origin === FIXTURE_ORIGIN ? route.fallback() : route.abort(); });
  const page = await context.newPage(); page.on("pageerror", e => report.errors.push(e.message));
  for (const slug of ["drawing", "painting", "reading", "writing", "photography", "cooking", "guitar", "gardening", "chess", "city-walks"]) {
    await page.goto(origin + "/#/corners/" + slug, { waitUntil: "networkidle" });
    await page.locator("#corner-starter-pursuits").waitFor();
    assert.equal(await page.locator("#corner-activities details").count(), 3);
    const localCovers = page.locator('#corner-starter-pursuits img[src*="/landing/photos/"]');
    if (["painting", "reading", "photography", "cooking", "guitar", "city-walks"].includes(slug)) assert.equal(await localCovers.count(), 1, `${slug} must show its supplied photo`);
    for (const image of await localCovers.all()) { await image.scrollIntoViewIfNeeded(); await image.evaluate(async (img: HTMLImageElement)=>{ await img.decode(); if(!img.naturalWidth)throw Error("Local cover did not decode"); }); }
    if (slug === "reading" || slug === "painting") {
      await captureContent(page.locator("#corner-starter-pursuits"), `${slug}-pursuit.png`);
      await captureContent(page.locator("#corner-resources"), `${slug}-resources.png`);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(out, `${slug}-guest-full.png`), fullPage: true });
    }
  }
  await page.goto(origin + "/#/corners/drawing", { waitUntil: "networkidle" });
  await page.locator("#corner-starter-pursuits").getByRole("link", { name: "Start a Pursuit", exact: true }).click();
  await page.waitForURL(url => /#\/(login|onboarding)\?/.test(url.hash));
  const redirect = new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("redirect");
  assert.equal(redirect, "/pursuits/new?template=drawing-pursuit-01");
  pass("All ten public Corners show their three activities and starter Pursuit; local covers decode and guest signup preserves the template");
  await context.close();
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(path.join(out,"report.json"),JSON.stringify(report,null,2));
  await browser.close(); await new Promise<void>(resolve=>server.close(()=>resolve()));
}
