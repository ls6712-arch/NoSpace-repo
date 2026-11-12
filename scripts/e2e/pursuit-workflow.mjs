import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = process.env.PURSUIT_TEST_ORIGIN || "http://127.0.0.1:5173";
const out = "docs/qa/pursuits-workflow";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
  timezoneId: "America/New_York",
});
await page.route("**/*", (route) =>
  route.request().url().startsWith(origin) ||
  /^(data:|blob:)/.test(route.request().url())
    ? route.continue()
    : route.abort(),
);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let checks = 0;
async function check(text, expected = true) {
  await page
    .getByText(text, { exact: true })
    .first()
    .waitFor({ state: expected ? "visible" : "hidden" });
  checks++;
}
async function create(name, type = "Sessions", target = "10") {
  await page.goto(`${origin}/#/pursuits/new`);
  await page.getByLabel("What do you want to do?").fill(name);
  await page.getByText(type, { exact: true }).click();
  if (type === "Sessions" || type === "Total")
    await page.getByLabel("Target · Optional", { exact: true }).fill(target);
  if (type === "Total")
    await page.getByLabel("Unit", { exact: true }).fill("pages");
  if (type === "Checklist") {
    await page
      .getByRole("button", { name: "Add a checklist item", exact: true })
      .click();
    await page
      .getByLabel("Checklist item", { exact: true })
      .fill("Make the first sketch");
  }
  await page
    .getByRole("button", { name: "Start a Pursuit", exact: true })
    .click();
  await page.waitForURL(/#\/pursuit\//, { waitUntil: "domcontentloaded" });
  checks++;
}
try {
  await page.goto(origin);
  await page.evaluate(() => localStorage.clear());
  await create("Guitar practice");
  await check("0 of 10 sessions");
  await page.getByRole("button", { name: "Add progress", exact: true }).click();
  await page
    .getByLabel("Add a note · Optional")
    .fill("Played the chorus without stopping.");
  await page
    .getByRole("button", { name: "Add progress", exact: true })
    .last()
    .click();
  await check("1 of 10 sessions");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `${out}/01-progress-mobile.png`,
    fullPage: true,
  });
  await page.reload();
  await check("1 of 10 sessions");
  await page
    .getByRole("button", { name: "Edit your goal", exact: true })
    .click();
  await page.getByLabel("Target · Optional", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await check("1 of 8 sessions");
  await page.getByRole("button", { name: "Pursuit options" }).click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await check("1 of 8 sessions");
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `${out}/02-finish-mobile.png`,
    fullPage: false,
  });
  await page
    .getByRole("button", { name: "Finish Pursuit", exact: true })
    .click();
  await check("Finished");
  await page.getByRole("button", { name: "Reopen", exact: true }).click();
  await check("1 of 8 sessions");
  await page
    .getByRole("button", { name: /comment/ })
    .first()
    .click();
  await page
    .getByLabel("Add a thought", { exact: true })
    .fill("The slower tempo helped.");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await check("The slower tempo helped.");
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `${out}/03-comment-mobile.png`,
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await create("Read this summer", "Total", "500");
  await check("0 of 500 pages");
  await page.getByRole("button", { name: "Add progress", exact: true }).click();
  await page.getByLabel("pages", { exact: true }).fill("120");
  await page
    .getByRole("button", { name: "Add progress", exact: true })
    .last()
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await check("120 of 500 pages");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `${out}/04-total-desktop.png`,
    fullPage: true,
  });
  await create("Make a bowl", "Checklist");
  await check("0 of 1 item");
  await page
    .getByRole("checkbox", { name: "Make the first sketch", exact: true })
    .check();
  await check("1 of 1 item");
  await page
    .getByRole("checkbox", { name: "Make the first sketch", exact: true })
    .uncheck();
  await check("0 of 1 item");
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `${out}/05-checklist-desktop.png`,
    fullPage: true,
  });
  await create("The garden", "Moments only");
  await check("Share how it’s going without counting progress.");
  await page.goto(`${origin}/#/pursuits/new`);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `${out}/06-create-desktop.png`,
    fullPage: true,
  });
  // Real components with local group fixtures; PostgreSQL authorization is tested separately.
  await page.evaluate(() => {
    const id = "friends-review";
    const workflow = {
      version: 2,
      tracking: "sessions",
      target: 10,
      unit: "sessions",
      items: [],
    };
    const project = {
      id,
      title: "Guitar with friends",
      startedAt: Date.now(),
      mode: "together",
      members: [
        {
          userId: "local",
          displayName: "You",
          status: "joined",
          role: "owner",
        },
        {
          userId: "maya",
          displayName: "Maya",
          status: "joined",
          role: "member",
        },
        { userId: "leo", displayName: "Leo", status: "joined", role: "member" },
      ],
      measure: {
        kind: "count",
        target: 10,
        unit: "sessions",
        allowPartial: false,
        allowDecimals: false,
        defaultAmount: 1,
        startingAmount: 0,
        workflow,
      },
    };
    const journal = JSON.parse(localStorage.getItem("sushii.journal.v1"));
    journal.projects.push(project);
    localStorage.setItem("sushii.journal.v1", JSON.stringify(journal));
    const now = new Date().toISOString();
    const sessionId = "00000000-0000-4000-8000-000000000001";
    const store = JSON.parse(
      localStorage.getItem("sushii.pursuitWorkflow.v2") || "{}",
    );
    store[id] = {
      contributions: [
        {
          id: "own-session",
          pursuit_id: id,
          user_id: "local",
          amount: 1,
          occurred_at: now,
          created_at: now,
          note: "The chorus finally clicked.",
        },
        {
          id: "maya-session",
          pursuit_id: id,
          user_id: "maya",
          amount: 1,
          occurred_at: now,
          created_at: now,
          note: "Tried the chord change.",
        },
      ],
      goals: [
        {
          pursuit_id: id,
          user_id: "maya",
          target: 6,
          status: "active",
          muted: false,
        },
        {
          pursuit_id: id,
          user_id: "leo",
          target: 8,
          status: "active",
          muted: false,
        },
      ],
      messages: [
        {
          id: "maya-message",
          pursuit_id: id,
          user_id: "maya",
          body: "Anyone practicing Sunday?",
          thread: "chat",
          parent_id: null,
          mentions: [],
          created_at: now,
        },
      ],
      sessions: [
        {
          id: sessionId,
          pursuit_id: id,
          user_id: "local",
          title: "Sunday practice",
          starts_at: new Date(Date.now() + 86400000).toISOString(),
          place: "Maya’s place",
          note: "Play the chorus together.",
          series_id: sessionId,
          timezone: "America/New_York",
          cancelled: false,
        },
      ],
      attendance: [],
      applause: [],
      notices: [],
    };
    localStorage.setItem("sushii.pursuitWorkflow.v2", JSON.stringify(store));
  });
  await page.goto(`${origin}/#/pursuit/friends-review`);
  await page.reload();
  await check("Guitar with friends");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "I’m in", exact: true }).click();
  await check("1 of 10 sessions");
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `${out}/07-friends-mobile.png`,
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Chat", exact: true }).click();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.getByRole('tab', { name:'Progress', exact:true }).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name:'Chat', exact:true }).getAttribute('aria-selected'), 'true');
  checks += 2;

  await page
    .getByLabel("Message your friends", { exact: true })
    .fill("Thanks @Maya for helping with the chord change.");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await check("Thanks @Maya for helping with the chord change.");
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: `${out}/08-chat-mobile.png`, fullPage: true });
  await page.getByRole("tab", { name: "Progress", exact: true }).click();
  await page
    .getByRole("button", { name: "Plan a session", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Weekly practice");
  await page.getByLabel("When", { exact: true }).fill("2026-11-15T15:00");
  await page.getByLabel("Repeat weekly", { exact: true }).check();
  await page.getByLabel("Repeat until", { exact: true }).fill("2026-11-29");
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `${out}/09-plan-session-mobile.png`,
    fullPage: false,
  });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.reload();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("sushii.pursuitWorkflow.v2"))[
          "friends-review"
        ].sessions.filter((s) => s.title === "Weekly practice").length,
    ),
    3,
  );
  checks++;
  assert.deepEqual(errors, []);
  console.log(
    `PASS: ${checks} workflow checks; 9 real screenshots. No page errors.`,
  );
} catch (e) {
  console.error(
    "URL",
    page.url(),
    "ERRORS",
    errors,
    "ALERTS",
    await page
      .getByRole("alert")
      .allTextContents()
      .catch(() => []),
  );
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
  throw e;
} finally {
  await browser.close();
}
