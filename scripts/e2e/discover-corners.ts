// Production UI and CSP with fixture Supabase responses.
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
const keys = ["crafts-making/pottery", "music/piano", "sports-fitness/dance", "food-cooking/cooking", "music/guitar", "books-writing/reading"];
const report = { scope: "Local production UI with real CSP and fixture services. Existing remote photos/fonts are blocked; actual thumbnail fallbacks are shown. Only the existing Corner grid becomes a carousel. No live provider/database validation.", checks: [] as string[], errors: [] as string[] };
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
    // Keep the sections outside Corners populated in review captures. Empty
    // discover_moments responses hide People too, which made earlier previews
    // misleading even though neither component changed in the application.
    fixtures.profile_follows = [];
    fixtures.space_members = [];
    const publicMoments = (fixtures.posts ?? []).filter(post => [7, 8, 9, 10].includes(Number(post.id)));
    await installSupabaseMock(context, fixtures, path.join(root, "scripts/visual/database.types.ts"), { rpcReplies: {
      discover_corners: args => { assert.equal(args.p_limit, 6); return keys.map(corner_key => ({ corner_key, has_home: true, has_group: true, has_place: true })); },
      discover_spaces: () => [],
      discover_moments: () => publicMoments.map(post => ({ post_id: post.id, author_id: post.user_id, created_at: post.created_at, corner_key: `${post.hobby_slug}/${post.sub_hobby ?? ""}` })),
    } });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      return url.origin === origin || url.origin === FIXTURE_ORIGIN ? route.fallback() : route.abort();
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
    const row = section.getByRole("list", { name: "Corners new to you", exact: true });
    await row.waitFor();
    await page.locator("#discover-people").waitFor();
    await page.locator("#discover-moments").getByText("Dialled in the new grinder.", { exact: false }).first().waitFor();
    assert.equal(await row.evaluate(el => el.children.length), 3);
    assert.equal(await row.locator(".size-20").count(), 3);
    const layout = await page.evaluate(() => ({ corners: document.querySelector("#discover-corners")!.getBoundingClientRect().top, ideas: document.querySelector("#discover-ideas")!.getBoundingClientRect().top, overflow: document.documentElement.scrollWidth > innerWidth }));
    assert(layout.corners > layout.ideas, "Original section order must stay intact");
    assert.equal(layout.overflow, false);
    await page.screenshot({ path: path.join(out, `${view.name}-page.png`) });
    await page.screenshot({ path: path.join(out, `${view.name}-full.png`), fullPage: true });
    await section.evaluate(el => el.scrollIntoView({ block: "center" }));
    await section.screenshot({ path: path.join(out, `${view.name}.png`) });
    const contrast = await page.evaluate(contrastInPage);
    assert.deepEqual(contrast.failures, []);
    await row.focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(() => document.querySelector<HTMLUListElement>('#discover-corners ul[aria-label="Corners new to you"]')!.scrollLeft > 2);
    await row.evaluate(el => el.scrollTo({ left: 0, behavior: "instant" }));
    if (view.touch) {
      const box = await row.boundingBox(); assert(box);
      const session = await context.newCDPSession(page);
      const x = box.x + box.width * .8, y = box.y + 30;
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
      for (let i = 1; i <= 6; i++) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - 150 * i / 6, y, id: 1 }] });
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForFunction(() => document.querySelector<HTMLUListElement>('#discover-corners ul[aria-label="Corners new to you"]')!.scrollLeft > 20);
    } else {
      await row.hover();
      await section.getByRole("button", { name: "Scroll right" }).click();
      assert(await row.evaluate(el => el.scrollLeft) > 0);
    }
    const target = row.locator(":scope > li").nth(1).locator("a").first();
    await target.scrollIntoViewIfNeeded();
    const savedLeft = await row.evaluate(el => el.scrollLeft);
    await target.click();
    await page.waitForURL(url => url.hash === "#/corners/piano");
    await page.getByRole("heading", { name: "Piano and keys", exact: true }).first().waitFor();
    await page.goBack(); await row.waitFor();
    await page.waitForFunction(left => { const node = document.querySelector<HTMLUListElement>('#discover-corners ul[aria-label="Corners new to you"]'); return node && Math.abs(node.scrollLeft - left) < 3; }, savedLeft);
    await section.getByRole("link", { name: "See all", exact: true }).click();
    await page.waitForURL(url => url.hash === "#/corners");
    pass(`${view.name}: existing section order and three compact cards, six-result request, native keyboard scrolling, ${view.touch ? "touch swipe" : "desktop arrows"}, existing Corner/directory links and Back restoration`);
    await context.close();
  }
  assert.deepEqual(report.errors, []);
} finally {
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await browser.close(); await new Promise<void>(resolve => server.close(() => resolve()));
}
