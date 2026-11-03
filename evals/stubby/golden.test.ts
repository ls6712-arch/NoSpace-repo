import { describe, it, expect } from "vitest";
import { scenarios, input, candidate, NOW } from "./fixtures.ts";
import { evaluate } from "./run.ts";
import { runV3 } from "../../supabase/functions/stubby-scout/v3/orchestrator.ts";
import { buildContext } from "../../supabase/functions/stubby-scout/v3/context.ts";
import { dayWindow } from "../../supabase/functions/stubby-scout/intent.ts";
import { emptyCapability } from "../../supabase/functions/_shared/capabilityProfile.ts";
import { safeSourceUrl } from "../../supabase/functions/stubby-scout/v3/evidence.ts";

describe("V3 golden constraints", () => {
  for (const s of scenarios) it(s.id, async () => {
    const r = await runV3(input(s.input), { discovery: [{ id: "fixture", discover: async () => s.candidates }] });
    expect(r.outcome).toBe(s.outcome);
    if (s.reason) expect(r.dropped.map(d => d.reason)).toContain(s.reason);
    if (r.outcome === "no_verified_match") expect(r.fallback).toMatch(/No verified match/);
  });
  it("executes the baseline and generates a structured comparison", async () => {
    const r = await evaluate(); expect(r.passed).toBe(r.total); expect(r.total).toBeGreaterThan(20);
    expect(r.rows.find(x => x.id === "unknown-paid-price")?.baselineKept).toBeGreaterThan(0);
  });
});
describe("context, privacy and outages", () => {
  it.each([
    ["2026-03-08", "America/New_York", 23], ["2026-11-01", "America/New_York", 25],
    ["2026-11-01", "America/Los_Angeles", 25], ["2026-03-08", "Asia/Kolkata", 24],
  ])("day length %s in %s", (day, tz, hours) => {
    const w = dayWindow(day, Date.parse("2026-01-01Z"), tz)!;
    expect((w.endMs - w.startMs) / 3600000).toBe(hours);
  });
  it("uses the server clock and chosen timezone across local midnight", () => {
    const r = input({ now: Date.parse("2026-11-04T06:00:00Z"), capability: { ...input().capability, timeZone: "America/Los_Angeles" } });
    expect(buildContext(r).window.endMs).toBe(Date.parse("2026-11-04T08:00:00Z"));
  });
  it("revocation removes all explicit and learned context", () => {
    const ctx = buildContext(input({ capability: { ...emptyCapability(), equipment: ["guitar"], goals: ["secret"] }, learned: [{ source: "feedback", title: "private", signal: "up" }] }));
    expect(ctx.equipment).toEqual([]); expect(ctx.goals).toEqual([]); expect(ctx.learned).toEqual([]); expect(ctx.city).toBeNull();
  });
  it("feedback requires separate opt-in", () => {
    expect(buildContext(input({ learned: [{ source: "feedback", title: "test", signal: "down" }] })).learned).toEqual([]);
  });
  it("rejects unsafe URLs including credential and local network literals", () => {
    for (const u of ["https://a:b@example.org/a", "https://127.0.0.1/a", "https://localhost/a", "https://192.168.1.1/a", "https://[::1]/a", "https://example.org:8443/a", "data:text/html,x"]) expect(safeSourceUrl(u)).toBeNull();
  });
  it("honestly reports a provider outage", async () => {
    const r = await runV3(input(), { discovery: [{ id: "fixture", discover: async () => { throw new Error("private credential must not leak"); } }] });
    expect(r.outcome).toBe("no_verified_match"); expect(JSON.stringify(r)).not.toContain("credential"); expect(r.warnings).toContain("Source unavailable: fixture.");
  });
  it("times out an adapter that ignores abort", async () => {
    const r = await runV3(input(), { timeoutMs: 5, discovery: [{ id: "hang", discover: () => new Promise(() => {}) }] });
    expect(r.outcome).toBe("no_verified_match"); expect(r.warnings).toContain("Discovery timed out.");
  });
  it("weather failure stays unknown and never implies sunshine", async () => {
    const r = await runV3(input({ text: "free outdoor pottery tonight" }), { discovery: [{ id: "fixture", discover: async () => [candidate({ setting: "outdoor", cost: { max: 0, currency: "USD" } })] }], context: { weather: async () => { throw new Error("offline"); } } });
    expect(r.outcome).toBe("partial"); expect(r.recommendations[0].uncertainties).toContain("Weather could not be checked.");
  });
  it("unsafe weather and occupied calendars are hard filters", async () => {
    const source = { id: "fixture", discover: async () => [candidate()] };
    const r = await runV3(input(), { discovery: [source], context: { calendar: async () => [{ startsAt: NOW, endsAt: NOW + 6 * 3600000 }] } });
    expect(r.dropped[0].reason).toBe("calendar_conflict");
    const outdoor = await runV3(input({ text: "outside pottery tonight" }), { discovery: [{ ...source, discover: async () => [candidate({ setting: "outdoor" })] }], context: { weather: async () => "unsafe" } });
    expect(outdoor.dropped[0].reason).toBe("weather");
  });
  it("deduplicates and diversifies without relaxing constraints", async () => {
    const rows = [candidate(), candidate(), candidate({ id: "fixture-2", title: "Another pottery", tags: ["pottery"] }), candidate({ id: "fixture-3", title: "Drawing", tags: ["drawing"] })];
    const r = await runV3(input(), { discovery: [{ id: "fixture", discover: async () => rows }] });
    expect(r.recommendations.map(x => x.candidate.title)).toEqual(["Indoor pottery", "Drawing", "Another pottery"]);
  });
});
