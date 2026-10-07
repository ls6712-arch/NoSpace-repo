// V3: one Pursuit through its whole life, checked on three screens at each step.
//
//   node scripts/visual/qa-pursuit-flow.ts --dist <fixture build> [--out docs/qa/round-2/pursuit-flow.md]
//
// Logs 3 Moments from 3 entry points (the Pursuit link, the main Log a Moment
// button with the Pursuit picked, the Pursuit page button), then pauses,
// resumes and finishes it. After every step it reads the progress and status
// the Home pursuit list, the Shelf and the Pursuit page show, and reports any
// disagreement.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright-core";
import { buildFixtures, PURSUIT_ID } from "./fixtures.ts";
import { installSupabaseMock, seededSession } from "./mock-supabase.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const args = process.argv.slice(2);
const opt = (n: string, d?: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DIST = path.resolve(ROOT, opt("dist", "docs/qa/round-2/.dist")!);
const OUT = path.resolve(ROOT, opt("out", "docs/qa/round-2/pursuit-flow.md")!);
const MIME: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".html": "text/html" };

function serve(): Promise<{ port: number; close: () => void }> {
  const server = http.createServer((q, res) => {
    let f = path.join(DIST, (q.url ?? "/").split("?")[0]);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html");
    res.setHeader("content-type", MIME[path.extname(f)] ?? "text/html"); res.end(fs.readFileSync(f));
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ port: (server.address() as { port: number }).port, close: () => server.close() })));
}

const TITLE = "Throw 24 bowls by spring";
const progressOf = (t: string) => { const m = t.match(/(\d+(?:\.\d+)?)\s*(?:\/|of)\s*24/); return m ? Number(m[1]) : null; };
const statusOf = (t: string) => (/\bPaused\b/.test(t) ? "Paused" : /\bFinished\b/.test(t) ? "Finished" : /\bIn progress\b/.test(t) ? "In progress" : /\bJust started\b/.test(t) ? "Just started" : "?");

async function read(page: Page, port: number) {
  const go = async (route: string) => { await page.goto(`http://localhost:${port}/#${route}`); await page.waitForTimeout(1500); };
  await go("/my-space");
  const home = await page.evaluate((title) => {
    const el = [...document.querySelectorAll("a, li, div")].filter((e) => e.textContent?.includes(title) && (e.textContent?.length ?? 0) < 700).sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0];
    return el?.closest("li, [role=listitem], .group, div")?.textContent ?? "";
  }, TITLE);
  await go("/you");
  const shelf = await page.evaluate((title) => {
    const el = [...document.querySelectorAll("button, a, li, div")].filter((e) => e.textContent?.includes(title) && (e.textContent?.length ?? 0) < 500).sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0];
    return el?.textContent ?? "";
  }, TITLE);
  await go(`/pursuit/${PURSUIT_ID}`);
  const pursuit = await page.evaluate(() => document.body.innerText);
  return { home: { p: progressOf(home), s: statusOf(home) }, shelf: { p: progressOf(shelf), s: statusOf(shelf) }, pursuit: { p: progressOf(pursuit), s: statusOf(pursuit) } };
}

const main = async () => {
  const srv = await serve();
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await installSupabaseMock(ctx, buildFixtures(), path.join(HERE, "database.types.ts"));
  await ctx.addInitScript((session) => { try { localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session)); } catch { /* ignore */ } }, seededSession());
  const page = await ctx.newPage();
  const T = { timeout: 8000 };
  const base = `http://localhost:${srv.port}/#`;
  const rows: string[] = [];
  const record = async (step: string) => {
    const r = await read(page, srv.port);
    const vals = [r.home, r.shelf, r.pursuit];
    const agree = vals.every((v) => v.p === vals[0].p && v.s === vals[0].s);
    rows.push(`| ${step} | ${r.home.p ?? "-"} / ${r.home.s} | ${r.shelf.p ?? "-"} / ${r.shelf.s} | ${r.pursuit.p ?? "-"} / ${r.pursuit.s} | ${agree ? "yes" : "NO"} |`);
  };
  const logLine = async (text: string) => {
    await page.getByPlaceholder(/what happened/i).first().fill(text);
    await page.getByRole("button", { name: /Keep it private|Share/ }).first().click(T);
    await page.getByText(/^Saved$/).first().waitFor(T);
  };

  await record("start");
  // 1. From the Pursuit link (Pursuit pre-filled).
  await page.goto(`${base}/create?pursuit=${PURSUIT_ID}`); await page.waitForTimeout(1200);
  await logLine("Moment 1, from the Pursuit link"); await record("after Moment 1 (Pursuit link)");
  // 2. From the main button, picking the Pursuit inside the form.
  await page.goto(`${base}/create`); await page.waitForTimeout(1200);
  await page.getByText("Write it down").first().click(T);
  await page.getByText(/Choose a Pursuit|Add to a Pursuit/).first().click(T).catch(() => {});
  await page.getByRole("combobox").first().click(T).catch(() => {});
  await page.getByText(TITLE).first().click(T).catch(() => {});
  await logLine("Moment 2, from the main button"); await record("after Moment 2 (main button)");
  // 3. From the Pursuit page button.
  await page.goto(`${base}/pursuit/${PURSUIT_ID}`); await page.waitForTimeout(1200);
  await page.getByRole("link", { name: /Log a Moment/ }).first().click(T);
  await page.waitForTimeout(800);
  await logLine("Moment 3, from the Pursuit page"); await record("after Moment 3 (Pursuit page)");
  // Pause, resume, finish.
  await page.goto(`${base}/pursuit/${PURSUIT_ID}`); await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Pause$/ }).first().click(T); await page.waitForTimeout(600); await record("paused");
  await page.goto(`${base}/pursuit/${PURSUIT_ID}`); await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Resume/ }).first().click(T); await page.waitForTimeout(600); await record("resumed");
  await page.goto(`${base}/pursuit/${PURSUIT_ID}`); await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /^Finish$/ }).first().click(T);
  await page.getByRole("button", { name: /^Finish$/ }).last().click(T); await page.waitForTimeout(800); await record("finished");

  const md = ["# Pursuit lifecycle check (V3)", "", `Pursuit: ${TITLE}. Each cell is progress out of 24, then status.`, "", "| Step | Home | Shelf | Pursuit page | Agree |", "|---|---|---|---|---|", ...rows, ""].join("\n");
  fs.writeFileSync(OUT, md); console.log(md);
  await browser.close(); srv.close();
};
main().catch((e) => { console.error(e); process.exit(1); });
