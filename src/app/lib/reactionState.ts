import { useCallback, useSyncExternalStore } from "react";
import { LOCAL_CLEARED_EVENT } from "./localData";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";

/** Matches ContentContext.tsx's own ReactionId and the `reactions.type`
 * check constraint (supabase/migrations/20260919230300_reactions_and_
 * bookmarks.sql). "keepgoing" is retired — nothing writes or shows it
 * anymore — but it stays a legal value here so this type still matches
 * what the constraint (and any pre-existing row) allows. */
export type ReactionId = "love" | "in" | "keepgoing";

const STORAGE_KEY = "sushii.reactions.v1";

/**
 * A tiny store outside React, so a reaction row works the moment it mounts —
 * including on posts rendered later, injected by a feed refresh, or paginated
 * in. Nothing has to be re-bound: every row subscribes on mount and reads the
 * same source.
 */
type ReactionState = Record<string, ReactionId[]>;

function load(): ReactionState {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

let state: ReactionState = load();
const listeners = new Set<() => void>();

function emit() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // best effort — a private window shouldn't break reacting
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Your reactions are yours; a sign-out must not leave them on the next
// person's screen.
if (typeof window !== "undefined") {
  window.addEventListener(LOCAL_CLEARED_EVENT, () => {
    state = {};
    listeners.forEach((l) => l());
  });
}

/** Empty array identity is stable so useSyncExternalStore doesn't loop. */
const NONE: ReactionId[] = [];
const getFor = (postId: string | number) => state[String(postId)] ?? NONE;

function toggle(postId: string | number, reaction: ReactionId) {
  const key = String(postId);
  const current = state[key] ?? [];
  const next = current.includes(reaction)
    ? current.filter((r) => r !== reaction)
    : [...current, reaction];
  state = { ...state, [key]: next };
  emit();
}

/**
 * A Moment's reaction state — read and toggled from MomentCard and
 * MomentDetail, the only two places that render a reaction row.
 *
 * Signed in (and Supabase configured): backed by real rows in
 * `public.reactions` (ContentContext's myReactionsByPostId/toggleReaction),
 * and the public love/in totals on the post itself
 * (docs/moment-card-and-reactions-spec.md's Sept 24, 2026 amendment).
 * Signed out, or no Supabase project configured at all: falls back to this
 * file's own local, same-tab-only store — there's no account for a real
 * row to belong to.
 */
export function useReactionState(postId: string | number) {
  const { user } = useAuth();
  const content = useContent();
  const localMine = useSyncExternalStore(
    subscribe,
    useCallback(() => getFor(postId), [postId]),
    () => NONE,
  );

  if (user) {
    return {
      mine: content.myReactionsByPostId[Number(postId)] ?? NONE,
      toggle: (reaction: ReactionId) => content.toggleReaction(Number(postId), reaction),
    };
  }
  return { mine: localMine, toggle: (reaction: ReactionId) => toggle(postId, reaction) };
}
