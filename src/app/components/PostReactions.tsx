import { useCallback, useSyncExternalStore } from "react";
import { Heart, Hand, Sparkles, Bookmark, ArrowUp } from "lucide-react";

/**
 * The five NoSpace reactions. Deliberately not Like / Love / Nice work —
 * each one means something different about what the viewer intends, which is
 * the whole point: a reaction here tells the maker something useful rather
 * than incrementing a number.
 */
export const REACTIONS = [
  { id: "love", label: "Love this", icon: Heart, meaning: "appreciation" },
  { id: "in", label: "I'm in", icon: Hand, meaning: "intent to try or participate" },
  { id: "obsessed", label: "Obsessed", icon: Sparkles, meaning: "strong enthusiasm" },
  { id: "needed", label: "Needed it", icon: Bookmark, meaning: "usefulness or relevance" },
  { id: "keepgoing", label: "Keep going", icon: ArrowUp, meaning: "encouragement" },
] as const;

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
 * The reusable row. Drop it under any post — creation, community, hobby
 * content — and it works, with no wiring at the call site beyond the post id.
 *
 * Compact by design: these are lightweight controls, not social-media
 * buttons. Counts, where shown, stay visually secondary to the label.
 */
export function PostReactions({
  postId,
  baseCounts,
  className = "",
}: {
  postId: string | number;
  /** Optional seed counts. Kept subordinate — never the dominant signal. */
  baseCounts?: Partial<Record<ReactionId, number>>;
  className?: string;
}) {
  const mine = useSyncExternalStore(
    subscribe,
    useCallback(() => getFor(postId), [postId]),
    () => NONE,
  );

  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {REACTIONS.map(({ id, label, icon: Icon, meaning }) => {
        const pressed = mine.includes(id);
        const count = (baseCounts?.[id] ?? 0) + (pressed ? 1 : 0);
        return (
          <li key={id}>
            <button
              type="button"
              aria-pressed={pressed}
              title={`${label} — ${meaning}`}
              onClick={() => toggle(postId, id)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150 ${
                pressed
                  ? "border-transparent text-white [background-color:var(--coral-deep)]"
                  : "border-[var(--border)] bg-surface text-foreground hover:border-[var(--foreground)]/35"
              }`}
            >
              <Icon className="size-3" strokeWidth={2} aria-hidden="true" />
              {label}
              {count > 0 && (
                <span className={pressed ? "text-white/70" : "text-muted-foreground"}>
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
