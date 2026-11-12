import { V3_VERSION } from "../../supabase/functions/stubby-scout/v3/types.ts";
import { scenarios, input } from "./fixtures.ts";
import { runV3 } from "../../supabase/functions/stubby-scout/v3/orchestrator.ts";
import { checkAskPicks } from "../../supabase/functions/stubby-scout/ask.ts";
import { readIntent, searchWindow } from "../../supabase/functions/stubby-scout/intent.ts";
import { linkKey, msToNyLocal } from "../../supabase/functions/stubby-scout/picks.ts";
/** Same frozen synthetic records through both real engines, not model-to-model claims. */
export async function evaluate() {
  const rows = [];
  for (const s of scenarios) {
    const req = input(s.input);
    const v3 = await runV3(req, { discovery: [{ id: "fixture", discover: async () => s.candidates }] });
    const intent = readIntent(req.text, { now: req.now, monthlyBudget: req.profile.monthlyBudget });
    const baseline = checkAskPicks(s.candidates.map(c => ({ title: c.title, kind: c.kind, starts: msToNyLocal(c.startsAt), ends: c.endsAt === null ? null : msToNyLocal(c.endsAt), price: c.cost ? `$${c.cost.max}` : null, url: c.evidence[0].url })), {
      now: req.now, intent, window: searchWindow(intent, req.now), sourceLinks: new Set(s.candidates.map(c => linkKey(c.evidence[0].url)).filter((s): s is string => !!s)), sooshLinks: new Set<string>(), corners: new Map<string, number>(), pickedCornerIds: new Set<number>(), askText: req.text, latestMs: req.now + 14 * 86400000,
    });
    const pass = v3.outcome === s.outcome && (!s.reason || v3.dropped.some(d => d.reason === s.reason));
    rows.push({ id: s.id, pass, expected: s.outcome, actual: v3.outcome, baselineOutcome: baseline.outcome, baselineKept: baseline.kept.length, v3Kept: v3.recommendations.length, reasons: v3.dropped.map(d => d.reason) });
  }
  return { version: V3_VERSION, fixtureClock: new Date(input().now).toISOString(), liveProviders: false, total: rows.length, passed: rows.filter(r => r.pass).length, rows };
}
