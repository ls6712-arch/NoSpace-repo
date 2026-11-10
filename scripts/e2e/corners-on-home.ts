// Corners on Home and Discover: the new row on Home and the still pictures on Corner cards, on the production
// build with the real CSP and fixture Supabase responses. No live account or production data is used.
//
// Usage: node scripts/e2e/corners-on-home.ts [--dist DIR] [--out DIR] [--before DIR]
//   --dist    a build to open (made with the fixture Supabase URL). Without it, the working tree is built.
//   --before  the --out of a run on the build before this change. With it, every element that was on Home,
//             Discover and the Corner list before must be the same size and in the same place now (on Home,
//             what sits under the new row is lower by exactly the row's height), and nothing else may be new.
// It saves a screenshot of each page, phone and desktop, and layout.json for a later --before.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium, type Page } from "playwright-core";
import { buildFixtures, ME } from "../visual/fixtures.ts";
import { installSupabaseMock, seededSession, FIXTURE_ORIGIN, FIXTURE_ANON_KEY } from "../visual/mock-supabase.ts";

const root = process.cwd();
const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const out = path.resolve(arg("--out") ?? path.join(os.tmpdir(), "soosh-corners-on-home"));
const before = arg("--before") ? path.resolve(arg("--before")!) : undefined;
const dist = path.resolve(arg("--dist") ?? fs.mkdtempSync(path.join(os.tmpdir(), "soosh-corners-on-home-build-")));
fs.mkdirSync(out, { recursive: true });
if (!arg("--dist")) {
  const result = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], {
    cwd: root, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY },
  });
  assert.equal(result.status, 0);
}
// Whether this build has the row. A build from before the change is only photographed and measured.
const hasRow = fs.existsSync(path.join(dist, "worlds/pottery/card.webp"));
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
const report = { scope: "Production build and real CSP with mocked Supabase. Remote photos and fonts are blocked, so a Corner without a still shows its colour tile. No live account or database.", hasRow, checks: [] as string[], errors: [] as string[] };
const pass = (value: string) => { report.checks.push(value); console.log("PASS", value); };

interface Box { key: string; x: number; y: number; w: number; h: number }
/**
 * Every heading, link, button, list item and section on the page, with where it is. The new row is marked.
 * Pictures are measured through the card or link that holds them: a blocked remote photo is not an <img> here.
 */
const measure = (page: Page) =>
  page.evaluate(() => {
    const row = document.getElementById("home-corners-row")?.closest("section") ?? null;
    const boxes: (Box & { inRow: boolean })[] = [];
    const seen = new Map<string, number>();
    for (const el of document.querySelectorAll<HTMLElement>("main h1, main h2, main a, main button, main li, main section")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const inRow = !!row && row.contains(el);
      const name = `${el.tagName.toLowerCase()}|${el.id || el.getAttribute("href") || el.getAttribute("aria-label") || (el.textContent ?? "").trim().slice(0, 40)}`;
      const n = seen.get(name) ?? 0;
      seen.set(name, n + 1);
      boxes.push({ key: `${name}#${n}`, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, inRow });
    }
    const rr = row?.getBoundingClientRect();
    // The row's own height plus the space above it: how far everything under it moved.
    return { boxes, row: rr ? { top: rr.top + scrollY, height: rr.height + parseFloat(getComputedStyle(row!).marginTop) } : null };
  });
type Layout = Awaited<ReturnType<typeof measure>>;
const layouts: Record<string, Layout> = {};

const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}) });
try {
  for (const view of [{ name: "phone", width: 390, height: 844, touch: true }, { name: "desktop", width: 1440, height: 1000, touch: false }]) {
    for (const who of [
      { name: "follows-none", follows: [] as string[], heading: "Corners for you", first: ["reading", "pottery", "gardening", "board-games"] },
      { name: "follows-two", follows: ["crafts-making:knitting", "crafts-making:pottery"], heading: "Your Corners", first: ["knitting", "pottery"] },
    ]) {
      const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, hasTouch: view.touch, reducedMotion: "reduce", colorScheme: "light", timezoneId: "America/New_York" });
      // One fixed moment, so a run before the change and a run after it hold the same rows.
      const fixtures = buildFixtures(new Date("2026-11-10T15:00:00Z"));
      Object.assign(fixtures, {
        hobby_follows: who.follows.map((hobby_key) => ({ user_id: ME, hobby_key })),
        profile_private: [{ user_id: ME, city: "New York", picks: ["books-writing/reading"] }],
      });
      await installSupabaseMock(context, fixtures, path.join(root, "scripts/visual/database.types.ts"), {
        rpcReplies: { discover_corners: () => ["crafts-making/pottery", "music/piano", "books-writing/reading", "music/guitar"].map((corner_key) => ({ corner_key, has_home: true, has_group: true, has_place: true })) },
      });
      const requested: string[] = [];
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === origin) requested.push(url.pathname);
        return url.origin === origin || url.origin === FIXTURE_ORIGIN ? route.fallback() : route.abort();
      });
      await context.addInitScript(({ session, now }) => {
        localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session));
        localStorage.setItem("soosh-theme-preference", "light");
        sessionStorage.setItem("soosh.stubby.hello.v1", "1");
        // The same clock in both runs, so dates on the page read the same.
        const RealDate = Date;
        const offset = now - RealDate.now();
        // @ts-expect-error a test clock
        globalThis.Date = class extends RealDate { constructor(...a: []) { if (a.length) super(...a); else super(RealDate.now() + offset); } static now() { return RealDate.now() + offset; } };
      }, { session: seededSession(), now: new Date("2026-11-10T15:00:00Z").getTime() });
      const page = await context.newPage();
      page.on("pageerror", (e) => report.errors.push(`${view.name} ${who.name}: ${e.message}`));
      const tag = `${view.name}-${who.name}`;
      const shoot = async (name: string) => {
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(400);
        layouts[`${tag}-${name}`] = await measure(page);
        await page.screenshot({ path: path.join(out, `${tag}-${name}.png`), fullPage: true });
      };

      // ---------- Home ----------
      await page.goto(origin + "/#/my-space", { waitUntil: "networkidle" });
      await page.getByRole("heading", { name: "Best fit for you" }).waitFor();
      if (hasRow) {
        const section = page.locator("section", { has: page.locator("#home-corners-row") });
        await section.getByRole("heading", { name: who.heading, exact: true }).waitFor();
        const hrefs = await section.locator("li a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
        assert.deepEqual(hrefs, who.first.map((slug) => `#/corners/${slug}`));
        pass(`${tag}: Home shows "${who.heading}" with ${who.first.join(", ")}`);
        const pictures = await section.locator("li img").evaluateAll((imgs) => imgs.map((i) => ({ src: i.getAttribute("src"), alt: i.getAttribute("alt"), loading: i.getAttribute("loading"), w: i.clientWidth, h: i.clientHeight })));
        for (const p of pictures) assert.equal(p.w, p.h, "a Corner picture is a square");
        assert.ok(pictures.every((p) => p.loading === "lazy" && p.alt));
        assert.deepEqual(pictures.filter((p) => p.src?.includes("/worlds/")).map((p) => p.src), who.first.filter((s) => s !== "knitting").map((s) => `/worlds/${s}/card.webp`));
        pass(`${tag}: square, lazy pictures with the Corner name as alt text; a Corner without a 3D world keeps its own photo`);
        assert.equal(await section.getByRole("link", { name: "See all" }).getAttribute("href"), "#/corners");
        const order = await page.evaluate(() => ["home-corners-row", "home-still-making"].map((id) => document.getElementById(id)?.getBoundingClientRect().top ?? null));
        const week = await page.evaluate(() => [...document.querySelectorAll("main h2, main a")].find((e) => /your week/i.test(e.textContent ?? ""))?.getBoundingClientRect().bottom ?? null);
        assert.ok(week !== null && week < order[0]!, "the row is under the Your week card");
        if (order[1] !== null) assert.ok(order[0]! < order[1], "and above what Home shows next");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
      await shoot("home");
      // ---------- Discover ----------
      await page.goto(origin + "/#/discover", { waitUntil: "networkidle" });
      const row = page.locator("#discover-corners").getByRole("list", { name: "Corners new to you", exact: true });
      await row.waitFor();
      const tiles = await row.locator(":scope > li").evaluateAll((lis) => lis.map((li) => { const box = li.querySelector(".size-20")!; const img = box.querySelector("img"); return { href: li.querySelector("a")!.getAttribute("href"), src: img?.getAttribute("src") ?? null, w: box.clientWidth, h: box.clientHeight, follow: !!li.querySelector("button"), tabs: li.querySelectorAll("ul a").length }; }));
      for (const t of tiles) assert.deepEqual([t.w, t.h, t.follow], [80, 80, true]);
      if (hasRow) {
        for (const t of tiles) assert.equal(t.src?.includes("/worlds/") ?? false, ["#/corners/pottery", "#/corners/reading"].includes(t.href!), `${t.href}`);
        pass(`${tag}: on Discover, Pottery and Reading show their still at 80 by 80; Piano looks as before; Follow and the tabs are there`);
      }
      await shoot("discover");

      // ---------- The full Corner list ----------
      await page.goto(origin + "/#/corners", { waitUntil: "networkidle" });
      await page.locator('main a[href="#/corners/pottery"]').first().waitFor();
      if (hasRow) {
        // Every card for a Corner with a 3D world shows its still, and no other card does.
        const cards = await page.locator("main li a img").evaluateAll((imgs) => imgs.map((i) => ({ href: i.closest("a")!.getAttribute("href")!, still: !!i.getAttribute("src")?.includes("/worlds/") })));
        const worlds = ["#/corners/board-games", "#/corners/gardening", "#/corners/pottery", "#/corners/reading"];
        for (const c of cards) assert.equal(c.still, worlds.includes(c.href), c.href);
        const shown = [...new Set(cards.filter((c) => c.still).map((c) => c.href))].sort();
        assert.ok(shown.length > 0);
        pass(`${tag}: in the Corner list, ${shown.map((h) => h.slice(10)).join(" and ")} show a still and no other of its ${cards.length} cards does`);
      }
      await shoot("corners");

      // No part of a 3D world was fetched on any of these pages.
      const world = requested.filter((p) => /\/assets\/(scene|CornerWorld|town)-/.test(p));
      assert.deepEqual(world, [], "no 3D file may load on Home, Discover or the Corner list");
      pass(`${tag}: no 3D file requested (${requested.filter((p) => p.startsWith("/assets/") && p.endsWith(".js")).length} scripts loaded, none of scene, CornerWorld or town)`);
      if (hasRow) {
        // Last, a tap on Home opens the Corner's page, as a Corner does anywhere else.
        await page.goto(origin + "/#/my-space", { waitUntil: "networkidle" });
        await page.locator("section", { has: page.locator("#home-corners-row") }).locator("li a").nth(1).click();
        await page.waitForURL(`**/#/corners/${who.first[1]}`);
        pass(`${tag}: a card opens /corners/${who.first[1]}`);
      }
      await context.close();
    }
  }
  assert.deepEqual(report.errors, []);

  if (before) {
    const old = JSON.parse(fs.readFileSync(path.join(before, "layout.json"), "utf8")) as Record<string, Layout>;
    for (const [name, now] of Object.entries(layouts)) {
      const was = new Map(old[name].boxes.map((b) => [b.key, b]));
      const fresh = now.boxes.filter((b) => !b.inRow);
      // "See all" is a link Home already has; the row's own is inside the row and left out above.
      assert.deepEqual(fresh.map((b) => b.key).sort(), [...was.keys()].sort(), `${name}: nothing was added or removed outside the new row`);
      for (const b of fresh) {
        const a = was.get(b.key)!;
        const moved = now.row && a.y >= now.row.top ? now.row.height : 0;
        // To within half a pixel: the browser places boxes on fractions of a pixel.
        const off = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y - moved), Math.abs(b.w - a.w), Math.abs(b.h - a.h));
        assert.ok(off < 0.5, `${name}: ${b.key} is where it was and the size it was (off by ${off}px)`);
      }
      pass(`${name}: ${fresh.length} existing elements are the same size and in the same place${now.row ? `, those under the new row lower by its ${Math.round(now.row.height)}px` : ""}`);
    }
  }
} finally {
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out, "layout.json"), JSON.stringify(layouts));
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log("Screens and report:", out);
