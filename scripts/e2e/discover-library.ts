// Production UI and CSP with fixture Supabase responses.
// No live account, provider request or production data is used.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium, type Locator, type Page } from "playwright-core";
import { buildFixtures } from "../visual/fixtures.ts";
import { installSupabaseMock, seededSession, FIXTURE_ORIGIN, FIXTURE_ANON_KEY } from "../visual/mock-supabase.ts";

const root = process.cwd();
const args = process.argv.slice(2);
const arg = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const out = path.resolve(arg("--out") ?? path.join(os.tmpdir(), "soosh-discover-visibility"));
const dist = path.resolve(arg("--dist") ?? fs.mkdtempSync(path.join(os.tmpdir(), "soosh-discover-visibility-build-")));
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
const report = { scope: "Production application and actual CSP with mocked Supabase. External navigation is intercepted locally. No live source availability, account, OAuth, production write or deployment checks.", checks: [] as string[], errors: [] as string[] };
const pass = (value: string) => { report.checks.push(value); console.log("PASS", value); };
const waitResults = (page: Page, kind: "resources" | "pursuits", count: number) => page.waitForFunction(({ kind, count }) => document.querySelectorAll(kind === "resources" ? '[data-starter-collection-results] a[target="_blank"]' : '[data-starter-collection-results] a').length === count, { kind, count });
async function capture(section: Locator, filename: string) {
  const page = section.page();
  await page.evaluate(() => document.querySelectorAll("body *").forEach(el => {
    if (["fixed", "sticky"].includes(getComputedStyle(el).position)) el.setAttribute("data-capture-overlay", "");
  }));
  try { await section.screenshot({ path: path.join(out, filename), style: "[data-capture-overlay], [data-capture-overlay] *, [data-capture-overlay]::before, [data-capture-overlay]::after { visibility: hidden !important; }" }); }
  finally { await page.evaluate(() => document.querySelectorAll("[data-capture-overlay]").forEach(el => el.removeAttribute("data-capture-overlay"))); }
}
async function contextFor(signedIn: boolean, width: number, height: number, dark = false) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 1000, reducedMotion: "reduce", colorScheme: dark ? "dark" : "light", timezoneId: "America/New_York" });
  await installSupabaseMock(context, buildFixtures(new Date()), path.join(root, "scripts/visual/database.types.ts"));
  const writes: string[] = [];
  await context.route("**/rest/v1/rpc/create_pursuit_workflow", route => {
    writes.push(route.request().url());
    return route.fulfill({ status: 500, body: "Unexpected create during browsing" });
  });
  await context.route("**/*", route => {
    const u = new URL(route.request().url());
    if (u.origin === origin || u.origin === FIXTURE_ORIGIN) return route.fallback();
    if (u.href === "https://standardebooks.org/" && route.request().isNavigationRequest()) return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Intercepted navigation</title><h1>Local navigation check</h1>" });
    return route.abort();
  });
  await context.addInitScript(({ session, signedIn, dark }) => {
    if (signedIn) localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session));
    localStorage.setItem("soosh-theme-preference", dark ? "dark" : "light");
    sessionStorage.setItem("soosh.stubby.hello.v1", "1");
  }, { session: seededSession(), signedIn, dark });
  return { context, writes };
}
try {
  for (const view of [
    { name: "mobile", width: 390, height: 844, dark: false },
    { name: "desktop", width: 1440, height: 1000, dark: false },
    { name: "small-phone", width: 320, height: 720, dark: false },
    { name: "tablet", width: 768, height: 1024, dark: false },
    { name: "dark", width: 390, height: 844, dark: true },
  ].filter(view => !arg("--only") || arg("--only") === view.name)) {
    const { context, writes } = await contextFor(true, view.width, view.height, view.dark);
    const page = await context.newPage(); page.on("pageerror", e => report.errors.push(e.message));
    await page.goto(origin + "/#/discover?window=sat-day", { waitUntil: "networkidle" });
    const resources = page.locator("#discover-resources"), pursuits = page.locator("#discover-pursuit-ideas");
    await resources.waitFor(); await pursuits.waitFor();
    const source = resources.getByRole("link", { name: "Visit website: Standard Ebooks", exact: true });
    assert.equal(await resources.locator('a[target="_blank"]:visible').count(), view.width < 744 ? 2 : 3);
    assert.equal(await pursuits.getByRole("link", { name: "Start a Pursuit", exact: true }).count(), view.width < 744 ? 1 : 2);
    assert.equal(await pursuits.locator("ol:visible li").count(), view.width < 744 ? 3 : 6);
    assert.equal(await source.getAttribute("href"), "https://standardebooks.org/");
    assert.equal(await source.getAttribute("rel"), "noopener noreferrer");
    assert.equal(await resources.locator("iframe,img,video,audio").count(), 0);
    const corners = page.getByRole("list", { name: "Corners new to you" });
    const oldLinks = await corners.locator("a").evaluateAll(nodes => nodes.map(el => ({ href: el.getAttribute("href"), text: el.textContent })));
    const nav = page.getByRole("navigation", { name: "Sections", exact: true });
    await nav.getByRole("button", { name: "Resources", exact: true }).click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const tiny = await page.locator("[data-discover-starter-previews] a").evaluateAll(nodes => nodes.filter(el => { const r=el.getBoundingClientRect(); return r.width && r.height && (r.width<44 || r.height<44); }).map(el=>el.textContent));
    assert.deepEqual(tiny, []);
    await capture(page.locator("[data-discover-starter-previews]"), `${view.name}-previews.png`);
    await page.evaluate(() => window.scrollTo(0,0));
    await page.screenshot({ path: path.join(out, `${view.name}-overview.png`), fullPage: true });
    await source.scrollIntoViewIfNeeded();
    const appUrl = page.url();
    const popupPromise = context.waitForEvent("page"); await source.click();
    const popup = await popupPromise; await popup.waitForLoadState("domcontentloaded");
    assert.equal(popup.url(), "https://standardebooks.org/");
    assert(await popup.evaluate(() => window.opener === null));
    assert.equal(page.url(), appUrl); await popup.close();
    const trigger = resources.getByRole("link", { name: "See all resources", exact: true });
    await trigger.scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => scrollY);
    await trigger.click();
    let dialog = page.getByRole("dialog", { name: "Resources", exact: true }); await dialog.waitFor();
    assert.equal(await dialog.getByRole("link", { name: /^Visit website:/ }).count(), 16);
    assert(await dialog.getByRole("heading", { name: "Resources", exact: true }).evaluate(el => document.activeElement === el));
    await dialog.getByRole("searchbox", { name: "Search resources", exact: true }).fill("Standard");
    await waitResults(page, "resources", 1);
    assert.equal(await dialog.getByRole("link", { name: /^Visit website:/ }).count(), 1);
    assert(new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("browseQuery") === "Standard");
    await dialog.getByRole("searchbox", { name: "Search resources", exact: true }).fill("");
    await page.waitForURL(url => !new URLSearchParams(url.hash.split("?")[1]).has("browseQuery"));
    await dialog.getByRole("combobox", { name: "Corner", exact: true }).selectOption("books-writing/reading");
    await page.waitForURL(url => new URLSearchParams(url.hash.split("?")[1]).get("browseCorner") === "books-writing/reading");
    await waitResults(page, "resources", 3);
    assert.equal(await dialog.getByRole("link", { name: /^Visit website:/ }).count(), 3);
    await page.screenshot({ path: path.join(out, `${view.name}-resources-browser.png`) });
    await dialog.getByRole("button", { name: "Close collection", exact: true }).focus();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      assert(await dialog.evaluate(el => el.contains(document.activeElement)), "Focus must stay inside the collection");
    }
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
    assert(!page.url().includes("browse=")); assert(page.url().includes("window=sat-day"));
    assert(await trigger.evaluate(el => document.activeElement === el));
    assert(Math.abs((await page.evaluate(() => scrollY)) - scrollBefore) <= 8);
    await trigger.click(); dialog = page.getByRole("dialog", { name: "Resources", exact: true }); await dialog.waitFor();
    await dialog.getByRole("searchbox", { name: "Search resources", exact: true }).fill("no such entry qzx");
    await dialog.getByRole("status").waitFor();
    await dialog.getByRole("button", { name: "Clear filters", exact: true }).click();
    await waitResults(page, "resources", 16);
    assert.equal(await dialog.getByRole("link", { name: /^Visit website:/ }).count(), 16);
    await page.goBack(); await dialog.waitFor({ state: "hidden" });
    assert(page.url().includes("/discover?window=sat-day"));
    await pursuits.getByRole("link", { name: "See all ideas", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Pursuit ideas", exact: true }); await dialog.waitFor();
    assert.equal(await dialog.getByRole("link", { name: "Start a Pursuit", exact: true }).count(), 10);
    await dialog.getByRole("combobox", { name: "Corner", exact: true }).selectOption("art-creative/painting");
    await waitResults(page, "pursuits", 1);
    assert.equal(await dialog.getByRole("link", { name: "Start a Pursuit", exact: true }).count(), 1);
    await dialog.getByRole("link", { name: "Start a Pursuit", exact: true }).click();
    await page.waitForURL(url => url.hash.includes("/pursuits/new?template=painting-pursuit-01"));
    assert.equal(await page.getByRole("textbox", { name: "What do you want to do?", exact: true }).inputValue(), "Make a set of small paintings");
    assert.equal(await page.getByRole("textbox", { name: "Checklist item", exact: true }).count(), 3);
    assert.equal(writes.length, 0);
    await page.goBack(); dialog = page.getByRole("dialog", { name: "Pursuit ideas", exact: true }); await dialog.waitFor();
    assert.equal(await dialog.getByRole("combobox", { name: "Corner", exact: true }).inputValue(), "art-creative/painting");
    if (view.name === "mobile") {
      await dialog.getByRole("button", { name: "Clear filters", exact: true }).click(); await waitResults(page, "pursuits", 10);
      const last = dialog.getByRole("link", { name: "Start a Pursuit", exact: true }).last();
      await last.scrollIntoViewIfNeeded();
      const top = await page.locator("[data-starter-collection-scroll]").evaluate(el => el.scrollTop);
      assert(top > 0);
      const target = await last.getAttribute("href"); await last.click();
      await page.waitForURL(url => url.hash === (target?.startsWith("#") ? target : "#" + target));
      await page.getByRole("textbox", { name: "What do you want to do?", exact: true }).waitFor();
      await page.goBack(); dialog = page.getByRole("dialog", { name: "Pursuit ideas", exact: true }); await dialog.waitFor();
      await page.waitForFunction(top => Math.abs((document.querySelector("[data-starter-collection-scroll]")?.scrollTop ?? 0) - top) <= 8, top, { timeout: 5000 }).catch(async error => {
        console.log("Collection return diagnostic", top, await page.locator("[data-starter-collection-scroll]").evaluate(el => ({ top: el.scrollTop, limit: el.scrollHeight-el.clientHeight })), page.url());
        await page.screenshot({ path: path.join(out,"return-failure.png") });
        throw error;
      });
    }
    await dialog.getByRole("button", { name: "Close collection", exact: true }).click(); await dialog.waitFor({ state: "hidden" });
    assert.deepEqual(await corners.locator("a").evaluateAll(nodes => nodes.map(el => ({ href: el.getAttribute("href"), text: el.textContent }))), oldLinks);
    assert.equal(writes.length, 0);
    pass(`${view.name}: public previews, unchanged Corner links, direct external visit, responsive layout, collection search/filter/clear, Escape/focus/scroll restoration, Browser Back, editable template and no auto-create`);
    await context.close();
  }
  const { context, writes } = await contextFor(false, 390, 844);
  const page = await context.newPage(); page.on("pageerror", e=>report.errors.push(e.message));
  await page.goto(origin + "/#/discover?window=sun-day&browse=resources&browseQuery=Standard&browseCorner=books-writing%2Freading", { waitUntil: "networkidle" });
  const dialog = page.getByRole("dialog", { name: "Resources", exact: true }); await dialog.waitFor();
  assert.equal(await dialog.getByRole("link", { name: /^Visit website:/ }).count(), 1);
  await dialog.getByRole("button", { name: "Close collection", exact: true }).click(); await dialog.waitFor({state:"hidden"});
  assert.equal(new URL(page.url()).hash, "#/discover?window=sun-day");
  const guestLink=page.locator("#discover-pursuit-ideas").getByRole("link",{name:"Start a Pursuit",exact:true});
  assert.equal(await guestLink.count(),1); await guestLink.click();
  await page.waitForURL(url=>/#\/(login|onboarding)\?/.test(url.hash));
  assert.equal(new URLSearchParams(new URL(page.url()).hash.split("?")[1]).get("redirect"),"/pursuits/new?template=reading-pursuit-01");
  assert.equal(writes.length,0); await context.close();
  pass("Guest shared-link filtering, safe close on Discover and selected Pursuit signup handoff");
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.errors.push(error instanceof Error ? error.message : String(error));
  throw error;
} finally {
  fs.writeFileSync(path.join(out,"report.json"),JSON.stringify(report,null,2));
  await browser.close(); await new Promise<void>(resolve=>server.close(()=>resolve()));
}
