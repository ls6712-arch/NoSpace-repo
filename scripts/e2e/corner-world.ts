// The Pottery Corner as a room, on the production build with the real CSP and fixture Supabase responses.
// No live account or production data is used. The wall rows below are test fixtures for this script only;
// nothing like them exists in src/ or in any database.
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
const out = path.resolve(arg("--out") ?? path.join(os.tmpdir(), "soosh-corner-world"));
const dist = path.resolve(arg("--dist") ?? fs.mkdtempSync(path.join(os.tmpdir(), "soosh-corner-world-build-")));
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
// Names from the prototype that must never ship.
const EXAMPLE_PEOPLE = ["Maya", "Alex", "Priya", "Jordan", "Ines", "Jun", "Sam"];
const CHARACTERS = ["Meera", "Sid", "Lena", "Biscuit"];

async function open(view: { name: string; width: number; height: number; touch: boolean; webgl: boolean; reduced: boolean }) {
  // SwiftShader draws the scene without a GPU. --disable-gpu with no software fallback is how WebGL is switched off.
  const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: view.webgl ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] : ["--disable-gpu", "--disable-3d-apis"] });
  const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, hasTouch: view.touch, reducedMotion: view.reduced ? "reduce" : "no-preference", colorScheme: "light", timezoneId: "America/New_York" });
  await installSupabaseMock(context, buildFixtures(new Date()), path.join(root, "scripts/visual/database.types.ts"), { rpcReplies });
  await context.route("**/*", (route) => { const url = new URL(route.request().url()); return url.origin === origin || url.origin === FIXTURE_ORIGIN ? route.fallback() : route.abort(); });
  await context.addInitScript(({ session }) => { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", "light"); sessionStorage.setItem("soosh.stubby.hello.v1", "1"); }, { session: seededSession() });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(`${view.name}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && /Content Security Policy/i.test(m.text())) report.errors.push(`${view.name}: ${m.text()}`); });
  return { browser, page };
}

try {
  for (const view of [
    { name: "desktop", width: 1440, height: 900, touch: false, webgl: true, reduced: false },
    { name: "phone", width: 390, height: 844, touch: true, webgl: true, reduced: true },
  ]) {
    const { browser, page } = await open(view);
    const scripts: string[] = [];
    page.on("response", (r) => { if (/\.js$/.test(new URL(r.url()).pathname)) scripts.push(path.basename(new URL(r.url()).pathname)); });
    // The Corner opens as its room: no button to find first.
    await page.goto(origin + "/#/corners/pottery", { waitUntil: "networkidle" });
    const world = page.locator("[data-corner-world=pottery]");
    await world.waitFor();
    await world.getByRole("heading", { name: "Pottery", exact: true }).waitFor();
    const enter = world.getByRole("button", { name: "Enter the Corner", exact: true });
    await enter.waitFor();
    await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>("[data-corner-world] h1 ~ button")?.disabled, null, { timeout: 20000 });
    assert(scripts.some((s) => /^scene-/.test(s)), "the 3D scene arrives as its own file once the world opens");
    assert.equal(await world.locator("canvas").count(), 1);
    // Sound can be turned off before going in: one setting, shared with the button in the room.
    const entrySound = world.locator("[data-entry-sound]");
    assert.equal((await entrySound.innerText()).trim(), "Sound on");
    assert.equal(await entrySound.getAttribute("aria-pressed"), "true");
    await entrySound.click();
    assert.equal((await entrySound.innerText()).trim(), "Sound off");
    assert.equal(await entrySound.getAttribute("aria-pressed"), "false");
    assert((await entrySound.boundingBox())!.height >= 44, "the entry sound button is at least 44px tall");
    await page.screenshot({ path: path.join(out, `${view.name}-entry.png`) });
    await enter.click();
    // The room's own button shows the same choice from its first second, and turning it back on works there.
    const roomSound = world.getByRole("button", { name: "Sound off", exact: true });
    await roomSound.waitFor();
    assert.equal(await world.locator("[data-entry-sound]").count(), 0);
    await roomSound.click();
    await world.getByRole("button", { name: "Sound on", exact: true }).waitFor();

    // Signs: counts of pieces, taken from the real walls. Never a count of people.
    const still = world.getByRole("button", { name: "Still making, 2 in progress", exact: true });
    await still.waitFor();
    await world.getByRole("button", { name: "Made it, 2 finished", exact: true }).waitFor();
    // Your shelf counts the viewer's own Moments in the Corner (from their own Moments, not from the walls).
    await world.getByRole("button", { name: /^Your shelf, (Empty for now|\d+ pieces?)$/ }).waitFor();
    await page.waitForTimeout(view.reduced ? 1500 : 5000);
    await page.screenshot({ path: path.join(out, `${view.name}-room.png`) });
    // The time of day is a choice, remembered for this person.
    await world.getByRole("button", { name: "Golden hour", exact: true }).click();
    assert.equal(await world.getByRole("button", { name: "Golden hour", exact: true }).getAttribute("aria-pressed"), "true");
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(out, `${view.name}-golden.png`) });

    // The one-time hint, then the Still making wall in the panel.
    await world.getByRole("button", { name: "Got it", exact: true }).click();
    await still.focus();
    await page.keyboard.press("Enter");
    const panel = world.locator("#world-panel");
    await panel.waitFor();
    assert.equal(await panel.locator("#world-making [data-wall-card]").count(), 2);
    assert.equal(await panel.locator("#world-made [data-wall-card]").count(), 2);
    await panel.getByText("Started because of Fixture B", { exact: true }).waitFor();
    await panel.getByText("Fixture A started because of this", { exact: true }).waitFor();
    await panel.getByRole("heading", { name: "Passed along", exact: true }).waitFor();
    assert.equal(await panel.getByRole("button", { name: "Make your version", exact: true }).count(), 3, "Make your version on every card that is not the viewer's own");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(out, `${view.name}-walls.png`) });

    // Characters are never people: not on a wall, not in a count, and always tagged when they speak.
    const panelText = await panel.innerText();
    for (const name of CHARACTERS) assert(!panelText.includes(name), `${name} is a character and is not on a wall`);
    const allText = await world.innerText();
    for (const name of EXAMPLE_PEOPLE) assert(!new RegExp(`\\b${name}\\b`).test(allText), `prototype example person ${name} is not shown`);
    assert(!/\b(member|follower)s?\b/i.test(allText.replace("Members see", "")), "no member or follower count");
    if (!view.reduced) {
      const bubble = world.getByText("Character", { exact: true }).first();
      await bubble.waitFor({ state: "attached", timeout: 20000 });
    }

    // The chat tab is the Corner chat.
    await panel.getByRole("tab", { name: "Chat", exact: true }).click();
    await panel.getByPlaceholder("Message the Corner").waitFor();
    await page.keyboard.press("Escape");
    assert(!/studio/i.test(await world.innerText()), "the room is the Corner, never a studio");

    // The same Corner as a list, and back. The choice is remembered.
    await world.getByRole("button", { name: "List", exact: true }).click();
    await world.waitFor({ state: "detached" });
    await page.getByRole("tab", { name: "Walls", exact: true }).waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Walls", exact: true }).waitFor();
    assert.equal(await page.locator("[data-corner-world]").count(), 0, "the list stays chosen after a reload");
    await page.getByRole("button", { name: "Room", exact: true }).click();
    await page.locator("[data-corner-world=pottery]").waitFor();
    pass(`${view.name}: the Corner opens as its room, scene in its own file, signs with piece counts, walls and Passed along in the panel, characters kept apart, chat tab, list and back`);
    await browser.close();
  }

  // No WebGL: the Corner page, with a note, never a blank screen.
  {
    const { browser, page } = await open({ name: "no-webgl", width: 390, height: 844, touch: true, webgl: false, reduced: true });
    const hasGl = await page.evaluate(() => { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); });
    assert.equal(hasGl, false, "this browser was started without WebGL");
    // The room's first address goes to the Corner.
    await page.goto(origin + "/#/corners/pottery/world", { waitUntil: "networkidle" });
    await page.waitForURL((url) => url.hash === "#/corners/pottery");
    await page.getByRole("heading", { name: "Pottery", exact: true }).first().waitFor();
    await page.getByText("This device can’t open the room, so here is the list.", { exact: true }).waitFor();
    await page.getByRole("tab", { name: "Walls", exact: true }).waitFor();
    assert.equal(await page.locator("[data-corner-world]").count(), 0);
    await page.screenshot({ path: path.join(out, "no-webgl.png") });
    pass("no WebGL: the list loads with a note");
    await browser.close();
  }

  // A Corner with no world has no way in and its world address goes to its page.
  {
    const { browser, page } = await open({ name: "other-corner", width: 390, height: 844, touch: true, webgl: true, reduced: true });
    const scripts: string[] = [];
    page.on("response", (r) => { if (/\.js$/.test(new URL(r.url()).pathname)) scripts.push(path.basename(new URL(r.url()).pathname)); });
    await page.goto(origin + "/#/corners/drawing", { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Drawing", exact: true }).first().waitFor();
    assert.equal(await page.getByRole("button", { name: "Room", exact: true }).count(), 0);
    assert.equal(await page.locator("[data-corner-world]").count(), 0);
    assert(!scripts.some((s) => /^(scene|CornerWorld)-/.test(s)), "a Corner without a room downloads none of the 3D code");
    pass("a Corner without a room: the list, no Room button, no 3D code downloaded");
    await browser.close();
  }
  assert.deepEqual(report.errors, []);
} finally {
  server.close();
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
}
console.log("Screens and report:", out);
