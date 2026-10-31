// Proof for the one page layout (PageShell): drives all eight tab pages at 390, 744, 1128 and 1440px in
// light and dark against the fixture Supabase, measures what is actually visible, and FAILS (exit 1) if
// the pages disagree.
//
//   node scripts/visual/page-shell.ts --out docs/qa/one-skin/pr5 [--dist <built dir>] [--widths 390,1440] [--themes light,dark]
//
// Checks, per page / width / theme:
//   - the visible title: the element that actually holds the title's text (not just the <h1>) is 28px / 800
//   - the header's top, the title's left and the content width are the same on every page at a given width
//     (a kicker line, Discover's, only moves its title down by its own height)
//   - at most one coral fill inside the page (the rail's Log sits outside it)
//   - no sideways page scroll
//   - no hard-clipped row: a sideways scroller with more to see must bleed to the screen edge on a phone, and fade
//     (or be at its end) from 744px; no overflow:hidden box may cut off a visible child
// Writes measurements.md and, with ImageMagick, one side-by-side montage per width and theme.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { buildFixtures } from "./fixtures.ts";
import { FIXTURE_ANON_KEY, FIXTURE_ORIGIN, installSupabaseMock, seededSession } from "./mock-supabase.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const args = process.argv.slice(2);
const opt = (n: string, d?: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt("out", "docs/qa/one-skin/pr5")!);
const WIDTHS = (opt("widths", "390,744,1128,1440")!).split(",").map(Number);
const THEMES = (opt("themes", "light,dark")!).split(",") as ("light" | "dark")[];
const HEIGHT: Record<number, number> = { 390: 844, 744: 1024, 1128: 800, 1440: 900 };
const PAGES: [string, string][] = [["home", "/my-space"], ["discover", "/discover"], ["search", "/search?q=pottery"], ["week", "/week"], ["chats", "/messages"], ["notifications", "/inbox"], ["you", "/you"], ["settings", "/settings"]];
const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".woff2": "font/woff2", ".html": "text/html" };

function build(dist: string) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: FIXTURE_ORIGIN, VITE_SUPABASE_ANON_KEY: FIXTURE_ANON_KEY } });
  if (r.status !== 0) throw new Error("build failed");
}

/** Runs in the page. Keep it self-contained. */
function measure() {
  const h1 = document.querySelector("main h1") as HTMLElement | null;
  const r = h1?.getBoundingClientRect();
  // The visible size is that of the element holding the title's text, which can differ from the h1 (a button inside it).
  let holder: HTMLElement | null = null;
  if (h1) {
    const w = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if ((n.textContent ?? "").trim()) { holder = n.parentElement; break; }
  }
  const hs = holder ? getComputedStyle(holder) : null;
  const inner = h1?.closest("header")?.parentElement as HTMLElement | null;
  const coral = [...document.querySelectorAll("main *")].filter((e) => {
    const b = e.getBoundingClientRect();
    return getComputedStyle(e).backgroundColor === "rgb(255, 107, 74)" && b.width > 12 && b.height > 12 && b.top < innerHeight && b.bottom > 0;
  }).length;

  // Hard clips.
  const clips: string[] = [];
  const name = (e: Element) => e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.split(/\s+/).slice(0, 3).join(".") : "");
  const visible = (e: Element) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
  for (const el of document.querySelectorAll("main *")) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    const scrollsX = cs.overflowX === "auto" || cs.overflowX === "scroll";
    if (scrollsX && el.scrollWidth > el.clientWidth + 2) {
      if (b.bottom < 0 || b.top > innerHeight * 3) continue;
      const faded = (cs.maskImage && cs.maskImage !== "none") || ((cs as unknown as { webkitMaskImage?: string }).webkitMaskImage ?? "none") !== "none";
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
      const ok = innerWidth < 744 ? b.right >= innerWidth - 1 : faded || atEnd;
      if (!ok) clips.push(`row ${name(el)} stops at ${Math.round(b.right)}px with more to see and no fade`);
      continue;
    }
    if (cs.overflowX === "hidden" || cs.overflowX === "clip") {
      if (cs.textOverflow === "ellipsis" || cs.display.includes("-webkit-box")) continue;
      for (const c of el.children) {
        if (!visible(c) || c.getAttribute("aria-hidden") === "true" || c.closest("[aria-hidden='true']")) continue;
        const cb = c.getBoundingClientRect();
        const cc = getComputedStyle(c);
        if (cc.position === "absolute" || cc.position === "fixed") continue;
        if (cb.right > b.right + 1.5 || cb.left < b.left - 1.5) clips.push(`${name(el)} cuts off ${name(c)} (${Math.round(cb.left)} to ${Math.round(cb.right)} in ${Math.round(b.left)} to ${Math.round(b.right)})`);
      }
    }
  }
  const header = h1?.closest("header") as HTMLElement | null;
  const sub = header?.querySelector(":scope > p") as HTMLElement | null;
  const subLines = sub ? Math.round(sub.getBoundingClientRect().height / parseFloat(getComputedStyle(sub).lineHeight)) : 0;
  const kickerH = h1 && h1.previousElementSibling ? Math.round(h1.previousElementSibling.getBoundingClientRect().height) : 0;
  return {
    headerTop: Math.round(header?.getBoundingClientRect().top ?? -1),
    kickerH,
    subLines,
    title: h1?.textContent?.trim().slice(0, 28) ?? "-",
    h1Size: h1 ? getComputedStyle(h1).fontSize : "-",
    size: hs?.fontSize ?? "-",
    weight: hs?.fontWeight ?? "-",
    left: Math.round(r?.left ?? -1),
    top: Math.round(r?.top ?? -1),
    width: Math.round(inner?.getBoundingClientRect().width ?? -1),
    over: document.documentElement.scrollWidth - innerWidth,
    coral,
    clips: [...new Set(clips)].slice(0, 6),
  };
}

/**
 * --selftest: prove the checks can fail. Strips the edge fade from every row and shrinks the titles, on Week and
 * Discover at 1440, and fails unless the clip and the size checks both fire.
 */
const selftest = async () => {
  const dist = path.resolve(opt("dist") ?? path.join(OUT, ".dist"));
  if (!opt("dist")) build(dist);
  const server = http.createServer((q, res) => { const u = (q.url ?? "/").split("?")[0]; let f = path.join(dist, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html"); res.setHeader("content-type", MIME[path.extname(f)] ?? "text/html"); res.end(fs.readFileSync(f)); });
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  let clips = 0, sizes = 0;
  for (const [, route] of PAGES.filter(([n]) => n === "week" || n === "discover")) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light", reducedMotion: "reduce" });
    await installSupabaseMock(ctx, buildFixtures(), path.join(HERE, "database.types.ts"));
    await ctx.addInitScript((se) => { localStorage.setItem("soosh-theme-preference", "light"); localStorage.setItem("sb-fixture-auth-token", JSON.stringify(se)); }, seededSession());
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${port}/#${route}`);
    await p.waitForTimeout(2200);
    await p.addStyleTag({ content: "main * { mask-image: none !important; -webkit-mask-image: none !important } main h1, main h1 * { font-size: 22px !important }" });
    const m = await p.evaluate(measure);
    clips += m.clips.length;
    if (m.size !== "28px") sizes++;
    await ctx.close();
  }
  await browser.close();
  server.close();
  console.log(`selftest: ${clips} clip finding(s), ${sizes} size finding(s)`);
  process.exit(clips > 0 && sizes > 0 ? 0 : 1);
};

const main = async () => {
  if (args.includes("--selftest")) return selftest();
  const dist = path.resolve(opt("dist") ?? path.join(OUT, ".dist"));
  if (!opt("dist")) build(dist);
  const server = http.createServer((q, res) => { const u = (q.url ?? "/").split("?")[0]; let f = path.join(dist, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html"); res.setHeader("content-type", MIME[path.extname(f)] ?? "text/html"); res.end(fs.readFileSync(f)); });
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  fs.mkdirSync(OUT, { recursive: true });
  type Row = ReturnType<typeof measure> & { w: number; th: string; page: string };
  const rows: Row[] = [];
  for (const th of THEMES) for (const w of WIDTHS) for (const [page, route] of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHT[w] ?? 900 }, hasTouch: w < 744, isMobile: w < 744, colorScheme: th, reducedMotion: "reduce", deviceScaleFactor: 1 });
    await installSupabaseMock(ctx, buildFixtures(), path.join(HERE, "database.types.ts"));
    await ctx.addInitScript(([t, se]) => { localStorage.setItem("soosh-theme-preference", t as string); localStorage.setItem("sb-fixture-auth-token", JSON.stringify(se)); }, [th, seededSession()] as const);
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${port}/#${route}`);
    await p.waitForTimeout(2200);
    await p.evaluate(() => document.querySelectorAll('[role="status"]').forEach((el) => { if (/not the live site/.test(el.textContent ?? "")) el.remove(); }));
    rows.push({ ...(await p.evaluate(measure)), w, th, page });
    await p.screenshot({ path: path.join(OUT, `${page}-${w}-${th}.png`) });
    await ctx.close();
  }
  await browser.close();
  server.close();

  const fails: string[] = [];
  for (const r of rows) {
    const id = `${r.page} @${r.w} ${r.th}`;
    if (r.title === "-") fails.push(`${id}: no title`);
    if (r.size !== "28px" || r.weight !== "800") fails.push(`${id}: visible title is ${r.size}/${r.weight} (the h1 itself is ${r.h1Size}), want 28px/800`);
    if (r.subLines > 1) fails.push(`${id}: the subtitle runs to ${r.subLines} lines, want one`);
    if (r.coral > 1) fails.push(`${id}: ${r.coral} coral fills`);
    if (r.over !== 0) fails.push(`${id}: sideways scroll of ${r.over}px`);
    for (const c of r.clips) fails.push(`${id}: clipped: ${c}`);
  }
  for (const w of WIDTHS) for (const th of THEMES) {
    const sub = rows.filter((r) => r.w === w && r.th === th);
    // The header starts at the same place on every page. A page with a kicker line (Discover) has its title that much lower, and no more.
    const lowered = sub.filter((r) => Math.abs(r.top - r.headerTop - r.kickerH) > 1);
    for (const r of lowered) fails.push(`@${w} ${th}: ${r.page} title is ${r.top - r.headerTop}px below its header, its kicker is ${r.kickerH}px`);
    for (const k of ["left", "width", "headerTop"] as const) {
      const vals = new Set(sub.map((r) => r[k]));
      if (vals.size > 1) fails.push(`@${w} ${th}: title ${k} differs: ${sub.map((r) => `${r.page}=${r[k]}`).join(", ")}`);
    }
  }

  const md = ["# One skin, PR 5: measurements", "", "Measured in the browser against the fixture build. `Size / weight` is that of the element holding the title text, not only the h1. `Coral` counts coral fills inside the page (the rail's Log is outside it). `Clips` counts hard-clipped rows or boxes. The subtitle must be one line.", "", "| Width | Theme | Page | Title | Size / weight | Left | Header top | Title top | Kicker | Content | Coral | Sideways | Clips |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.w} | ${r.th} | ${r.page} | ${r.title} | ${r.size} / ${r.weight} | ${r.left} | ${r.headerTop} | ${r.top} | ${r.kickerH} | ${r.width} | ${r.coral} | ${r.over} | ${r.clips.length} |`), "", fails.length ? `## Failures (${fails.length})\n\n${fails.map((f) => `- ${f}`).join("\n")}` : "## Result\n\nAll checks pass."];
  fs.writeFileSync(path.join(OUT, "measurements.md"), md.join("\n") + "\n");

  const has = spawnSync("which", ["montage"]).status === 0;
  if (has) for (const th of THEMES) for (const w of WIDTHS) {
    const files = PAGES.map(([n]) => path.join(OUT, `${n}-${w}-${th}.png`));
    spawnSync("montage", ["-label", "%t", "-pointsize", "22", ...files, "-tile", "4x2", "-geometry", "+8+8", "-background", "#888", path.join(OUT, `montage-${w}-${th}.png`)]);
  }
  for (const [n] of PAGES) for (const th of THEMES) for (const w of WIDTHS) fs.rmSync(path.join(OUT, `${n}-${w}-${th}.png`), { force: true });
  fs.rmSync(path.join(OUT, ".dist"), { recursive: true, force: true });

  console.log(`${rows.length} measurements, ${fails.length} failure(s)`);
  for (const f of fails) console.log(`  FAIL ${f}`);
  process.exit(fails.length ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
