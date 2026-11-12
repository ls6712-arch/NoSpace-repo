// Screenshots for "One Moment, everywhere" (brief v2, Nov 10, 2026): every
// surface that shows a Moment, at 390px and 1440px, light and dark, against
// the same fixture Supabase the visual harness uses.
//
//   node scripts/visual/qa-one-moment.ts --out docs/qa/one-moment/pr1 [--dist <already-built dir>]
//
// Needs a Chromium (PLAYWRIGHT_BROWSERS_PATH). Each page is also checked for
// horizontal scroll and page errors; the report is written next to the shots.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import { buildFixtures, ME, MEDIA_ORIGIN, PURSUIT_ID, SPACE_SLUG } from "./fixtures.ts";
import { FIXTURE_ANON_KEY, FIXTURE_ORIGIN, installSupabaseMock, seededSession } from "./mock-supabase.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const TYPES = path.join(HERE, "database.types.ts");
const args = process.argv.slice(2);
const opt = (n: string, d?: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt("out", "docs/qa/one-moment/pr1")!);
const ONLY = opt("only")?.split(",");

const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".html": "text/html" };
const STRANGER = "22222222-2222-4222-8222-222222222209";
const FAN = "22222222-2222-4222-8222-222222222210";
const INES = "22222222-2222-4222-8222-222222222204";

function build(dist: string) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY } });
  if (r.status !== 0) throw new Error("build failed");
}

function serve(dist: string): Promise<{ port: number; close: () => void }> {
  const server = http.createServer((q, res) => {
    const u = (q.url ?? "/").split("?")[0];
    let f = path.join(dist, u);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html");
    res.setHeader("content-type", MIME[path.extname(f)] ?? "text/html"); res.end(fs.readFileSync(f));
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ port: (server.address() as { port: number }).port, close: () => server.close() })));
}

/** The harness fixtures, plus what this brief needs to be seen: someone you do not follow, someone who follows you, a session that has not happened, thoughts, and a long caption. */
function fixtures() {
  const f = buildFixtures() as Record<string, Record<string, unknown>[]>;
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const base = f.posts.find((p) => p.id === 10)!;
  const person = (id: string, username: string, display_name: string) => ({ ...f.profiles.find((p) => p.id === INES)!, id, username, display_name });
  f.profiles.push(person(STRANGER, "marco", "Marco Bell"), person(FAN, "june", "June Park"));
  f.posts.push(
    { ...base, id: 201, user_id: STRANGER, city: "Brooklyn", created_at: iso(now - 3 * 36e5), media_url: `${MEDIA_ORIGIN}/41.svg`, caption: "Second firing of the big planter. I changed the glaze mix this time, three parts celadon to one part clear, and it pooled in the carved lines exactly the way I wanted. Next week I am trying it on the tall vases." },
    { ...base, id: 202, user_id: FAN, city: "Park Slope", created_at: iso(now - 26 * 36e5), starts_at: iso(now + 4 * 864e5), media_url: `${MEDIA_ORIGIN}/42.svg`, caption: "Open wheel night at mine this Saturday. Bring an apron." },
    { ...base, id: 203, user_id: STRANGER, city: "Brooklyn", type: "written", media_url: "", created_at: iso(now - 50 * 36e5), caption: "Wedged twenty pounds of reclaim tonight. My shoulders know it." },
  );
  f.profile_follows.push({ follower_id: FAN, followed_id: ME, status: "accepted", created_at: iso(now - 864e5), responded_at: iso(now - 864e5) });
  f.thoughts = [
    { id: 1, post_id: 201, user_id: INES, body: "The pooling in the carved lines is so good. What cone?", prompt: null, media_url: null, created_at: iso(now - 2 * 36e5) },
    { id: 2, post_id: 201, user_id: FAN, body: "Trying this mix on Sunday", prompt: null, media_url: null, created_at: iso(now - 5 * 36e5) },
    { id: 3, post_id: 1, user_id: INES, body: "Wobbly mugs are the best mugs.", prompt: null, media_url: null, created_at: iso(now - 6 * 36e5) },
  ];
  return f;
}

const wallRow = (wall: "making" | "made", post_id: number, author_id: string, author_first_name: string, caption: string, extra: Record<string, unknown> = {}) => ({
  wall, post_id, author_id, author_first_name, author_avatar_url: null, is_mine: author_id === ME, pursuit_id: null, pursuit_title: null, media_type: "photo",
  media_url: `${MEDIA_ORIGIN}/${post_id}.svg`, media_urls: null, media_paths: [], caption, posted_at: new Date(Date.now() - post_id * 36e5).toISOString(), finished_at: null,
  has_finisher_stub: false, inspired_by_post_id: null, inspired_by_first_name: null, started_because: [], ...extra,
});

const rpcReplies = {
  discover_moments: (a: Record<string, unknown>) => (a.p_cursor ? [] : [201, 202, 203].map((post_id, i) => ({ post_id, author_id: post_id === 202 ? FAN : STRANGER, created_at: new Date(Date.now() - (i + 1) * 36e5).toISOString(), corner_key: "crafts-making/pottery" }))),
  corner_wall: (a: Record<string, unknown>) =>
    a.p_before
      ? []
      : a.p_wall === "making"
        ? [wallRow("making", 201, STRANGER, "Marco", "Second firing of the big planter. The glaze pooled in the carved lines exactly the way I wanted.", { started_because: ["June"] }), wallRow("making", 1, ME, "Maya", "Trimmed my first set of mugs tonight. Still wobbly, still proud.")]
        : [wallRow("made", 11, INES, "Inès", "Tea bowl, tenmoku glaze.", { finished_at: new Date(Date.now() - 5 * 864e5).toISOString(), has_finisher_stub: true, inspired_by_post_id: 201, inspired_by_first_name: "Marco" })],
  corner_passed_along: () => [],
};

interface Shot { name: string; route: string; setup?: (p: Page) => Promise<void>; viewport?: boolean }
const tap = (role: "button" | "link", name: string | RegExp, nth = 0) => async (p: Page) => { await p.getByRole(role, { name }).nth(nth).click({ timeout: 8000 }); await p.waitForTimeout(700); };
const toMoments = async (p: Page) => { await p.locator("[data-moment]").first().scrollIntoViewIfNeeded({ timeout: 8000 }); await p.waitForTimeout(400); };

const SHOTS: Shot[] = [
  { name: "home", route: "/my-space" },
  { name: "discover", route: "/discover", setup: toMoments },
  { name: "space", route: `/space/${SPACE_SLUG}?tab=moments` },
  { name: "corner", route: "/corners/embroidery" },
  { name: "pursuit", route: `/pursuit/${PURSUIT_ID}?legacy=1` },
  { name: "my-space-all", route: "/my-space/all" },
  { name: "profile-own", route: "/you" },
  { name: "detail", route: "/moment/201", viewport: true },
  { name: "detail-own", route: "/moment/1", viewport: true },
  { name: "menu-theirs", route: "/moment/201", viewport: true, setup: tap("button", "More") },
  { name: "menu-own", route: "/moment/1", viewport: true, setup: tap("button", "More") },
];

const main = async () => {
  const dist = path.resolve(opt("dist") ?? path.join(OUT, ".dist"));
  if (!opt("dist")) build(dist);
  const srv = await serve(dist);
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  fs.mkdirSync(OUT, { recursive: true });
  const report: string[] = [];
  for (const s of SHOTS.filter((x) => !ONLY || ONLY.includes(x.name))) {
    for (const width of [390, 1440]) {
      for (const theme of ["light", "dark"] as const) {
        const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, colorScheme: theme, reducedMotion: "reduce", deviceScaleFactor: 2, hasTouch: width === 390 });
        await installSupabaseMock(ctx, fixtures() as never, TYPES, { rpcReplies });
        await ctx.addInitScript(([session, t]) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); localStorage.setItem("soosh-theme-preference", t as string); } catch { /* storage blocked */ } }, [seededSession(), theme] as const);
        const page = await ctx.newPage();
        const errs: string[] = []; page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
        const name = `${s.name}-${width}-${theme}`;
        try {
          await page.goto(`http://localhost:${srv.port}/#${s.route}`); await page.waitForTimeout(2200);
          if (s.setup) await s.setup(page);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          const moments = await page.locator("[data-moment], [data-moment-tile]").count();
          await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 72, fullPage: !s.viewport && !s.setup });
          report.push(`${name}\tMoments ${moments}\thorizontal overflow ${overflow}px${errs.length ? `\tpage errors: ${errs.join(" | ")}` : ""}`);
        } catch (e) { report.push(`${name}\tFAILED ${String(e).split("\n")[0].slice(0, 160)}`); }
        await ctx.close();
      }
    }
  }
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(OUT, "qa-report.tsv"), report.join("\n") + "\n");
  console.log(report.join("\n"));
};
main().catch((e) => { console.error(e); process.exit(1); });
