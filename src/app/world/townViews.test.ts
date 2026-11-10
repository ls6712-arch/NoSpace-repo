import { describe, expect, it } from "vitest";
import type { TabKey } from "../lib/routeHandle";
import { TOWN_CAMERAS, viewForTab } from "./townViews";

describe("town views", () => {
  it("gives every tab a view the town knows how to show", () => {
    const tabs: TabKey[] = ["my-space", "discover", "create", "calendar", "inbox", "you"];
    for (const tab of tabs) expect(TOWN_CAMERAS[viewForTab(tab)]).toBeDefined();
  });

  it("shows the whole park on a screen with no tab", () => {
    expect(viewForTab(undefined)).toBe("wide");
  });

  it("gives each tab its own corner of the park", () => {
    const tabs: TabKey[] = ["my-space", "discover", "create", "calendar", "inbox", "you"];
    expect(new Set(tabs.map(viewForTab)).size).toBe(tabs.length);
  });
});
