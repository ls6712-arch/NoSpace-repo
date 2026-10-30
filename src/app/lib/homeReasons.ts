import { windowPhrase } from "./homeWeek";
import { PASS_KINDS } from "./tasteModel";
import type { ReasonCode } from "./homeSuggestions";

/**
 * The one "why" line on a Home card: up to two reasons, joined with " · ".
 * The words only repeat what is true (the firstPlan.ts rule): a window is
 * named only when the start time is in it, a friend only when the server sent
 * a name, a pass is named, never turned into a price.
 *
 * Only the wording the founder approved on Oct 30, 2026 is shown. The three
 * codes below it have proposed wording that is NOT approved; it stays off until
 * HOME_SHOW_PROPOSED_REASONS is set, so a row whose reasons are only those shows
 * no why line rather than invented copy.
 */

/** Set to true when the proposed wording below is approved (docs/glossary.md, Home v2). */
export const HOME_SHOW_PROPOSED_REASONS = false;

/** Proposed, not approved. */
export const PROPOSED_REASON_COPY: Partial<Record<ReasonCode, string>> = {
  nearby: "Close to you",
  trending: "People are joining",
  soon: "Starting soon",
};

export interface ReasonInput {
  reasons: readonly ReasonCode[];
  startsAt: number | null;
  friendName: string | null;
  passKind: string | null;
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
    case "pass": {
      const kind = PASS_KINDS.find((k) => k.kind === input.passKind);
      return kind ? `Your ${kind.label.toLowerCase()} pass` : null;
    }
    case "affinity":
      return "You might like this";
    default:
      return HOME_SHOW_PROPOSED_REASONS ? (PROPOSED_REASON_COPY[code] ?? null) : null;
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
