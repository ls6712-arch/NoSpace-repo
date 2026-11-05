import { chromium } from "playwright-core";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
import { buildFixtures, ME, nyAt } from "../visual/fixtures.ts";
import { installSupabaseMock, seededSession } from "../visual/mock-supabase.ts";
const root = process.cwd();
const dist = path.join(root, "dist-calendar-integration");
const out = path.join(root, "docs/qa/calendar-simple-planning");
fs.mkdirSync(out, { recursive: true });
const mime: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".html": "text/html",
};
const server = http.createServer((req, res) => {
  let f = path.join(dist, (req.url ?? "/").split("?")[0]);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory())
    f = path.join(dist, "index.html");
  res.setHeader(
    "Content-Type",
    mime[path.extname(f)] ?? "application/octet-stream",
  );
  res.end(fs.readFileSync(f));
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  timezoneId: "America/New_York",
  reducedMotion: "reduce",
});
await context.route("**/*", (r) =>
  r.request().url().startsWith(origin) ||
  r.request().url().startsWith("https://fixture.supabase.co") ||
  /^(data:|blob:)/.test(r.request().url())
    ? r.fallback()
    : r.abort(),
);
const now = new Date();
const at = nyAt(now, 1, 12);
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
}).format(at);
const fixtures = buildFixtures(now);
let freeWindows = ["mon@1140-1260","wed@720-780","wed@1080-1200","sat@600-840"];
let failRead = false;
const writes: Record<string, unknown>[] = [];
const privateRow = () => ({ user_id: ME, city: "New York", picks: ["crafts-making/pottery"], free_windows: freeWindows, monthly_budget: 50 });
Object.assign(fixtures, { profile_private: [privateRow()], calendar_entries: [] });
await installSupabaseMock(context, fixtures, path.join(root, "scripts/visual/database.types.ts"));
await context.route("**/rest/v1/profile_private*", async (route) => {
  const request = route.request();
  if (request.method() === "GET") {
    return route.fulfill({ status: failRead ? 503 : 200, contentType: "application/json", body: JSON.stringify(failRead ? {message: "Offline"} : privateRow()) });
  }
  if (request.method() === "POST") {
    const payload = request.postDataJSON();
    writes.push(payload);
    if (Array.isArray(payload.free_windows)) freeWindows = payload.free_windows;
    return route.fulfill({ status: 201, body: "" });
  }
  return route.fallback();
});
await context.addInitScript((session) => {
  localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session));
  sessionStorage.setItem("soosh.stubby.hello.v1", "1");
}, seededSession());
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
let checks = 0;
const shot = async (name: string) => {
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  await page.screenshot({ path: path.join(out, name + ".png"), fullPage: false });
};
try {
  await page.goto(`${origin}/#/calendar?view=day&date=${date}`);
  await page.getByRole("button", { name: "Make a plan", exact: true }).click();
  await page.getByRole("button", { name: "Pottery", exact: true }).click();
  await page.getByLabel("Day", { exact: true }).fill(date);
  await page.getByLabel("When", { exact: true }).fill("20:45");
  assert.equal(await page.getByRole("button", { name: "Daytime", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Evening", exact: true }).count(), 0);
  assert.equal(await page.getByText("No Corner matches.", { exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Make the plan", exact: true }).isEnabled(), true);
  checks += 4;
  await shot("01-simple-plan-mobile");
  await page.setViewportSize({width: 1280, height: 900});
  await page.getByRole("dialog", { name: "Make a plan", exact: true }).waitFor();
  assert.equal(await page.getByLabel("When", { exact: true }).inputValue(), "20:45");
  checks++;
  await shot("02-simple-plan-desktop");
  await page.keyboard.press("Escape");
  // Start from a real calendar slot, preserving its precise wall time.
  await page.goto(`${origin}/#/calendar?view=week&date=${date}`);
  const column = page.locator(".cursor-cell").first();
  await column.waitFor();
  await column.click({position: {x: 20, y: 288}});
  await page.getByRole("dialog").getByRole("button", { name: "Make a plan", exact: true }).click();
  assert.equal(await page.getByLabel("When", { exact: true }).inputValue(), "13:00");
  await page.getByLabel("Day", { exact: true }).fill(date);
  assert.equal(await page.getByLabel("When", { exact: true }).inputValue(), "13:00");
  checks += 2;
  await page.keyboard.press("Escape");
  await page.setViewportSize({width:390, height:844});
  await page.goto(`${origin}/#/week/free?from=week`);
  await page.getByRole("button", { name: /^Monday.*7:00 PM to 9:00 PM/ }).waitFor();
  await page.getByLabel("Monday from 1").fill("19:30");
  await page.getByRole("button",{name:"Add time",exact:true}).click();
  await page.getByLabel("Monday from 2").fill("12:00");
  await page.getByLabel("Monday to 2").fill("13:00");
  checks++;
  const save = page.getByRole("button", {name:"Save", exact:true});
  const box = await save.boundingBox();
  assert.ok(box && box.y + box.height <= 844);
  checks++;
  await shot("03-usual-free-times-mobile");
  await page.getByRole("button",{name:"Copy to other days",exact:true}).click();
  await page.getByRole("checkbox",{name:"Wednesday",exact:true}).check();
  await shot("05-copy-hours-mobile");
  await page.getByRole("button",{name:"Copy hours",exact:true}).click();
  await page.getByRole("button",{name:/^Wednesday.*12:00 PM to 1:00 PM, 6:00 PM to 9:00 PM/}).waitFor();
  checks++;
  await save.click();
  await page.waitForURL(/calendar/);
  assert.deepEqual(writes.at(-1)?.free_windows,["mon@720-780","mon@1170-1260","wed@720-780","wed@1080-1260","sat@600-840"]);
  checks++;
  // The exact saved Monday hours are the actual free slots in Calendar.
  const monday=new Date(now);
  while(new Intl.DateTimeFormat("en-US",{weekday:"short",timeZone:"America/New_York"}).format(monday)!=="Mon")monday.setDate(monday.getDate()+1);
  const mondayDate=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York"}).format(monday);
  await page.goto(`${origin}/#/calendar?view=day&date=${mondayDate}`);
  await page.getByRole("button",{name:/^Free .*7:30/}).waitFor();
  await page.getByRole("button",{name:/^Free .*7:30/}).scrollIntoViewIfNeeded();
  await shot("06-exact-hours-calendar-mobile");
  checks++;
  await page.goto(`${origin}/#/week/free?from=week`);
  await page.getByRole("button",{name:/^Monday.*12:00 PM to 1:00 PM, 7:30 PM to 9:00 PM/}).waitFor();
  checks++;
  await page.getByRole("button",{name:"Clear usual free times",exact:true}).click();
  await save.click();
  await page.waitForURL(/calendar/);
  assert.deepEqual(writes.at(-1)?.free_windows, []);
  checks++;
  await page.goto(`${origin}/#/week/free?from=week`);
  await page.getByRole("button", {name:"Monday No times added", exact:true}).waitFor();
  checks++;
  failRead = true;
  await page.reload();
  await page.getByRole("alert").waitFor();
  assert.equal(await save.isDisabled(), true);
  checks++;
  await shot("04-free-times-retry-mobile");
  failRead = false;
  await page.getByRole("button", {name:"Retry", exact:true}).click();
  await page.waitForFunction(() => !document.querySelector("fieldset[disabled]"));
  assert.equal(await save.isEnabled(), true);
  checks++;
  assert.deepEqual(errors, []);
  console.log(`PASS: ${checks} browser checks, six real screenshots, no page errors.`);
} catch (e) {
  console.error("URL",page.url(),"ERRORS",errors);
  await shot("failure");
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}
