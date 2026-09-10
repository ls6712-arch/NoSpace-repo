import { useCallback, useSyncExternalStore } from "react";
import { Heart, Hand, ArrowUp } from "lucide-react";
import { LOCAL_CLEARED_EVENT } from "../lib/localData";

/**
 * The three NoSpace reactions. Deliberately not Like / Love / Nice work —
 * each one means something different about what the viewer intends, which
 * is the whole point: a reaction here tells the maker something useful
 * rather than incrementing a number. Try This lives separately now, as
 * PostBookmark — it's for the viewer, not a signal to the maker, so it
 * never belonged in the row the maker actually sees.
 */
export const REACTIONS = [
  { id: "love", label: "Love this", icon: Heart, meaning: "appreciation" },
  { id: "in", label: "I'm in", icon: Hand, meaning: "intent to try or participate" },
  { id: "keepgoing", label: "Keep going", icon: ArrowUp, meaning: "encouragement" },
] as const;

/** The tint each one carries when chosen — coral for warmth, forest for intent. */
const TINT: Record<string, string> = {
  love: "var(--coral-deep)",
  in: "var(--sky)",
  keepgoing: "var(--coral-deep)",
};

export type ReactionId = (typeof REACTIONS)[number]["id"];

const STORAGE_KEY = "nospace.reactions.v1";

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
 * The reusable row. Drop it under any post — moment, community, hobby
 * content — and it works, with no wiring at the call site beyond the post id.
 *
 * Compact by design: these are lightweight controls, not social-media
 * buttons. Counts, where shown, stay visually secondary to the label.
 */
export function PostReactions({
  postId,
  baseCounts,
  compact = false,
  className = "",
}: {
  postId: string | number;
  /** Optional seed counts. Kept subordinate — never the dominant signal. */
  baseCounts?: Partial<Record<ReactionId, number>>;
  /** Smaller and tighter, for a denser grid of cards. Still three across
   * either way — nothing about what they do changes. */
  compact?: boolean;
  className?: string;
}) {
  const mine = useSyncExternalStore(
    subscribe,
    useCallback(() => getFor(postId), [postId]),
    () => NONE,
  );

  return (
    <ul className={`grid grid-cols-3 ${compact ? "gap-1.5" : "gap-2"} ${className}`}>
      {REACTIONS.map(({ id, label, icon: Icon, meaning }) => {
        const pressed = mine.includes(id);
        const count = (baseCounts?.[id] ?? 0) + (pressed ? 1 : 0);
        return (
          <li key={id}>
            <button
              type="button"
              aria-pressed={pressed}
              aria-label={`${label}: ${meaning}${count > 0 ? ` (${count})` : ""}`}
              title={`${label}: ${meaning}`}
              onClick={() => toggle(postId, id)}
              className={`relative flex w-full items-center justify-center whitespace-nowrap rounded-full border transition-colors duration-150 ${
                compact ? "gap-1 px-2 py-2 text-[13px]" : "gap-1.5 px-3 py-2 text-[13px]"
              } ${
                pressed
                  ? "border-[var(--border)] bg-surface text-foreground"
                  : "border-[var(--border)] bg-surface text-foreground hover:border-[var(--foreground)]/35"
              }`}
            >
              <Icon
                className="size-4 shrink-0"
                strokeWidth={1.9}
                style={{
                  color: pressed ? TINT[id] : "var(--foreground-muted)",
                  fill: pressed ? TINT[id] : "none",
                }}
                aria-hidden="true"
              />
              <span className={compact ? "sr-only" : "whitespace-nowrap"}>{label}</span>
              {/* A corner badge, not an inline number: a label like "Keep
                  going" already uses most of a narrow desktop column's
                  width, and giving the count its own flex space was what
                  pushed the label onto a second line the button's
                  rounded-full shape was never built to hold. A badge floats
                  outside that layout entirely, so the count never competes
                  with the label for room, at any column width. */}
              {count > 0 && !compact && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-border bg-surface-elevated px-1 text-[9px] font-medium text-muted-foreground"
                >
                  {count}
                </span>
              )}
              {count > 0 && compact && (
                <span aria-hidden="true" className="text-[10px] text-muted-foreground">
                  {count}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
