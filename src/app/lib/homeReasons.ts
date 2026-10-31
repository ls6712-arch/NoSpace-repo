import { windowPhrase } from "./homeWeek";
import { PASS_KINDS } from "./tasteModel";
import type { ReasonCode } from "./homeSuggestions";

/**
 * The one "why" line on a Home card: up to two reasons, joined with " · ".
 * The words only repeat what is true (the firstPlan.ts rule): a window is
 * named only when the start time is in it, a friend only when the server sent
 * a name, a pass is named, never turned into a price.
 *
 * All of the wording is approved (founder, Oct 30, 2026; docs/glossary.md, Home v2).
 */

export interface ReasonInput {
  reasons: readonly ReasonCode[];
  startsAt: number | null;
  friendName: string | null;
  passKind: string | null;
}

/** "Your museum pass": the one wording for a pass, on Home and on Discover. Null for a kind we do not know. */
export function passLine(passKind: string | null): string | null {
  const kind = PASS_KINDS.find((k) => k.kind === passKind);
  return kind ? `Your ${kind.label.toLowerCase()} pass` : null;
}

function oneReason(code: ReasonCode, input: ReasonInput): string | null {
  switch (code) {
    case "fits_window": {
      const phrase = input.startsAt === null ? null : windowPhrase(input.startsAt);
      return phrase ? `Fits your ${phrase}` : null;
    }
    case "picked":
      return "One of your picks";
    case "friend_going":
      return input.friendName ? `${input.friendName}’s going` : null;
    case "pass":
      return passLine(input.passKind);
    case "affinity":
      return "You might like this";
    case "nearby":
      return "Close to you";
    case "trending":
      return "People are joining";
    case "soon":
      return "Starting soon";
  }
}

/** "Fits your Thursday evening · Priya’s going", or null when no reason has approved wording. */
export function reasonLine(input: ReasonInput): string | null {
  const parts = input.reasons.slice(0, 2).flatMap((c) => {
    const text = oneReason(c, input);
    return text ? [text] : [];
  });
  return parts.length > 0 ? parts.join(" · ") : null;
}
