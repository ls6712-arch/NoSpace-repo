import { SITE_ORIGIN } from "../config";
import { notify } from "../components/ui/toaster";
import { goToPlan, tearOffHalf, type Owner } from "./firstPlanRemote";
import type { Plan } from "./firstPlan";
import type { HomeItem } from "./homeItems";
import { logSuggestionEvent, type LoggedKind, type SuggestionAction } from "./homeSuggestions";
import { track } from "./analytics";
import { ERROR_LINE } from "./stateCopy";

/** What a tap on a Home card does, and what is recorded about it. */

const LOGGED_KIND: Record<HomeItem["kind"], LoggedKind> = { event: "event", open_pursuit: "open_pursuit", at_home: "at_home" };

/** Counted by name in analytics, and written to the suggestion log once logging is switched on (config.ts). */
export function recordSuggestion(action: SuggestionAction, item: HomeItem, position: number): void {
  const name = `home_suggestion_${action}` as const;
  track({ name, kind: item.kind, position });
  void logSuggestionEvent({
    kind: LOGGED_KIND[item.kind],
    refId: item.refId,
    cornerKey: item.corner.key,
    position,
    score: item.score,
    reasons: item.reasons,
    action,
  });
}

/** The same shape the first plan uses, so Home reuses its "I'm going" actions. */
export function planFromItem(item: HomeItem): Plan {
  return {
    id: item.id,
    kind: item.kind === "event" ? "event" : item.kind === "open_pursuit" ? "open-pursuit" : "at-home",
    title: item.title,
    corner: item.corner,
    startsAt: item.startsAt,
    when: item.kind === "at_home" ? null : item.detail,
    reason: item.why ?? "",
    eventId: item.kind === "event" ? Number(item.refId) : undefined,
    pursuitId: item.kind === "open_pursuit" ? item.refId : undefined,
    step: item.step,
  };
}

/** I'm going (an event), Ask to join (an open Pursuit). Start is not here: it opens the Log form. */
export async function commitToItem(item: HomeItem, owner: Owner): Promise<{ ok: true; requested: boolean } | { ok: false; error: string }> {
  if (item.kind === "at_home") return { ok: false, error: ERROR_LINE };
  const r = await goToPlan(planFromItem(item), owner);
  return r.error ? { ok: false, error: r.error } : { ok: true, requested: !!r.requested };
}

/** A link to send a friend, with the share sheet where there is one and a copied link where there is not. */
export async function inviteToItem(item: HomeItem, owner: Owner): Promise<{ ok: boolean; error?: string }> {
  let url: string;
  if (item.kind === "at_home") {
    const r = await tearOffHalf(planFromItem(item), owner);
    if (!r.half) return { ok: false, error: r.error ?? ERROR_LINE };
    url = r.half.url;
  } else {
    url = `${SITE_ORIGIN}/#/space/${item.spaceSlug ?? ""}${item.kind === "event" ? "?tab=events" : ""}`;
  }
  return shareUrl(item.title, url);
}

/** The share sheet where there is one, a copied link where there is not. Closing the sheet is not an error. */
export async function shareUrl(title: string, url: string): Promise<{ ok: boolean; error?: string }> {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title, url });
    } else {
      await navigator.clipboard.writeText(url);
      notify("Link copied");
    }
    return { ok: true };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return { ok: true };
    return { ok: false, error: ERROR_LINE };
  }
}

/** Where tapping a card's title or photo goes. */
export function openPathFor(item: HomeItem): string {
  if (item.kind === "at_home") return `/corners/${item.corner.slug}`;
  return `/space/${item.spaceSlug ?? ""}${item.kind === "event" ? "?tab=events" : ""}`;
}

/** Start: the Log form in that Corner. */
export const startPathFor = (item: HomeItem) => `/create?hobby=${encodeURIComponent(item.corner.spaceSlug)}&sub=${encodeURIComponent(item.corner.slug)}`;
