// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageShell } from "./PageShell";

afterEach(cleanup);

describe("PageShell", () => {
  it("renders one title in the title step, an optional subtitle and action, and no back arrow", () => {
    render(
      <PageShell title="Week" subtitle="Oct 31 to Nov 6" action={<button type="button">Do it</button>}>
        <p>Body</p>
      </PageShell>,
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "Week" });
    expect(h1.className).toContain("text-title");
    expect(screen.getByText("Oct 31 to Nov 6")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Do it" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /back/i })).toBeNull();
  });

  it("keeps content to 1040px with 16, 24 and 32px gutters", () => {
    const { container } = render(<PageShell title="Week" />);
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("px-4");
    expect(outer.className).toContain("tab:px-6");
    expect(outer.className).toContain("desk:px-8");
    expect((outer.firstElementChild as HTMLElement).className).toContain("max-w-[1040px]");
  });
});

describe("tab pages", () => {
  const read = (f: string) => fs.readFileSync(path.resolve(__dirname, "../..", f), "utf8");
  const PAGES = ["pages/HomeFeed.tsx", "pages/Discover.tsx", "pages/SearchResults.tsx", "pages/Week.tsx", "pages/Messages.tsx", "pages/Inbox.tsx", "pages/Profile.tsx", "components/settings/SettingsShell.tsx"];

  it.each(PAGES)("%s uses PageShell and sets no width of its own", (f) => {
    const src = read(f);
    expect(src).toContain("PageShell");
    expect(src).not.toMatch(/max-w-(md|lg|xl|2xl|3xl|4xl|5xl)\b.*px-4|container mx-auto/);
  });

  it("keeps the retired Discover empty-slot line out of the Corner rows", () => {
    expect(read("lib/discoverCorners.ts")).not.toContain("Be the first");
    expect(read("components/discover/CornerTearCard.tsx")).not.toContain("Be the first");
  });

  it("keeps every other page on one of the two widths", () => {
    // Pages that set no width of their own. The Space pages are being redesigned and keep theirs until that lands;
    // Welcome, Join and Invite are small centred cards.
    const SKIP = new Set(["SpacePage.tsx", "SpaceRoute.tsx", "Welcome.tsx", "JoinPursuit.tsx", "InviteArrival.tsx", "DevKit.tsx"]);
    const dir = path.resolve(__dirname, "../../pages");
    const bad: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name) && !SKIP.has(e.name)) {
          const src = fs.readFileSync(p, "utf8");
          if (/container mx-auto|mx-auto[^"`]*max-w-(md|lg|xl|2xl|3xl|4xl|5xl|6xl)\b[^"`]*px-\d/.test(src)) bad.push(e.name);
        }
      }
    };
    walk(dir);
    expect(bad).toEqual([]);
  });
});
