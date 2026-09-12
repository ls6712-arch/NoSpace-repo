import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Check, Lock, Share2, Sparkles, Target } from "lucide-react";
import { getHobby } from "../data/hobbies";
import { Post } from "../data/posts";
import {
  Project,
  setProjectShared,
  finishProject,
  projectProgress,
  useJournalSlice,
  markGoalReached,
  goalProgressText,
} from "../lib/journal";
import { mirrorPursuit } from "../lib/pursuitsRemote";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { GeneratedArt } from "./GeneratedArt";
import { PostMedia } from "./PostMedia";
import { GoalDialog } from "./GoalDialog";

function timeAgo(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30.44);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

const RING_RADIUS = 15;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * A numeric goal's completion, as a ring — one stroke color everywhere it
 * appears, since the fill level is what carries the meaning, not a hue
 * picked per card. Starts empty and fills in once on mount (~400ms
 * ease-out), the one motion this card keeps.
 */
function ProgressRing({ percent }: { percent: number }) {
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  const offset = RING_CIRCUMFERENCE * (1 - (filled ? percent : 0));

  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0 -rotate-90">
      <circle cx="18" cy="18" r={RING_RADIUS} fill="none" stroke="var(--border)" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r={RING_RADIUS}
        fill="none"
        stroke="var(--coral)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 400ms ease-out" }}
      />
    </svg>
  );
}

/** What a Pursuit card actually needs — either the owner's own live Project
 * (with edit actions) or someone else's shared row (read-only). */
export type PursuitLike = {
  id: string;
  title: string;
  hobbySlug?: string;
  interest?: string;
  customSpace?: string;
  startedAt: number;
  finishedAt?: number;
};

/**
 * One Pursuit, as a card someone would actually want to look at: its own
 * inspiration image when it has one (a real photo if the maker uploaded
 * one, the same illustrated fallback as everywhere else in NoSpace
 * otherwise), the Space and Interest as quiet metadata rather than a
 * taxonomy to fill in, and a status worked out from what's actually
 * happened rather than a field someone has to remember to update.
 */
export function PursuitCard({
  pursuit,
  inspirationPost,
  owner = false,
  className = "",
}: {
  pursuit: PursuitLike;
  inspirationPost?: Post;
  /** Only the owner's own view gets the share toggle and "Mark complete". */
  owner?: boolean;
  className?: string;
}) {
  const { user, profile } = useAuth();
  const { posts } = useContent();
  const entryProject = useJournalSlice((s) => s.entryProject);
  const [goalOpen, setGoalOpen] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  // Only the owner's own card is ever backed by a full Project (with a
  // `shared` flag and edit actions) — a friend's view only ever gets the
  // read-only PursuitLike shape, so this cast is safe exactly when owner is.
  const asProject = owner ? (pursuit as Project) : null;
  const shared = !!asProject?.shared;

  const { count, lastUpdatedAt } = owner
    ? projectProgress(entryProject, posts, pursuit.id)
    : { count: 0, lastUpdatedAt: undefined };

  const space = pursuit.hobbySlug ? getHobby(pursuit.hobbySlug) : undefined;
  const spaceLabel = space?.shortName ?? pursuit.customSpace;
  const status = pursuit.finishedAt ? "Completed" : count > 0 ? "In progress" : "Just started";
  const moved = pursuit.finishedAt ?? lastUpdatedAt ?? pursuit.startedAt;

  const toggleShare = async () => {
    if (!asProject) return;
    const next = !shared;
    setProjectShared(pursuit.id, next);
    if (user) void mirrorPursuit(user.id, { ...asProject, shared: next });

    // Turning sharing on is the moment someone actually wants a link to
    // hand to someone — do that copy right here instead of leaving them to
    // hunt for a separate "share" action afterward, which is what made this
    // button feel like it didn't do anything.
    if (next) {
      const url = profile?.username
        ? `${window.location.origin}${window.location.pathname}#/u/${profile.username}`
        : window.location.href;
      try {
        await navigator.clipboard.writeText(url);
        setJustCopied(true);
        setTimeout(() => setJustCopied(false), 2000);
      } catch {
        // Clipboard can be unavailable (permissions, non-secure context) —
        // the Pursuit is still shared either way, just without the copy.
      }
    }
  };

  const markDone = () => {
    if (!asProject) return;
    finishProject(pursuit.id);
    if (user) void mirrorPursuit(user.id, { ...asProject, finishedAt: Date.now() });
  };

  const goal = asProject?.goal;
  const goalText = goal
    ? goal.shape === "number"
      ? goalProgressText(goal)
      : goal.shape === "date"
        ? goal.label
        : goal.label
    : undefined;
  // Progress toward a numeric goal, worked out from the actual update count
  // the same way the Pursuit's own detail page does — not a separately
  // tracked number that could quietly disagree with it.
  const ringPercent =
    owner && goal?.shape === "number" && goal.targetNumber
      ? Math.min(1, count / goal.targetNumber)
      : undefined;

  const reachIt = () => {
    if (!asProject) return;
    markGoalReached(pursuit.id);
  };

  return (
    <div
      className={`group flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors duration-200 hover:border-[var(--coral-deep)] ${className}`}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <Link to={`/pursuit/${pursuit.id}`} className="absolute inset-0 block" aria-label={`Open ${pursuit.title}`}>
          {inspirationPost ? (
            <PostMedia
              media={inspirationPost.media}
              type={inspirationPost.type}
              hobbySlug={inspirationPost.hobbySlug}
              seed={inspirationPost.id}
              preview
              className="h-full w-full"
            />
          ) : (
            <GeneratedArt
              hobbySlug={pursuit.hobbySlug ?? "crafts-making"}
              seed={pursuit.id}
              className="h-full w-full"
            />
          )}
          <span
            className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-md ${
              pursuit.finishedAt ? "bg-[var(--forest)]/80" : "bg-[var(--void)]/55"
            }`}
          >
            {status}
          </span>
        </Link>
        {owner && (
          <button
            type="button"
            onClick={toggleShare}
            title={
              justCopied
                ? "Link copied"
                : shared
                  ? "Shared on your profile (tap to make private)"
                  : "Private (tap to share and copy a link)"
            }
            aria-pressed={shared}
            className="absolute right-2.5 top-2.5 flex h-8 min-w-8 items-center gap-1.5 rounded-full bg-[var(--void)]/55 px-2.5 backdrop-blur-md transition-colors hover:bg-[var(--void)]/75"
          >
            {justCopied ? (
              <span className="text-[10px] font-medium text-white">Copied!</span>
            ) : shared ? (
              <Share2 className="size-3.5" strokeWidth={1.9} style={{ color: "white" }} />
            ) : (
              <Lock className="size-3.5" strokeWidth={1.9} style={{ color: "white" }} />
            )}
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <Link to={`/pursuit/${pursuit.id}`} className="block">
          <p className="text-base leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
            {pursuit.title}
          </p>
          {(pursuit.interest || spaceLabel) && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {[pursuit.interest, spaceLabel].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            {pursuit.finishedAt ? `Finished ${timeAgo(moved)}` : `Updated ${timeAgo(moved)}`}
          </p>
        </Link>

        {owner && (
          <div className="mt-2.5 flex items-center gap-2.5">
            {ringPercent !== undefined && <ProgressRing percent={ringPercent} />}
            <button
              type="button"
              onClick={() => setGoalOpen(true)}
              className={`flex w-fit min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                goal
                  ? goal.reachedAt
                    ? "border-border bg-surface-muted text-muted-foreground"
                    : "border-[var(--coral-deep)]/50 bg-[color-mix(in_srgb,var(--coral)_14%,var(--surface-elevated))] text-foreground hover:border-[var(--coral-deep)]"
                  : "border-dashed border-border text-muted-foreground hover:border-[var(--coral-deep)] hover:text-foreground"
              }`}
            >
              <Target className="size-4 shrink-0" strokeWidth={1.8} />
              <span className={`truncate font-medium ${goal?.reachedAt ? "line-through decoration-1" : ""}`}>
                {goal ? (goal.reachedAt ? `Reached it — ${goalText}` : goalText) : "Set a goal"}
              </span>
            </button>
          </div>
        )}

        {owner && (
          <div className="mt-3 flex items-center gap-2">
            <Link
              to={`/create?pursuit=${pursuit.id}`}
              className="flex-1 rounded-full border border-[var(--hairline)] bg-surface px-3 py-1.5 text-center text-xs font-medium text-foreground transition-colors hover:border-[var(--coral-deep)]"
            >
              Add progress
            </Link>
            {goal && !goal.reachedAt && (
              <button
                type="button"
                onClick={reachIt}
                title="Reached it"
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--hairline)] text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-foreground"
              >
                <Target className="size-3.5" strokeWidth={2} />
              </button>
            )}
            {!pursuit.finishedAt && (
              <button
                type="button"
                onClick={markDone}
                title="Mark complete"
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--hairline)] text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-foreground"
              >
                <Check className="size-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
        )}
      </div>

      {owner && asProject && (
        <GoalDialog open={goalOpen} onOpenChange={setGoalOpen} project={asProject} />
      )}
    </div>
  );
}

/** Icon used for empty-state "start one" prompts around Pursuits. */
export const PursuitIcon = Sparkles;
