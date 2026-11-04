import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import fs from "node:fs";
const origin = process.env.PURSUIT_TEST_ORIGIN || "http://127.0.0.1:5174";
const out = "docs/qa/pursuit-personal-sessions";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
  timezoneId: "America/New_York",
});
await page.route("**/*", (r) =>
  r.request().url().startsWith(origin) ||
  /^(data:|blob:)/.test(r.request().url())
    ? r.continue()
    : r.abort(),
);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let checks = 0;
async function shot(name) {
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
    const owner = {
      userId: "local",
      displayName: "You",
      role: "owner",
      status: "joined",
    };
    const base = {
      title: "Mindfulness",
      startedAt: now,
      ownerId: "local",
      role: "owner",
      shared: false,
      measure: {
        kind: "count",
        target: 0,
        unit: "",
        allowPartial: false,
        allowDecimals: false,
        defaultAmount: 1,
        startingAmount: 0,
        workflow: { version: 2, tracking: "updates", unit: "", items: [] },
      },
    };
    const personal = {
      ...base,
      id: "personal-session-review",
      mode: "solo",
      members: [owner],
    };
    const friends = {
      ...base,
      title: "Mindfulness with friends",
      id: "friend-session-review",
      mode: "together",
      members: [
        owner,
        {
          userId: "maya",
          displayName: "Maya",
          role: "member",
          status: "joined",
        },
      ],
    };
    localStorage.setItem(
      "sushii.journal.v1",
      JSON.stringify({
        projects: [personal, friends],
        progress: [],
        entryProject: {},
        progressHistory: {},
        saved: [],
      }),
    );
    const data = {};
    for (const p of [personal, friends])
      data[p.id] = {
        contributions: [],
        goals: [],
        messages: [],
        sessions: [
          {
            id: `${p.id}-next`,
            pursuit_id: p.id,
            user_id: "local",
            title: "Next practice",
            starts_at: new Date(now + 86400000).toISOString(),
            timezone: "America/New_York",
            place: "",
            note: "",
            series_id: "weekly",
            cancelled: false,
          },
          {
            id: `${p.id}-past`,
            pursuit_id: p.id,
            user_id: "local",
            title: "Previous practice",
            starts_at: new Date(now - 86400000).toISOString(),
            timezone: "America/New_York",
            place: "",
            note: "",
            series_id: "old",
            cancelled: false,
          },
        ],
        attendance:
          p === friends
            ? [
                {
                  session_id: `${p.id}-next`,
                  pursuit_id: p.id,
                  user_id: "maya",
                  going: false,
                },
              ]
            : [],
        applause: [],
        notices: [],
      };
    localStorage.setItem("sushii.pursuitWorkflow.v2", JSON.stringify(data));
  });
  await page.goto(`${origin}/#/pursuit/personal-session-review`);
  await page.reload();
  await page.getByText("Next practice", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "I’m in", exact: true }).count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Can’t make it", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Discuss", exact: true }).count(),
    0,
  );
  checks += 3;
  await page.getByText("Just me", { exact: true }).waitFor();
  checks++;
  assert.equal(
    await page.getByText("Previous practice", { exact: true }).isVisible(),
    false,
  );
  checks++;
  await shot("01-personal-session-mobile");
  await page
    .getByRole("button", { name: "Plan a session", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Just me", { exact: true })
    .waitFor();
  checks++;
  await page.keyboard.press("Escape");
  await page.getByText("Past sessions", { exact: true }).click();
  await page.getByText("Previous practice", { exact: true }).waitFor();
  checks++;
  await shot("02-personal-history-mobile");
  await page.getByText("Past sessions", { exact: true }).click();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByText("No sessions planned.", { exact: true }).waitFor();
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("sushii.pursuitWorkflow.v2"))[
        "personal-session-review"
      ],
  );
  assert.equal(
    saved.sessions.find((s) => s.id.endsWith("-next")).cancelled,
    true,
  );
  assert.equal(
    saved.sessions.find((s) => s.id.endsWith("-past")).cancelled,
    false,
  );
  assert.equal(saved.contributions.length, 0);
  checks += 3;
  await page.reload();
  await page.getByText("No sessions planned.", { exact: true }).waitFor();
  checks++;
  await page.goto(`${origin}/#/pursuit/friend-session-review`);
  await page.getByRole("heading", { name: "Friends", exact: true }).waitFor();
  await page.getByText("Can’t make it: Maya", { exact: true }).waitFor();
  checks += 2;
  await page.getByRole("button", { name: "I’m in", exact: true }).click();
  await page.reload();
  await page.getByText("Can’t make it: Maya", { exact: true }).waitFor();
  const shared = await page.evaluate(() => ({
    data: JSON.parse(localStorage.getItem("sushii.pursuitWorkflow.v2"))[
      "friend-session-review"
    ],
    project: JSON.parse(
      localStorage.getItem("sushii.journal.v1"),
    ).projects.find((p) => p.id === "friend-session-review"),
  }));
  assert.ok(
    shared.data.attendance.some((a) => a.user_id === "local" && a.going),
  );
  assert.equal(shared.project.shared, false);
  assert.equal(shared.data.contributions.length, 0);
  checks += 3;
  await shot("03-friends-session-mobile");
  assert.deepEqual(errors, []);
  console.log(
    `PASS: ${checks} session browser checks; 3 real screenshots; no page errors.`,
  );
} catch (e) {
  console.error("URL", page.url(), "ERRORS", errors);
  await shot("failure");
  throw e;
} finally {
  await browser.close();
}
