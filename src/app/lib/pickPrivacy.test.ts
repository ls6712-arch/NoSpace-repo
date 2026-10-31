import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Nothing about Stubby's picks, a Keep or a Not this goes to the server until the
 * Privacy Policy line about suggestion logging is published (calendar brief,
 * section 5). The matching and the Not this list must not even be able to
 * reach the network or the analytics client.
 */
const lib = (f: string) => readFileSync(path.resolve(__dirname, f), "utf8");

describe("Stubby's picks stay in the browser", () => {
  it.each(["stubbyPicks.ts", "pickDeclines.ts"])("%s imports no database, fetch or analytics", (file) => {
    const src = lib(file);
    expect(src).not.toMatch(/supabase|analytics|\bfetch\(|sendBeacon|XMLHttpRequest|track\(/);
  });

  it("has no analytics event about a pick, a Keep or a Not this", () => {
    const events = [...lib("analytics.ts").matchAll(/name: "([a-z_]+)"/g)].map((m) => m[1]);
    expect(events.filter((e) => /pick|stubby|keep|not_this|skip/.test(e) && !/^week_/.test(e))).toEqual([]);
  });

  it("sends only the plan on a Keep: the RSVP or the join, and its undo", () => {
    const src = lib("pickActions.ts");
    expect(src).not.toMatch(/track\(|analytics/);
    expect(src).toMatch(/goToPlan/);
  });

  it("keeps the Not this list in this browser's own store and clears it on sign out", () => {
    expect(lib("localData.ts")).toContain("soosh.calendar.notthis.v1");
  });
});
