import { supabase } from "../../lib/supabase";
import { suggestionLoggingEnabled } from "../config";
import { isPassKind, type PassKind } from "./tasteModel";

/**
 * What Home v2 reads and logs: the ranked things to do this week from
 * `home_suggestions()` and the log of what was shown and done
 * (`suggestion_events`), both from migration 20261109000000. Best effort: a
 * failure, or the migration not being live yet, means fewer suggestions and a
 * lost log row, never an error screen.
 */

export type ReasonCode = "fits_window" | "picked" | "affinity" | "friend_going" | "nearby" | "trending" | "pass" | "soon";
export const REASON_CODES: readonly ReasonCode[] = ["fits_window", "picked", "affinity", "friend_going", "nearby", "trending", "pass", "soon"];
const isReason = (v: unknown): v is ReasonCode => typeof v === "string" && (REASON_CODES as readonly string[]).includes(v);

/** What the server ranks. A friend's Pursuit is not offered yet. */
export type SuggestionKind = "event" | "open_pursuit";
/** What the log records, which adds the at-home rows the app fills in. */
export type LoggedKind = SuggestionKind | "friend_pursuit" | "at_home";
/** "start" is a tap on Start (the Start page opened); "going" is a plan made; "logged" is a Moment posted from the Start page. */
export type SuggestionAction = "shown" | "opened" | "start" | "going" | "invite" | "dismissed" | "logged";

export interface HomeSuggestion {
  kind: SuggestionKind;
  /** The event id or the Pursuit id, as text. */
  refId: string;
  /** "space-slug/corner-slug". */
  cornerKey: string;
  /** Milliseconds. */
  startsAt: number;
  /** A neighborhood or city, or the Pursuit session's place. */
  placeLabel: string | null;
  score: number;
  /** At most two, strongest first. */
  reasons: ReasonCode[];
  title: string;
  spaceSlug: string;
  /** A first name; only set when `reasons` has friend_going. */
  friendName: string | null;
  /** Only set when `reasons` has pass. */
  passKind: PassKind | null;
}

interface Row {
  kind?: unknown;
  ref_id?: unknown;
  corner_key?: unknown;
  starts_at?: unknown;
  place_label?: unknown;
  score?: unknown;
  reasons?: unknown;
  title?: unknown;
  space_slug?: unknown;
  friend_name?: unknown;
  pass_kind?: unknown;
}

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** One database row to a suggestion, or null when it is not one the app can show. */
export function mapSuggestionRow(row: Row): HomeSuggestion | null {
  const kind = row.kind === "event" || row.kind === "open_pursuit" ? row.kind : null;
  const refId = text(row.ref_id);
  const cornerKey = text(row.corner_key);
  const title = text(row.title);
  const startsAt = typeof row.starts_at === "string" ? Date.parse(row.starts_at) : NaN;
  if (!kind || !refId || !cornerKey || !title || !Number.isFinite(startsAt)) return null;
  const reasons = (Array.isArray(row.reasons) ? row.reasons : []).filter(isReason).slice(0, 2);
  const pass = text(row.pass_kind);
  return {
    kind,
    refId,
    cornerKey,
    startsAt,
    placeLabel: text(row.place_label),
    score: typeof row.score === "number" ? row.score : Number(row.score) || 0,
    reasons,
    title,
    spaceSlug: text(row.space_slug) ?? "",
    friendName: reasons.includes("friend_going") ? text(row.friend_name) : null,
    passKind: reasons.includes("pass") && pass && isPassKind(pass) ? pass : null,
  };
}

export async function fetchHomeSuggestions(limit = 8): Promise<HomeSuggestion[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.rpc("home_suggestions", { p_limit: limit });
    if (error || !Array.isArray(data)) return [];
    return (data as Row[]).flatMap((r) => {
      const s = mapSuggestionRow(r);
      return s ? [s] : [];
    });
  } catch {
    return [];
  }
}

export interface SuggestionLog {
  kind: LoggedKind;
  refId: string;
  cornerKey?: string | null;
  /** Zero-based place in the list. */
  position: number;
  score?: number | null;
  reasons?: readonly ReasonCode[];
  action: SuggestionAction;
}

/**
 * Fire and forget: a lost row only costs a little learning. Does nothing while
 * `suggestionLoggingEnabled` (config.ts) is off, which it is until the Privacy
 * Policy line about this log is live.
 */
export async function logSuggestionEvent(e: SuggestionLog): Promise<void> {
  if (!suggestionLoggingEnabled || !supabase) return;
  try {
    await supabase.rpc("log_suggestion_event", {
      p_kind: e.kind,
      p_ref_id: e.refId,
      p_corner_key: e.cornerKey ?? null,
      p_position: Math.max(0, Math.min(Math.floor(e.position), 99)),
      p_score: e.score ?? null,
      p_reasons: (e.reasons ?? []).slice(0, 2),
      p_action: e.action,
    });
  } catch {
    // Offline or not deployed yet.
  }
}
