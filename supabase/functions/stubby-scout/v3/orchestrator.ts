import { buildContext } from "./context.ts";
import { discover } from "./discovery.ts";
import { rankCandidates } from "./recommendation.ts";
import { isSoosh } from "./evidence.ts";
import { V3_VERSION, type ContextAdapter, type DiscoveryAdapter, type RequestInput, type V3Report } from "./types.ts";
export async function runV3(input: RequestInput, deps: { discovery: DiscoveryAdapter[]; context?: ContextAdapter; usage?: V3Report["usage"]; timeoutMs?: number }): Promise<V3Report> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(deps.timeoutMs ?? 35000, 45000));
  const signal = controller.signal;
  // Race every adapter as well as aborting fetch: a broken plugin must not keep an ask alive forever.
  const bounded = <T>(p: Promise<T>): Promise<T> => new Promise((resolve, reject) => {
    const abort = () => reject(new Error("Timeout"));
    signal.addEventListener("abort", abort, { once: true });
    p.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
  const warnings: string[] = [];
  try {
    const ctx = buildContext(input);
    if (ctx.issues.length || ctx.window.endMs <= ctx.window.startMs) return {
      version: V3_VERSION, outcome: "no_verified_match", recommendations: [], dropped: [],
      fallback: ctx.issues.includes("location") ? "No verified match. Confirm your city before Stubby searches nearby." : ctx.issues.includes("budget") ? "No verified match. Use a budget in US dollars so Stubby can check the price." : "No verified match. Choose a clear date and time so Stubby can check what fits.",
      warnings: [], usage: { input: 0, output: 0, calls: 0 },
    };
    if (deps.context?.weather) {
      try { const w = await bounded(deps.context.weather(ctx, signal)); ctx.weather = w === "safe" || w === "unsafe" ? w : "unknown"; }
      catch { warnings.push("Weather could not be checked."); }
    }
    if (deps.context?.calendar) {
      try {
        const busy = await bounded(deps.context.calendar(ctx, signal));
        if (!Array.isArray(busy) || busy.length > 200 || busy.some(b => !Number.isFinite(b.startsAt) || !Number.isFinite(b.endsAt) || b.endsAt <= b.startsAt)) throw new Error("Invalid calendar");
        ctx.busy = busy;
      } catch { warnings.push("Calendar availability could not be checked."); }
    }
    let result: Awaited<ReturnType<typeof discover>>;
    try { result = await bounded(discover(deps.discovery, ctx, input.text, signal)); }
    catch { result = { candidates: [], warnings: ["Discovery timed out."] }; }
    warnings.push(...result.warnings);
    let ranked = rankCandidates(result.candidates, ctx, input.exclude);
    let after = false;
    // Nothing in the time asked for: the soonest good ones in the 7 days after it, marked (legacy
    // engine, founder Nov 2, 2026). Every rule but the time still applies.
    if (ranked.recommendations.length === 0 && ctx.window.hard) {
      const later = { ...ctx, window: { ...ctx.window, startMs: ctx.window.endMs, endMs: ctx.window.endMs + 7 * 24 * 3600000, hard: false } };
      const soonest = rankCandidates(result.candidates.filter(c => c.kind !== "idea" && c.startsAt >= ctx.window.endMs), later, input.exclude);
      if (soonest.recommendations.length) {
        soonest.recommendations.sort((a, b) => a.candidate.startsAt - b.candidate.startsAt);
        for (const r of soonest.recommendations) r.after = true;
        ranked = { recommendations: soonest.recommendations, dropped: ranked.dropped };
        after = true;
      }
    }
    // A source that failed says nothing about their own Pursuits and Corners.
    if (warnings.length) for (const recommendation of ranked.recommendations.filter(r => !isSoosh(r.candidate))) {
      recommendation.verification = "partial";
      recommendation.uncertainties = [...new Set([...recommendation.uncertainties, ...warnings])];
    }
    const allVerified = ranked.recommendations.length > 0 && ranked.recommendations.every(r => r.verification === "verified");
    return { version: V3_VERSION, outcome: allVerified ? "verified" : ranked.recommendations.length ? "partial" : "no_verified_match", after, cityFrom: ctx.cityFrom,
      ...ranked, fallback: ranked.recommendations.length ? null : "No verified match. Try another day or an activity using what you already have.",
      warnings: [...new Set(warnings)], usage: { ...(deps.usage ?? { input: 0, output: 0, calls: 0 }) } };
  } finally { clearTimeout(timer); }
}
