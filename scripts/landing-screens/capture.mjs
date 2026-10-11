/**
 * Captures the landing-page screens into public/landing/ as 1170 x 2532 WebP.
 *
 * The screens are real pages and components from the app, rendered with
 * example people and Moments (src/landing-preview) through an in-memory
 * database client. Run with: npm run landing:screens
 *
 * It starts the app's dev server in `--mode landing-preview`, drives it with
 * Playwright, and refuses to finish if the page asked for anything other than
 * the local server or the web fonts, so it cannot have touched a database.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "public/landing");
const PORT = Number(process.env.PREVIEW_PORT ?? 5199);
const BASE = `http://localhost:${PORT}`;
const only = process.argv.slice(2);

const FONT_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

/** Every screen, in the order the landing page uses them. Each gets a fresh page. */
const SCREENS = {
  // Maya's Shelf, scrolled to where her Pursuits sit under her Moments: one In
  // progress ("Climb my first V2") and one Finished ("First roll of film").
  "hero-shelf": async (pg) => {
    await go(pg, "landing-preview/shelf");
    await scrollTo(pg, "Your Pursuits", 455);
  },
  // Nick's "First V3!" with the Save button on its photo.
  "step-save": async (pg) => {
    await go(pg, "landing-preview/save");
  },
  // Maya's Shelf at the Pursuits, "Climb my first V2" opened: In progress.
  "step-try": async (pg) => {
    await go(pg, "landing-preview/shelf");
    await openPursuit(pg, "Climb my first V2");
  },
  // The same Pursuit, now Finished.
  "step-share": async (pg) => {
    await go(pg, "landing-preview/shelf?state=finished");
    await openPursuit(pg, "Climb my first V2");
  },
  // The bell, open, with the save notification on top.
  "reward-notification": async (pg) => {
    await go(pg, "landing-preview/notifications");
    await pg.getByRole("button", { name: /^Notifications/ }).first().click();
    await pg.waitForTimeout(500);
  },
  // Theo's "Wheel class Saturday", counted in.
  "come-along": async (pg) => {
    await go(pg, "landing-preview/come-along");
    await pg.getByRole("button", { name: /^Count me in/ }).first().click();
    await pg.waitForTimeout(800);
  },
  // Maya's post form at "Choose who sees this".
  "privacy-picker": async (pg) => {
    await go(pg, "landing-preview/create");
    await pg.getByText("Photo or video").click();
    await pg.waitForTimeout(800);
    await pg.locator('input[type="file"][accept*="video"]').setInputFiles(path.join(ROOT, "landing-preview/photos/maya-sourdough.jpg"));
    await pg.waitForTimeout(1500);
    await pg.locator("textarea").first().fill("Sourdough, loaf #10");
    await pg.getByRole("button", { name: "Baking", exact: true }).click();
    await pg.getByRole("button", { name: /^Followers/ }).click();
    await pg.evaluate(() => {
      const el = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith("Only you"));
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 330);
    });
    await pg.waitForTimeout(500);
  },
};

async function go(pg, route) {
  await pg.goto(`${BASE}/#/${route}`);
  await pg.waitForLoadState("networkidle").catch(() => {});
  await pg.waitForTimeout(1500);
  await hideLocalBanner(pg);
}

/** The "Local · not the live site" strip only shows off the production domain. */
async function hideLocalBanner(pg) {
  await pg.evaluate(() => {
    document.querySelectorAll('[role="status"]').forEach((el) => {
      if (/not the live site/.test(el.textContent ?? "")) el.remove();
    });
  });
}

/** Scrolls so the heading sits `offset` px below the top of the screen. */
async function scrollTo(pg, headingText, offset) {
  await pg.evaluate(
    ([text, off]) => {
      const el = [...document.querySelectorAll("h2")].find((h) => h.textContent?.trim().startsWith(text));
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off - 40);
    },
    [headingText, offset],
  );
  await pg.waitForTimeout(400);
}

/** Opens one Pursuit tile on the Shelf and scrolls it into view under the header. */
async function openPursuit(pg, title) {
  await pg.getByRole("button", { name: new RegExp(title.slice(0, 12)) }).first().click();
  await pg.waitForTimeout(800);
  await scrollTo(pg, "Your Pursuits", 120);
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("The preview server did not start.");
}

async function main() {
  const server = spawn("npx", ["vite", "--mode", "landing-preview", "--port", String(PORT), "--strictPort"], { cwd: ROOT, stdio: "ignore" });
  try {
    await waitForServer();
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
    fs.mkdirSync(OUT, { recursive: true });
    const outside = new Set();
    for (const [name, run] of Object.entries(SCREENS)) {
      if (only.length && !only.includes(name)) continue;
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true, locale: "en-US", timezoneId: "America/New_York" });
      await ctx.route("**/*", (route) => {
        const u = new URL(route.request().url());
        const local = u.hostname === "localhost" || u.protocol === "data:" || u.protocol === "blob:";
        if (!local && !FONT_HOSTS.has(u.hostname)) {
          outside.add(u.host);
          return route.abort();
        }
        return route.continue();
      });
      const pg = await ctx.newPage();
      await run(pg);
      await hideLocalBanner(pg);
      const png = await pg.screenshot({ type: "png" });
      const file = path.join(OUT, `${name}.webp`);
      await sharp(png).webp({ quality: 80 }).toFile(file);
      const { width, height } = await sharp(file).metadata();
      console.log(`${name}.webp  ${width}x${height}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
      await ctx.close();
    }
    await browser.close();
    if (outside.size) throw new Error(`The page asked for hosts other than localhost and the web fonts: ${[...outside].join(", ")}`);
    console.log("No request left localhost except the web fonts.");
  } finally {
    server.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
