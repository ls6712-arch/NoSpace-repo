import { chromium } from "playwright-core";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
import { buildFixtures, ME, nyAt } from "../visual/fixtures.ts";
import { installSupabaseMock, seededSession } from "../visual/mock-supabase.ts";
const root = process.cwd();
const dist = path.join(root, "dist-calendar-integration");
const out = path.join(root, "docs/qa/calendar-pursuits");
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
const personalId = "00000000-0000-4000-8000-000000001001";
const sharedId = "00000000-0000-4000-8000-000000001002";
const base = {
  owner_id: ME,
  creator_id: ME,
  hobby_slug: null,
  sub_hobby: null,
  place: "Studio",
  is_plan: false,
  shared_session: false,
  n: 1,
  total: 1,
};
const rows = [
  {
    ...base,
    id: "session-77",
    pursuit_id: "legacy",
    title: "Studio practice",
    starts_at: at.toISOString(),
  },
  {
    ...base,
    id: "meeting-" + personalId,
    pursuit_id: "personal",
    title: "Private painting",
    starts_at: nyAt(now, 1, 14).toISOString(),
  },
  {
    ...base,
    id: "meeting-" + sharedId,
    pursuit_id: "friends",
    title: "Painting with friends",
    starts_at: nyAt(now, 1, 16).toISOString(),
    shared_session: true,
  },
];
const declined = new Set<string>();
const cancelled = new Set<string>();
const calls: { name: string; args: Record<string, unknown> }[] = [];
const fixtures = buildFixtures(now);
Object.assign(fixtures, { pursuit_attendance: [], calendar_entries: [] });
await installSupabaseMock(
  context,
  fixtures,
  path.join(root, "scripts/visual/database.types.ts"),
  {
    rpcReplies: {
      get_calendar_pursuit_sessions: (args) =>
        rows.filter(
          (r) =>
            !declined.has(r.id) &&
            !cancelled.has(r.id) &&
            Date.parse(r.starts_at) >= Date.parse(String(args.p_from)) &&
            Date.parse(r.starts_at) < Date.parse(String(args.p_to)),
        ),
      set_calendar_workflow_attendance: (args) => {
        calls.push({ name: "attendance", args });
        if (args.p_going === false) declined.add("meeting-" + args.p_session);
        else declined.delete("meeting-" + args.p_session);
        return null;
      },
      change_calendar_workflow_session: (args) => {
        calls.push({ name: "change", args });
        const r = rows.find((r) => r.id === "meeting-" + args.p_session)!;
        if (args.p_cancel) cancelled.add(r.id);
        else r.starts_at = String(args.p_starts_at);
        return null;
      },
    },
  },
);
await context.addInitScript((session) => {
  localStorage.setItem("sb-fixture-auth-token", JSON.stringify(session));
  sessionStorage.setItem("soosh.stubby.hello.v1", "1");
}, seededSession());
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
let checks = 0;
const session = (title: string) =>
  page.getByRole("button", {
    name: new RegExp("^Pursuit session, .*" + title),
  });
async function shot(name: string) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: path.join(out, name + ".png"),
    fullPage: true,
  });
}
try {
  await page.goto(`${origin}/#/calendar?view=day&date=${date}`);
  await session("Private painting").waitFor();
  await session("Studio practice").waitFor();
  await session("Painting with friends").waitFor();
  checks += 3;
  await shot("01-personal-and-shared-mobile");
  await session("Private painting").click();
  await page
    .getByRole("button", { name: "Move this session", exact: true })
    .click();
  await page.getByLabel("When", { exact: true }).fill("15:30");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.ok(
    calls.some((c) => c.name === "change" && c.args.p_session === personalId),
  );
  checks++;
  await page.reload();
  await session("Private painting").waitFor();
  assert.ok(
    (await session("Private painting").getAttribute("aria-label"))?.includes(
      "3:30 PM",
    ),
  );
  checks++;
  await session("Painting with friends").click();
  await page
    .getByRole("button", { name: "Move this session", exact: true })
    .click();
  await page
    .getByText("This changes the time for everyone.", { exact: true })
    .waitFor();
  checks++;
  await shot("02-shared-reschedule-mobile");
  await page.keyboard.press("Escape");
  await session("Painting with friends").click();
  await page
    .getByRole("button", { name: "Skip this session", exact: true })
    .click();
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await page.waitForTimeout(6500);
  assert.ok(declined.has("meeting-" + sharedId));
  assert.equal(cancelled.has("meeting-" + sharedId), false);
  checks += 2;
  await page.reload();
  await session("Private painting").waitFor();
  assert.equal(await session("Painting with friends").count(), 0);
  await session("Studio practice").waitFor();
  checks += 2;
  let failed = true;
  let entryReads = 0;
  await context.route("**/rest/v1/calendar_entries*", async (route) => {
    entryReads++;
    if (failed)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unavailable" }),
      });
    else
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
  });
  await page.reload();
  await page.getByRole("alert").waitFor();
  assert.equal(await page.getByRole("button", { name: /^Free (day|evening|all|time|,)/ }).count(), 0);
  checks++;
  await shot("03-availability-retry-mobile");
  failed = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("alert").waitFor({ state: "hidden" });
  assert.ok(entryReads >= 2);
  checks++;
  assert.deepEqual(errors, []);
  console.log(
    `PASS: ${checks} Calendar browser checks; 3 real screenshots; no page errors.`,
  );
} catch (e) {
  console.error(
    "URL",
    page.url(),
    "ERRORS",
    errors,
    "ALERTS",
    await page.getByRole("alert").allTextContents(),
  );
  await shot("failure");
  throw e;
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}
