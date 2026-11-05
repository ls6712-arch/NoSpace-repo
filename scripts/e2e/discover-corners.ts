// Production UI and CSP, local photographs, and fixture Supabase responses.
// No live account, provider request or production data is used.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright-core";
import { buildFixtures } from "../visual/fixtures.ts";
import { installSupabaseMock, seededSession, FIXTURE_ORIGIN, FIXTURE_ANON_KEY } from "../visual/mock-supabase.ts";
import { contrastInPage } from "../visual/contrast.ts";

const root = process.cwd();
const args = process.argv.slice(2);
const arg = (name: string) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const out = path.resolve(arg("--out") ?? path.join(os.tmpdir(), "soosh-discover-corners"));
const dist = path.resolve(arg("--dist") ?? fs.mkdtempSync(path.join(os.tmpdir(), "soosh-discover-build-")));
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
const keys = ["music/guitar", "food-cooking/cooking", "books-writing/reading", "photography-film/photography", "art-creative/painting", "crafts-making/pottery", "music/piano", "sports-fitness/dance", "sports-fitness/running", "food-cooking/baking", "crafts-making/knitting", "travel-adventure/hiking", "food-cooking/pasta", "music/drums", "sports-fitness/yoga", "art-creative/drawing"];
const report = { scope: "Local production build, real CSP, fixture services. Five exact-activity owner-supplied local photos are decoded. Other remote media and fonts are blocked, so their honest icon fallbacks are visible. No live provider/database validation.", checks: [] as string[], errors: [] as string[] };
const pass = (message: string) => { report.checks.push(message); console.log("PASS", message); };

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
    await installSupabaseMock(context, fixtures, path.join(root, "scripts/visual/database.types.ts"), { rpcReplies: {
      discover_corners: () => keys.map(corner_key => ({ corner_key, has_home: true, has_group: false, has_place: false })),
      discover_spaces: () => [], discover_moments: () => [],
    } });
    // Override the visual harness's synthetic stock-image response. Missing
    // remote photos must exercise the app's real fallback, not pretend to load.
    await context.route("https://images.unsplash.com/**", route => route.abort());
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      return url.origin === origin || url.origin === FIXTURE_ORIGIN || url.protocol === "data:" ? route.fallback() : route.abort();
    });
    await context.addInitScript(({ session, dark }) => {
      localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session));
      localStorage.setItem("soosh-theme-preference", dark ? "dark" : "light");
      sessionStorage.setItem("soosh.stubby.hello.v1", "1");
    }, { session: seededSession(), dark: view.dark });
    const page = await context.newPage();
    page.on("pageerror", e => report.errors.push(`${view.name}: ${e.message}`));
    await page.goto(origin + "/#/discover", { waitUntil: "networkidle" });
    const section = page.locator("#discover-corners");
    const carousel = section.getByRole("group", { name: "Corners new to you" });
    const row = carousel.getByRole("list", { name: "Corners new to you", exact: true });
    await carousel.waitFor();
    assert.equal(await carousel.getByRole("article").count(), 12);
    const geometry = await page.evaluate(() => ({ corners: document.querySelector("#discover-corners")!.getBoundingClientRect().top, ideas: document.querySelector("#discover-ideas")!.getBoundingClientRect().top, overflow: document.documentElement.scrollWidth > innerWidth }));
    assert(geometry.corners < geometry.ideas && geometry.corners < view.height);
    assert.equal(geometry.overflow, false);
    for (const image of await carousel.locator('img[src*="/landing/photos/"]').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(async (img: HTMLImageElement) => { await img.decode(); assertPhoto(img); function assertPhoto(photo: HTMLImageElement) { if (!photo.naturalWidth) throw Error("Photo did not decode"); } });
    }
    await carousel.focus(); await page.keyboard.press("Home");
    await row.evaluate(el => { if (el.scrollLeft > 2) throw Error("Home did not reset the row"); });
    await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
    await page.screenshot({ path: path.join(out, `${view.name}.png`) });
    await section.screenshot({ path: path.join(out, `${view.name}-carousel.png`) });
    const contrast = await page.evaluate(contrastInPage);
    assert.deepEqual(contrast.failures, []);
    await carousel.focus();
    await page.keyboard.press("ArrowRight");
    const one = await row.evaluate(el => el.scrollLeft);
    assert(one > 0);
    await page.keyboard.press("ArrowRight");
    assert(await row.evaluate(el => el.scrollLeft) > one);
    await page.keyboard.press("End");
    assert(await row.evaluate(el => el.scrollLeft >= el.scrollWidth - el.clientWidth - 2));
    await page.keyboard.press("Home");
    if (view.touch) {
      const box = await row.boundingBox(); assert(box);
      const session = await context.newCDPSession(page);
      const x = box.x + box.width * .8, y = box.y + Math.min(70, box.height / 2);
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
      for (let i = 1; i <= 6; i++) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 180 * i / 6, y, id: 1 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForFunction(() => document.querySelector<HTMLUListElement>('#discover-corners ul[aria-label="Corners new to you"]')!.scrollLeft > 20);
    } else {
      await carousel.hover();
      await carousel.getByRole("button", { name: "Scroll right" }).click();
      assert(await row.evaluate(el => el.scrollLeft) > 0);
    }
    const target = carousel.locator("article").nth(4).locator("a").first();
    await target.scrollIntoViewIfNeeded();
    const savedLeft = await row.evaluate(el => el.scrollLeft);
    await target.click();
    await page.waitForURL(url => url.hash === "#/corners/painting");
    await page.goBack(); await carousel.waitFor();
    await page.waitForFunction(left => Math.abs(document.querySelector<HTMLUListElement>('#discover-corners ul[aria-label="Corners new to you"]')!.scrollLeft - left) < 3, savedLeft);
    await section.getByRole("link", { name: "See all", exact: true }).click();
    await page.waitForURL(url => url.hash === "#/corners");
    if (!view.touch) {
      await page.goBack(); await carousel.waitFor();
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await carousel.focus(); await page.keyboard.press("Home");
      await page.waitForFunction(() => document.querySelector<HTMLUListElement>('#discover-corners ul[aria-label="Corners new to you"]')!.scrollLeft < 2);
      const box = await row.boundingBox(); assert(box);
      await page.mouse.move(box.x + 240, box.y + 70);
      await page.mouse.down();
      await page.mouse.move(box.x + 60, box.y + 70, { steps: 8 });
      await page.mouse.up();
      assert(await row.evaluate(el => el.scrollLeft) > 40);
      assert.equal(new URL(page.url()).hash, "#/discover");
      pass("Normal-motion desktop dragging moves the carousel without accidentally opening a Corner");
    }
    pass(`${view.name}: top carousel, 12 cards, five decoded local photos, keyboard navigation, ${view.touch ? "touch swipe" : "desktop arrows"}, real Corner and directory routes`);
    await context.close();
  }
  for (const signedIn of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await installSupabaseMock(context, buildFixtures(new Date()), path.join(root, "scripts/visual/database.types.ts"));
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/rpc/discover_corners")) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Fixture unavailable" }) });
      return url.origin === origin || url.origin === FIXTURE_ORIGIN ? route.fallback() : route.abort();
    });
    if (signedIn) await context.addInitScript(session => localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)), seededSession());
    let followWrites = 0;
    context.on("request", request => { if (request.url().includes("/rest/v1/hobby_follows") && request.method() === "POST") followWrites++; });
    const page = await context.newPage();
    page.on("pageerror", e => report.errors.push(e.message));
    await page.goto(origin + "/#/discover", { waitUntil: "networkidle" });
    const section = page.locator("#discover-corners");
    await section.getByRole("heading", { name: signedIn ? "Corners new to you" : "Explore Corners" }).waitFor();
    if (signedIn) {
      assert.equal(await section.getByRole("article").count(), 0);
      await section.getByRole("link", { name: "See all", exact: true }).click();
      await page.waitForURL(url => url.hash === "#/corners");
      pass("Failed recommendation read leaves the directory reachable");
    } else {
      assert.equal(await section.getByRole("article").count(), 12);
      await section.getByRole("button", { name: "Follow", exact: true }).first().click();
      await page.getByRole("link", { name: "Create an account", exact: true }).waitFor();
      assert.equal(followWrites, 0);
      pass("Visitors browse twelve Corners; following uses the existing signup gate without a write");
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close(); await new Promise<void>(resolve => server.close(() => resolve()));
}
