// The screens the harness visits, against the fixture backend. Add a screen
// here and it gets screenshots + detection at every width and theme.
import type { Page } from "playwright-core";
import { PURSUIT_ID, PURSUIT3_ID, SPACE_SLUG } from "./fixtures.ts";

export interface Screen { name: string; route: string; setup?: (page: Page) => Promise<void>; widths?: number[] }

const click = (text: RegExp | string) => async (page: Page) => { await page.getByText(text).first().click({ timeout: 8000 }); await page.waitForTimeout(700); };


// Drops a generated photo into the camera screen's library input, as if picked, then waits for the caption screen.
const pickPhotos = (count: number) => async (page: Page) => {
  await page.evaluate(async (n) => {
    const files: File[] = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement("canvas"); c.width = 800; c.height = 1000;
      const g = c.getContext("2d")!; g.fillStyle = i === 0 ? "#f4efe6" : "#2d4a3a"; g.fillRect(0, 0, 800, 1000); g.fillStyle = "#c96f49"; g.beginPath(); g.arc(400, 500, 260, 0, 7); g.fill();
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.9));
      files.push(new File([blob], `pick-${i}.jpg`, { type: "image/jpeg" }));
    }
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]')).filter((el) => !el.capture);
    const input = inputs.find((el) => el.multiple) ?? inputs[0];
    const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, count);
  await page.getByPlaceholder("Add a thought").first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(900);
};

export const SCREENS: Screen[] = [
  // Core loop v1, PR 4: Home (the feed), Home with no follows, the old grid, and the Log sheet.
  { name: "home-feed", route: "/my-space", setup: async (page) => { await page.getByText("Love this").first().waitFor({ timeout: 8000 }); await page.waitForTimeout(700); } },
  { name: "home-empty", route: "/my-space", setup: async (page) => {
      await page.route("**/rest/v1/profile_follows*", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: "[]" }));
      await page.reload(); await page.getByText("Soosh is better with your people").waitFor({ timeout: 8000 }); await page.waitForTimeout(700);
    } },
  { name: "my-space", route: "/my-space/all" },
  { name: "home", route: "/" },
  // Core loop v1, PR 5: You (three tabs), the old page behind it, Search, Notifications.
  { name: "you", route: "/you", setup: async (page) => { await page.getByRole("button", { name: /Pasta|Pottery|Sourdough|Stub/ }).first().waitFor({ timeout: 8000 }).catch(() => undefined); await page.waitForTimeout(900); } },
  { name: "you-pursuits", route: "/you", setup: click("Pursuits") },
  { name: "you-moments", route: "/you", setup: click("Moments") },
  { name: "you-stub-open", route: "/you", setup: async (page) => { await page.getByRole("button", { name: /Open$/ }).first().click({ timeout: 8000 }); await page.waitForTimeout(900); } },
  { name: "you-all", route: "/you/all" },
  { name: "search", route: "/search?q=pottery", setup: async (page) => { await page.getByText("Activity", { exact: true }).first().waitFor({ timeout: 8000 }); await page.waitForTimeout(900); } },
  { name: "search-empty", route: "/search" },
  { name: "notifications", route: "/inbox", setup: async (page) => { await page.getByText("Needs you").first().waitFor({ timeout: 8000 }); await page.waitForTimeout(900); } },
  { name: "moment-multi-photo", route: "/moment/91" },
  { name: "studio-cover", route: "/u/maya/studio" },
  { name: "discover", route: "/discover" },
  { name: "corners", route: "/corners" },
  { name: "corner-pasta", route: "/corners/pasta" },
  { name: "corner-bbq", route: "/corners/bbq" },
  // Core loop v1: onboarding, the Make it a Pursuit sheet over a Corner, and the recap.
  { name: "onboarding", route: "/onboarding" },
  { name: "corner-pasta-sheet", route: "/corners/pasta", setup: click("Do this with people") },
  { name: "pursuit-recap", route: `/pursuit/${PURSUIT3_ID}/recap` },
  { name: "category-food", route: "/browse/food-drink" },
  { name: "log", route: "/create" },
  { name: "log-caption", route: "/create", setup: pickPhotos(3) },
  { name: "log-caption-sheet", route: "/create", setup: async (page) => { await pickPhotos(1)(page); await page.getByText("Counts toward").first().click({ timeout: 8000 }); await page.waitForTimeout(700); } },
  { name: "log-posted", route: "/create", setup: async (page) => {
      await pickPhotos(1)(page);
      await page.getByRole("button", { name: "Post", exact: true }).first().click({ timeout: 8000 }); await page.getByText("Posted to your followers").first().waitFor({ timeout: 8000 }); await page.waitForTimeout(1600);
    } },
  { name: "create-pursuit", route: "/pursuits/new" },
  { name: "messages", route: "/messages" },
  { name: "messages-thread", route: "/messages", setup: click("Want to pull shots together") },
  { name: "messages-new-message", route: "/messages", setup: click("New message") },
  { name: "pursuit", route: `/pursuit/${PURSUIT_ID}` },
  { name: "space-table", route: `/space/${SPACE_SLUG}` },
  { name: "space-moments", route: `/space/${SPACE_SLUG}?tab=moments` },
  { name: "space-events", route: `/space/${SPACE_SLUG}?tab=events` },
  { name: "space-people", route: `/space/${SPACE_SLUG}?tab=people` },
  { name: "space-manage", route: `/space/${SPACE_SLUG}?tab=manage` },
  // Pursuits-in-progress cards: one with a custom cover (signed URL), one falling back to its own Moment's photo.
  { name: "my-space-pursuit-cards", route: "/my-space/all", setup: async (page) => { await page.getByText("Pursuits in progress").first().waitFor({ timeout: 8000 }); await page.waitForTimeout(900); } },
  // A typed query shows the search box's own clear button (24px visible, 44px hit area on touch).
  { name: "my-space-search-clear", route: "/my-space/all", setup: async (page) => { const q = page.getByLabel("Search your Pursuits"); await q.scrollIntoViewIfNeeded({ timeout: 8000 }); await q.fill("pot"); await page.waitForTimeout(500); } },
  { name: "dialog-pursuit-cover", route: "/my-space/all", setup: async (page) => { await page.getByRole("button", { name: /Change the cover photo for Throw 24 bowls/ }).first().click({ timeout: 8000, force: true }); await page.waitForTimeout(700); } },
  { name: "dialog-pursuit-goal", route: "/my-space/all", setup: async (page) => { await page.getByRole("button", { name: /Edit the goal for Throw 24 bowls/ }).first().click({ timeout: 8000, force: true }); await page.waitForTimeout(700); } },
];
