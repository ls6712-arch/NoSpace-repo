import { useCallback, useSyncExternalStore } from "react";
import { Heart, Hand, Sparkles, Bookmark, Lightbulb, ArrowUp } from "lucide-react";
import { toggleSaved, useJournalSlice } from "../lib/journal";
import { LOCAL_CLEARED_EVENT } from "../lib/localData";

/**
 * The five NoSpace reactions, plus Save as a sixth cell in the same grid.
 * Deliberately not Like / Love / Nice work — each one means something
 * different about what the viewer intends, which is the whole point: a
 * reaction here tells the maker something useful rather than incrementing a
 * number. Save is the odd one out — it's for the viewer, and the maker never
 * sees it — but it belongs in the grid rather than floating on the photo.
 */
export const REACTIONS = [
  { id: "love", label: "Love this", icon: Heart, meaning: "appreciation" },
  { id: "in", label: "I'm in", icon: Hand, meaning: "intent to try or participate" },
  { id: "obsessed", label: "Obsessed", icon: Sparkles, meaning: "strong enthusiasm" },
  { id: "needed", label: "Needed it", icon: Lightbulb, meaning: "usefulness or relevance" },
  { id: "keepgoing", label: "Keep going", icon: ArrowUp, meaning: "encouragement" },
] as const;

/** The tint each one carries when chosen — coral for warmth, forest for intent. */
const TINT: Record<string, string> = {
  love: "var(--coral-deep)",
  in: "var(--forest)",
  obsessed: "var(--coral-deep)",
  needed: "var(--forest)",
  keepgoing: "var(--coral-deep)",
  save: "var(--forest)",
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
    <ul className={`grid grid-cols-2 gap-2 ${className}`}>
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
              className={`flex w-full items-center gap-2 rounded-full border px-3 py-2 text-[13px] transition-colors duration-150 ${
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
              {label}
              {count > 0 && (
                <span className="ml-auto text-[11px] text-muted-foreground">{count}</span>
              )}
            </button>
          </li>
        );
      })}

      {/* Save is one of the six, not a separate control floating on the photo. */}
      <li>
        <SaveReaction postId={postId} />
      </li>
    </ul>
  );
}

function SaveReaction({ postId }: { postId: string | number }) {
  const saved = useJournalSlice((s) => s.saved.includes(Number(postId)));
  return (
    <button
      type="button"
      aria-pressed={saved}
      title="Save — keep it to come back to"
      onClick={() => toggleSaved(Number(postId))}
      className="flex w-full items-center gap-2 rounded-full border border-[var(--border)] bg-surface px-3 py-2 text-[13px] text-foreground transition-colors duration-150 hover:border-[var(--foreground)]/35"
    >
      <Bookmark
        className="size-4 shrink-0"
        strokeWidth={1.9}
        style={{
          color: saved ? TINT.save : "var(--foreground-muted)",
          fill: saved ? TINT.save : "none",
        }}
        aria-hidden="true"
      />
      {saved ? "Saved" : "Save"}
    </button>
  );
}
