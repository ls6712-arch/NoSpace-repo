// Renders each supabase/templates/*.html at 390px with sample values for
// the Supabase variables, for docs/qa/round-3/email-*.png.
//   node scripts/visual/render-emails.ts --out docs/qa/round-3
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const i = process.argv.indexOf("--out");
const OUT = path.resolve(ROOT, i >= 0 ? process.argv[i + 1] : "docs/qa/round-3");
const SAMPLE: Record<string, string> = { ConfirmationURL: "https://www.example.test/auth/confirm?token=abc123", Email: "maya@example.test", NewEmail: "maya.o@example.test" };

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM });
for (const f of fs.readdirSync(path.join(ROOT, "supabase/templates")).filter((n) => n.endsWith(".html"))) {
  const html = fs.readFileSync(path.join(ROOT, "supabase/templates", f), "utf8").replace(/\{\{\s*\.(\w+)\s*\}\}/g, (_, k) => SAMPLE[k] ?? `UNFILLED:${k}`);
  const page = await browser.newPage({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 2 });
  await page.setContent(html);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0 || html.includes("UNFILLED")) throw new Error(`${f}: overflow ${overflow}px or unfilled variable`);
  await page.screenshot({ path: path.join(OUT, `email-${f.replace(".html", "")}.png`), fullPage: true });
  await page.close();
}
await browser.close();
