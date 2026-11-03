// Stubby agent (docs/briefs/stubby-agent.md, Part K3): every precedence rule, weight, threshold and
// decay period lives here, versioned. The version goes into every decision trace, so a pick can
// always be traced back to the rules that chose it. Change a value: bump the version.
//
// Pure: no network, no database, no Deno.

export const STUBBY_CONFIG = {
  /** Bump on any change below. Saved with every decision trace. */
  version: "2026-11-03.1",

  /**
   * Who wins when two sources disagree (B3), highest first. "ask" is what they typed now; "answer"
   * is a tap made for this ask (Stubby's question, This weekend), which is the person changing the
   * ask, so it counts with what they typed; "session" is a chip remembered from earlier asks.
   */
  precedence: ["ask", "answer", "session", "profile", "learned", "default"] as const,

  /** Starting score weights (C8), used from PR 10. Each component is 0 to 100. */
  weights: { request: 0.35, feasibility: 0.25, personal: 0.2, moment: 0.15, discovery: 0.05 },

  /** Situation profiles (C8) shift the weights; from PR 10. */
  profiles: {
    recharge: { feasibility: +0.1, discovery: -0.05 },
    explore: { discovery: +0.1, personal: -0.05 },
    continue: { personal: +0.1, discovery: -0.05 },
    connect: { personal: +0.05, request: +0.05 },
    specific: { request: +0.1, personal: -0.05 },
  },

  /** Inferred preferences fade after this many days (F2); explicit ones never do. From PR 5. */
  decayDays: 60,

  /** The deck (C9): the best few, more only when justified. */
  deck: { best: 3, most: 5, friendPicksMost: 1 },

  /** Drop reasons and decision traces saved with an ask. */
  saved: { dropReasonsMost: 30, tracePicksMost: 10 },
} as const;

export type Source = (typeof STUBBY_CONFIG.precedence)[number];

/** The highest-precedence value that's there, with where it came from. Null when none is. */
export function byPrecedence<T>(candidates: Partial<Record<Source, T | null | undefined>>): { value: T; from: Source } | null {
  for (const s of STUBBY_CONFIG.precedence) {
    const v = candidates[s];
    if (v !== null && v !== undefined) return { value: v, from: s };
  }
  return null;
}
