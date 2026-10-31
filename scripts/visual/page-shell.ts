// Proof for the one page layout (PageShell): drives all eight tab pages at 390, 744, 1128 and 1440px in
// light and dark against the fixture Supabase, measures what is actually visible, and FAILS (exit 1) if
// the pages disagree.
//
//   node scripts/visual/page-shell.ts --out docs/qa/one-skin/pr5 [--dist <built dir>] [--widths 390,1440] [--themes light,dark]
//
// Checks, per page / width / theme:
//   - the visible title: the element that actually holds the title's text (not just the <h1>) is 28px / 800
//   - the rendered title text (its height, left and top) and the header row (left and right edge) agree between
//     every page to within 1px at each width and theme
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
/** The other pages, and which of the two widths each is: PAGE is 1040px of content, READING 680px (see lib/pageGrid.ts). */
const OTHERS: [string, string, "PAGE" | "READING", "main" | "viewport"][] = [
  ["corners", "/corners", "PAGE", "main"],
  ["corner", "/corners/pasta", "PAGE", "main"],
  ["category", "/browse/food-drink", "PAGE", "main"],
  ["people", "/people", "PAGE", "main"],
  ["pursuit", "/pursuit/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", "READING", "main"],
  ["new-pursuit", "/pursuits/new", "READING", "main"],
  ["log", "/create", "READING", "viewport"],
  ["terms", "/terms", "READING", "main"],
  ["privacy", "/privacy-policy", "READING", "main"],
  ["settings-account", "/account", "PAGE", "main"],
];
const TIER_PX = { PAGE: 1040, READING: 680 };
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
  // The rendered text itself (what the eye sees), not a box that could be taller than its words.
  let text = { left: -1, top: -1, height: -1 };
  if (h1) {
    const w2 = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT);
    for (let n = w2.nextNode(); n; n = w2.nextNode()) {
      if (!(n.textContent ?? "").trim()) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      const rr = rg.getBoundingClientRect();
      text = { left: Math.round(rr.left * 10) / 10, top: Math.round(rr.top * 10) / 10, height: Math.round(rr.height * 10) / 10 };
      break;
    }
  }
  const row = h1?.closest("header")?.firstElementChild as HTMLElement | null;
  const rowRect = row?.getBoundingClientRect();
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
    textLeft: text.left,
    textTop: text.top,
    textH: text.height,
    rowLeft: Math.round((rowRect?.left ?? -1) * 10) / 10,
    rowRight: Math.round((rowRect?.right ?? -1) * 10) / 10,
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
 * --selftest: prove the checks can fail. Strips the edge fade from every row, shrinks the titles and pushes one
 * title down 6px, on Week and Discover at 1440, and fails unless the clip, size and position checks all fire.
 */
const selftest = async () => {
  const dist = path.resolve(opt("dist") ?? path.join(OUT, ".dist"));
  if (!opt("dist")) build(dist);
  const server = http.createServer((q, res) => { const u = (q.url ?? "/").split("?")[0]; let f = path.join(dist, u); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html"); res.setHeader("content-type", MIME[path.extname(f)] ?? "text/html"); res.end(fs.readFileSync(f)); });
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  let clips = 0, sizes = 0;
  const tops: number[] = [];
  for (const [, route] of PAGES.filter(([n]) => n === "week" || n === "discover")) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light", reducedMotion: "reduce" });
    await installSupabaseMock(ctx, buildFixtures(), path.join(HERE, "database.types.ts"));
    await ctx.addInitScript((se) => { localStorage.setItem("soosh-theme-preference", "light"); localStorage.setItem("sb-fixture-auth-token", JSON.stringify(se)); }, seededSession());
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${port}/#${route}`);
    await p.waitForTimeout(2200);
    await p.addStyleTag({ content: "main * { mask-image: none !important; -webkit-mask-image: none !important } main h1, main h1 * { font-size: 22px !important }" });
    // The second page also gets its title pushed down 6px: the equality check must see that.
    if (tops.length === 1) await p.evaluate(() => { const h = document.querySelector("main h1") as HTMLElement; h.style.position = "relative"; h.style.top = "6px"; });
    const m = await p.evaluate(measure);
    clips += m.clips.length;
    if (m.size !== "28px") sizes++;
    tops.push(m.textTop);
    await ctx.close();
  }
  await browser.close();
  server.close();
  const offset = tops.length === 2 && Math.abs(tops[0] - tops[1]) > 1;
  console.log(`selftest: ${clips} clip finding(s), ${sizes} size finding(s), title offset ${offset ? "seen" : "NOT seen"}`);
  process.exit(clips > 0 && sizes > 0 && offset ? 0 : 1);
};

/** Runs in the page: the content box of the page's container (the first element with one of the two width classes). */
function containerBox() {
  const el = document.querySelector('main [class*="max-w-[calc("], main [class*="max-w-[1040px]"]') as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const pad = parseFloat(cs.paddingLeft);
  // PageShell keeps its gutters on the element around the 1040px box; the other pages keep them on the box itself.
  const gutter = pad > 0 ? pad : parseFloat(getComputedStyle(el.parentElement!).paddingLeft);
  const left = r.left + pad;
  const right = r.right - parseFloat(cs.paddingRight);
  const m = document.querySelector("main") as HTMLElement;
  const mr = m.getBoundingClientRect();
  const ms = getComputedStyle(m);
  return {
    left: Math.round(left * 10) / 10,
    width: Math.round((right - left) * 10) / 10,
    // The space right of the rail: main's content box.
    mainLeft: mr.left + parseFloat(ms.paddingLeft),
    mainWidth: mr.width - parseFloat(ms.paddingLeft) - parseFloat(ms.paddingRight),
    gutter,
  };
}

/** --others: every other page uses one of the two widths, centred, with the gutters, and sets no width of its own. */
const others = async (browser: import("playwright-core").Browser, port: number, fails: string[], lines: string[]) => {
  for (const th of THEMES.slice(0, 1)) for (const w of WIDTHS) for (const [page, route, tier, centre] of OTHERS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHT[w] ?? 900 }, hasTouch: w < 744, isMobile: w < 744, colorScheme: th, reducedMotion: "reduce" });
    await installSupabaseMock(ctx, buildFixtures(), path.join(HERE, "database.types.ts"));
    await ctx.addInitScript(([t, se]) => { localStorage.setItem("soosh-theme-preference", t as string); localStorage.setItem("sb-fixture-auth-token", JSON.stringify(se)); }, [th, seededSession()] as const);
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${port}/#${route}`);
    await p.waitForTimeout(2000);
    const b = await p.evaluate(containerBox);
    await p.screenshot({ path: path.join(OUT, `others-${page}-${w}.png`) });
    const id = `${page} @${w}`;
    if (!b) fails.push(`${id}: no page container (the page sets its own width)`);
    else {
      const avail = (centre === "main" ? b.mainWidth : w) - 2 * b.gutter;
      const want = Math.min(TIER_PX[tier], avail);
      const base = centre === "main" ? b.mainLeft : 0;
      const wantLeft = base + b.gutter + (avail - want) / 2;
      const gutterWant = w >= 1128 ? 32 : w >= 744 ? 24 : 16;
      if (Math.abs(b.width - want) > 1) fails.push(`${id}: content is ${b.width}px wide, want ${want}px (${tier})`);
      if (Math.abs(b.left - wantLeft) > 1) fails.push(`${id}: content starts at ${b.left}px, want ${wantLeft}px (centred)`);
      if (b.gutter !== gutterWant) fails.push(`${id}: gutter is ${b.gutter}px, want ${gutterWant}px`);
      lines.push(`| ${page} | ${w} | ${tier} | ${b.width} | ${b.left} | ${b.gutter} |`);
    }
    await ctx.close();
  }
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
  const fails: string[] = [];
  const otherLines: string[] = [];
  await others(browser, port, fails, otherLines);
  await browser.close();
  server.close();

  for (const r of rows) {
    const id = `${r.page} @${r.w} ${r.th}`;
    if (r.title === "-") fails.push(`${id}: no title`);
    if (r.size !== "28px" || r.weight !== "800") fails.push(`${id}: visible title is ${r.size}/${r.weight} (the h1 itself is ${r.h1Size}), want 28px/800`);
    if (r.subLines > 1) fails.push(`${id}: the subtitle runs to ${r.subLines} lines, want one`);
    if (r.coral > 1) fails.push(`${id}: ${r.coral} coral fills`);
    if (r.over !== 0) fails.push(`${id}: sideways scroll of ${r.over}px`);
    for (const c of r.clips) fails.push(`${id}: clipped: ${c}`);
  }
  // Every page's title, as rendered, must agree to within 1px at each width and theme: the height of its text, and
  // the left and top of the text and the left and right of the header row it sits in.
  const TOL = 1;
  for (const w of WIDTHS) for (const th of THEMES) {
    const sub = rows.filter((r) => r.w === w && r.th === th);
    for (const k of ["textH", "textLeft", "textTop", "rowLeft", "rowRight", "headerTop", "width"] as const) {
      const vals = sub.map((r) => r[k]);
      if (Math.max(...vals) - Math.min(...vals) > TOL) fails.push(`@${w} ${th}: title ${k} differs by more than ${TOL}px: ${sub.map((r) => `${r.page}=${r[k]}`).join(", ")}`);
    }
  }

  const md = ["# One skin, PR 5: measurements", "", "Measured in the browser against the fixture build. `Size / weight` is that of the element holding the title text, not only the h1. `Text height`, `Text left` and `Text top` are the rendered words (a DOM range), and `Row left` / `Row right` the header row; the check fails if any page differs from another by more than 1px. `Coral` counts coral fills inside the page (the rail's Log is outside it). `Clips` counts hard-clipped rows or boxes. The subtitle must be one line.", "", "| Width | Theme | Page | Title | Size / weight | Text height | Text left | Text top | Row left | Row right | Header top | Content | Coral | Sideways | Clips |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.w} | ${r.th} | ${r.page} | ${r.title} | ${r.size} / ${r.weight} | ${r.textH} | ${r.textLeft} | ${r.textTop} | ${r.rowLeft} | ${r.rowRight} | ${r.headerTop} | ${r.width} | ${r.coral} | ${r.over} | ${r.clips.length} |`), "", "", "## Every other page", "", "Content width and left edge of each page's container, light, at each width.", "", "| Page | Width | Tier | Content | Left | Gutter |", "|---|---|---|---|---|---|", ...otherLines, "", fails.length ? `## Failures (${fails.length})\n\n${fails.map((f) => `- ${f}`).join("\n")}` : "## Result\n\nAll checks pass."];
  fs.writeFileSync(path.join(OUT, "measurements.md"), md.join("\n") + "\n");

  const has = spawnSync("which", ["montage"]).status === 0;
  if (has) for (const th of THEMES) for (const w of WIDTHS) {
    const files = PAGES.map(([n]) => path.join(OUT, `${n}-${w}-${th}.png`));
    spawnSync("montage", ["-label", "%t", "-pointsize", "22", ...files, "-tile", "4x2", "-geometry", "+8+8", "-background", "#888", path.join(OUT, `montage-${w}-${th}.png`)]);
  }
  if (has) for (const w of WIDTHS) {
    const files = OTHERS.map(([n]) => path.join(OUT, `others-${n}-${w}.png`));
    spawnSync("montage", ["-label", "%t", "-pointsize", "22", ...files, "-tile", "5x2", "-geometry", "+8+8", "-background", "#888", path.join(OUT, `montage-others-${w}-light.png`)]);
  }
  for (const [n] of PAGES) for (const th of THEMES) for (const w of WIDTHS) fs.rmSync(path.join(OUT, `${n}-${w}-${th}.png`), { force: true });
  for (const [n] of OTHERS) for (const w of WIDTHS) fs.rmSync(path.join(OUT, `others-${n}-${w}.png`), { force: true });
  fs.rmSync(path.join(OUT, ".dist"), { recursive: true, force: true });

  console.log(`${rows.length} measurements, ${fails.length} failure(s)`);
  for (const f of fails) console.log(`  FAIL ${f}`);
  process.exit(fails.length ? 1 : 0);
};
main().catch((e) => { console.error(e); process.exit(1); });
