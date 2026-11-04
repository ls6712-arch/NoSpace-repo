import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = process.env.PURSUIT_TEST_ORIGIN || "http://127.0.0.1:5173";
const out = "docs/qa/pursuits-compatibility";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
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
async function text(value) {
  await page.getByText(value, { exact: true }).first().waitFor();
  checks++;
}
async function screenshot(name) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
}
try {
  await page.goto(origin);
  await page.evaluate(() => {
    localStorage.clear();
    const now = Date.now();
    const base = { startedAt: now, mode: "solo", role: "owner" };
    const measure = {
      kind: "count",
      target: 10,
      unit: "paintings",
      allowDecimals: false,
      allowPartial: false,
      defaultAmount: 1,
      startingAmount: 2,
      whatCounts: "One finished painting",
    };
    localStorage.setItem(
      "sushii.journal.v1",
      JSON.stringify({
        projects: [
          {
            ...base,
            id: "old-paintings",
            title: "Make ten paintings",
            measure,
          },
          {
            ...base,
            id: "old-number",
            title: "Finish my reading list",
            goal: {
              id: "g",
              shape: "number",
              targetNumber: 10,
              current: 4,
              unit: "books",
              label: "Read ten books",
              createdAt: now,
            },
          },
          {
            ...base,
            id: "old-moments",
            title: "Try ten recipes",
            targetMoments: 10,
          },
          {
            ...base,
            id: "old-paused",
            title: "A little pottery",
            pausedAt: now,
            measure,
          },
          {
            ...base,
            id: "old-finished",
            title: "My first collection",
            finishedAt: now,
            measure,
          },
          {
            ...base,
            id: "old-updates",
            title: "Feel at home in the kitchen",
            goal: {
              id: "feeling",
              shape: "feeling",
              label: "Cook more confidently",
              createdAt: now,
            },
          },
        ],
        progress: [
          {
            id: "original-entry",
            projectId: "old-paintings",
            userId: "local",
            amount: 3,
            note: "Finished the first few studies.",
            createdAt: now - 86400000,
            image: "original.jpg",
          },
        ],
        entryProject: {},
        saved: [],
        progressHistory: {},
      }),
    );
  });
  await page.goto(`${origin}/#/pursuit/old-paintings`);
  await page.reload();
  await text("5 of 10 paintings");
  await text("One finished painting");
  await screenshot("01-existing-paintings");
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  const amount = page.getByLabel("paintings", { exact: true });
  await amount.fill("4");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await text("6 of 10 paintings");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sushii.journal.v1")).progress.find(
      (e) => e.id === "original-entry",
    ),
  );
  assert.equal(saved.amount, 4);
  assert.equal(saved.image, "original.jpg");
  assert.equal(saved.userId, "local");
  checks++;
  await page.reload();
  await text("6 of 10 paintings");
  await page.getByRole("button", { name: "Add progress", exact: true }).click();
  await page.getByLabel("paintings", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Add progress", exact: true })
    .last()
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await text("7 of 10 paintings");
  await page.reload();
  await text("7 of 10 paintings");
  await page.goto(`${origin}/#/pursuit/old-number`);
  await text("4 of 10 books");
  await text("Read ten books");
  await screenshot("02-existing-number");
  await page.goto(`${origin}/#/pursuit/old-moments`);
  await text("0 of 10 Moments");
  assert.equal(
    await page
      .getByRole("button", { name: "Add progress", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("link", { name: "Log a Moment", exact: true })
    .first()
    .waitFor();
  checks++;
  await screenshot("03-existing-moments");
  await page.goto(`${origin}/#/pursuit/old-paused`);
  await text("Paused");
  await screenshot("04-existing-paused");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page
    .getByRole("button", { name: "Add progress", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: "Add progress", exact: true })
    .waitFor();
  assert.ok(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("sushii.journal.v1")).projects.find(
          (p) => p.id === "old-paused",
        ).pausedAt,
    ),
  );
  checks++;

  await page.goto(`${origin}/#/pursuit/old-finished`);
  await text("Finished");
  await page.getByRole("button", { name: "Reopen", exact: true }).click();
  await page
    .getByRole("button", { name: "Add progress", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: "Add progress", exact: true })
    .waitFor();
  checks++;

  await page.goto(`${origin}/#/pursuit/old-updates`);
  await text("Cook more confidently");
  await screenshot("05-existing-updates");
  await page.goto(`${origin}/#/pursuits/new`);
  await page.getByLabel("What do you want to do?").waitFor();
  assert.equal(await page.getByText("Category", { exact: true }).count(), 0);
  checks++;
  await screenshot("06-unified-creation");
  assert.deepEqual(errors, []);
  console.log(
    `PASS: ${checks} compatibility browser checks; 6 real screenshots; no page errors.`,
  );
} catch (e) {
  console.error("URL", page.url(), "ERRORS", errors);
  await screenshot("failure");
  throw e;
} finally {
  await browser.close();
}
