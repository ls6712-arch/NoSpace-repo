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
const statusOf = (t: string) => (/\bThis Pursuit is paused\b|Paused since/.test(t) ? "Paused" : /\bFinished (\d|just|\w+ ago|[A-Z][a-z]{2} )/.test(t) || /Reopen/.test(t) ? "Finished" : /\n(Pause)\n/.test(t) ? "In progress" : "?");

// The 120 characters of page text after the first mention of the Pursuit's title.
const after = (text: string, from = 0) => { const i = text.indexOf(TITLE, from); return i < 0 ? "" : text.slice(i, i + 160); };
// Which group heading ("In progress", "Paused", "Finished") the title sits under on a list.
function groupOf(text: string): string {
  const lines = text.split("\n").map((l) => l.trim());
  let group = "?";
  for (const l of lines) {
    const m = l.match(/^(In progress|Paused|Finished)\b/);
    if (m && !l.includes(TITLE)) group = m[1];
    if (l.includes(TITLE) && group !== "?") return group;
  }
  return "?";
}

async function read(page: Page, port: number) {
  const go = async (route: string) => { await page.goto(`http://localhost:${port}/#${route}`); await page.waitForTimeout(1500); };
  await go("/my-space");
  const homeText = await page.evaluate(() => document.body.innerText);
  await go("/you");
  const shelfText = await page.evaluate(() => document.body.innerText);
  await go(`/pursuit/${PURSUIT_ID}`);
  const pursuitText = await page.evaluate(() => document.body.innerText);
  return {
    home: { p: progressOf(after(homeText)), s: groupOf(homeText) },
    shelf: { p: progressOf(shelfText), s: "n/a (the Shelf tile shows progress only)" },
    pursuit: { p: progressOf(pursuitText), s: statusOf(pursuitText) },
  };
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
    const counts = vals.map((v) => v.p).filter((p): p is number => p !== null);
    const agree = counts.every((c) => c === counts[0]) && r.home.s === r.pursuit.s;
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
  await page.locator('input[placeholder*="Pursuit"]').first().click(T);
  await page.getByRole("button", { name: TITLE }).first().click(T);
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
