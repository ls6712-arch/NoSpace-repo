import { buildContext } from "./context.ts";
import { discover } from "./discovery.ts";
import { rankCandidates } from "./recommendation.ts";
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
      fallback: ctx.issues.includes("budget") ? "No verified match. Use a budget in US dollars so Stubby can check the price." : "No verified match. Choose a clear date and time so Stubby can check what fits.",
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
    const ranked = rankCandidates(result.candidates, ctx, input.exclude);
    if (warnings.length) for (const recommendation of ranked.recommendations) {
      recommendation.verification = "partial";
      recommendation.uncertainties = [...new Set([...recommendation.uncertainties, ...warnings])];
    }
    const allVerified = ranked.recommendations.length > 0 && ranked.recommendations.every(r => r.verification === "verified");
    return { version: V3_VERSION, outcome: allVerified ? "verified" : ranked.recommendations.length ? "partial" : "no_verified_match",
      ...ranked, fallback: ranked.recommendations.length ? null : "No verified match. Try another day or an activity using what you already have.",
      warnings: [...new Set(warnings)], usage: { ...(deps.usage ?? { input: 0, output: 0, calls: 0 }) } };
  } finally { clearTimeout(timer); }
}
