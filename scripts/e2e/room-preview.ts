// Screenshots of the engine's settings, one room at a time, with no app round them: garden, reading room
// (nook) and café, and the studio for comparison. Used to look at a setting before any Corner is switched on
// to it, and to check an engine change did not change a room.
//
// Usage: node scripts/e2e/room-preview.ts [--out DIR] [--settings garden,nook,cafe] [--moods golden,night] [--views desktop,phone] [--frames 120]
//        node scripts/e2e/room-preview.ts --cards   (writes public/worlds/{slug}/card.webp for every Corner in CORNER_WORLDS)
// It builds scripts/e2e/room-preview (a test harness, never part of the app) and opens it in a headless
// browser. No database, no network. Waits are counted in frames so two runs catch the same moment.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { build } from "vite";
import type { SettingName } from "../../src/app/world/config";

const root = process.cwd();
const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const out = path.resolve(arg("--out") ?? path.join(os.tmpdir(), "soosh-room-preview"));
const settings = (arg("--settings") ?? "garden,nook,cafe").split(",");
const moods = (arg("--moods") ?? "golden,night").split(",");
const views = (arg("--views") ?? "desktop,phone").split(",");
const frames = Number(arg("--frames") ?? 120);
fs.mkdirSync(out, { recursive: true });

// The still picture of a Corner (cornerPicture in src/app/lib/cornerPicture.ts): one square, 800 by 800, under 80 kB,
// in golden hour, from the start pose on a wide screen. The frame is wider than it is tall, so the square is cut
// from it where the setting is busiest (the characters and the shelves): 0 is the left edge of the frame, 1 the right.
const cards = args.includes("--cards");
const CARD = { frame: { width: 1440, height: 900 }, side: 800, maxBytes: 80_000 };
const CARD_CROP: Record<SettingName, number> = { studio: 0.62, garden: 1, nook: 0.3, cafe: 0.74 };

const dist = fs.mkdtempSync(path.join(os.tmpdir(), "soosh-room-preview-build-"));
await build({ configFile: false, root: path.join(root, "scripts/e2e/room-preview"), base: "./", logLevel: "warn", build: { outDir: dist, emptyOutDir: true } });

const mime: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" };
const server = http.createServer((req, res) => {
  const file = path.resolve(dist, "." + new URL(req.url!, "http://local").pathname);
  const target = file.startsWith(dist + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(dist, "index.html");
  res.writeHead(200, { "content-type": mime[path.extname(target)] ?? "application/octet-stream" });
  fs.createReadStream(target).pipe(res);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
const report = { scope: "The engine alone on a test harness page. No app, database or network.", shots: [] as { file: string; firstFrameMs: number }[], cards: [] as { file: string; bytes: number; pose: unknown }[], errors: [] as string[] };

const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  if (cards) {
    const context = await browser.newContext({ viewport: CARD.frame });
    await context.route("**/*", (route) => (new URL(route.request().url()).origin === origin ? route.fallback() : route.abort()));
    // The harness page lists the Corners that have a config, each with its start pose on a wide screen (firstPose).
    const list = await context.newPage();
    await list.goto(`${origin}/index.html?setting=studio`, { waitUntil: "load" });
    const corners = await list.evaluate(() => (window as unknown as { __cards: { slug: string; setting: SettingName; pose: unknown }[] }).__cards);
    await list.close();
    assert.ok(corners.length > 0, "no Corner has a config");
    for (const corner of corners) {
      const page = await context.newPage();
      page.on("pageerror", (e) => report.errors.push(`${corner.slug} card: ${e.message}`));
      // Motion reduced: the page draws that start pose and stays there. The pose is kept in the report.
      await page.goto(`${origin}/index.html?corner=${corner.slug}&mood=golden`, { waitUntil: "load" });
      await page.locator("#stage canvas").waitFor();
      await page.evaluate((n) => new Promise<void>((done) => { let i = 0; const tick = () => (++i >= n ? done() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), frames);
      const frame = await page.screenshot();
      await page.close();
      const left = Math.round((CARD.frame.width - CARD.frame.height) * CARD_CROP[corner.setting]);
      const square = sharp(frame).extract({ left, top: 0, width: CARD.frame.height, height: CARD.frame.height }).resize(CARD.side, CARD.side);
      let bytes = Buffer.alloc(0);
      for (let quality = 82; quality >= 40; quality -= 6) {
        bytes = await square.clone().webp({ quality, effort: 6 }).toBuffer();
        if (bytes.length < CARD.maxBytes) break;
      }
      assert.ok(bytes.length < CARD.maxBytes, `${corner.slug}: the still must be under ${CARD.maxBytes} bytes`);
      const file = path.join(root, "public/worlds", corner.slug, "card.webp");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, bytes);
      report.cards.push({ file: path.relative(root, file), bytes: bytes.length, pose: corner.pose });
      console.log("CARD", path.relative(root, file), bytes.length);
    }
    await context.close();
  }
  for (const view of cards ? [] : [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 390, height: 844 }].filter((v) => views.includes(v.name))) {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, hasTouch: view.name === "phone" });
    await context.route("**/*", (route) => (new URL(route.request().url()).origin === origin ? route.fallback() : route.abort()));
    for (const setting of settings)
      for (const mood of moods) {
        // One shot with motion reduced (the settled pose). Where a phone starts beside the walls and glides to
        // them (the open garden), two more with full motion: where it starts, before Enter, and where the glide ends.
        const shots = [{ suffix: "", query: "" }];
        if (view.name === "phone" && setting === "garden") shots.push({ suffix: "-arrive", query: "&motion=full&enter=0" }, { suffix: "-glided", query: "&motion=full" });
        for (const shot of shots) {
          const page = await context.newPage();
          page.on("pageerror", (e) => report.errors.push(`${setting} ${mood} ${view.name}: ${e.message}`));
          page.on("console", (m) => { if (m.type() === "error") report.errors.push(`${setting} ${mood} ${view.name}: ${m.text()}`); });
          await page.goto(`${origin}/index.html?setting=${setting}&mood=${mood}${shot.query}`, { waitUntil: "load" });
          await page.locator("#stage canvas").waitFor();
          assert.deepEqual(await page.evaluate(() => (window as unknown as { __problems: string[] }).__problems), [], `${setting}: the fixture config must pass the config checks`);
          // The room advances at most a twentieth of a second per frame, so this is long enough for the camera to settle.
          await page.evaluate((n) => new Promise<void>((done) => { let i = 0; const tick = () => (++i >= n ? done() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }), frames);
          const file = `${setting}-${view.name}-${mood}${shot.suffix}.png`;
          await page.screenshot({ path: path.join(out, file) });
          report.shots.push({ file, firstFrameMs: Math.round(await page.evaluate(() => (window as unknown as { __firstFrameMs: number }).__firstFrameMs)) });
          console.log("SHOT", file);
          await page.close();
        }
      }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
} finally {
  await browser.close();
  server.close();
  fs.rmSync(dist, { recursive: true, force: true });
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log("Screens and report:", out);
