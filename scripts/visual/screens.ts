// The screens the harness visits, against the fixture backend. Add a screen
// here and it gets screenshots + detection at every width and theme.
import type { Page } from "playwright-core";
import { PURSUIT_ID, SPACE_SLUG } from "./fixtures.ts";

export interface Screen { name: string; route: string; setup?: (page: Page) => Promise<void>; widths?: number[] }

const click = (text: RegExp | string) => async (page: Page) => { await page.getByText(text).first().click({ timeout: 8000 }); await page.waitForTimeout(700); };

export const SCREENS: Screen[] = [
  { name: "my-space", route: "/my-space" },
  { name: "you", route: "/you" },
  { name: "studio-cover", route: "/u/maya/studio" },
  { name: "discover", route: "/discover" },
  { name: "log", route: "/create" },
  { name: "create-pursuit", route: "/pursuits/new" },
  { name: "messages", route: "/messages" },
  { name: "messages-thread", route: "/messages", setup: click("Want to pull shots together") },
  { name: "messages-new-message", route: "/messages", setup: click("New message") },
  { name: "pursuit", route: `/pursuit/${PURSUIT_ID}` },
  { name: "pursuit-add-moment", route: `/pursuit/${PURSUIT_ID}/moment` },
  { name: "space-table", route: `/space/${SPACE_SLUG}` },
  { name: "space-moments", route: `/space/${SPACE_SLUG}?tab=moments` },
  { name: "space-events", route: `/space/${SPACE_SLUG}?tab=events` },
  { name: "space-people", route: `/space/${SPACE_SLUG}?tab=people` },
  { name: "space-manage", route: `/space/${SPACE_SLUG}?tab=manage` },
  { name: "overlay-quicklog", route: "/my-space", widths: [375], setup: async (page) => { await page.locator('nav[aria-label="Main"] button:has-text("Create")').first().click({ timeout: 8000 }); await page.waitForTimeout(700); } },
];
