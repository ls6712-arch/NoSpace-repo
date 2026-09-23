import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { Post } from "../data/posts";
import { Project, goalDeadlineText, goalProgressText } from "../lib/journal";
import { getHobby } from "../data/hobbies";
import { lastMomentText, pursuitMoments, startedLabel, TrailMoment } from "../lib/pursuitTrail";
import { isOnlyYou } from "../lib/visibility";
import { firstWords } from "../lib/text";
import { MomentDetail } from "./MomentDetail";
import { QuickLog } from "./QuickLog";
import { ProgressBar } from "./pursuit/ui";
import { formatAmount, hasMeasure, summarize } from "../lib/pursuitProgress";
import { useJournalSlice, ProgressEntry } from "../lib/journal";

const NO_PROGRESS: ProgressEntry[] = [];

/** {SPACE} for the meta line — a real Space, a made-up one, or free-text interest. */
function spaceLabel(pursuit: Project): string {
  if (pursuit.hobbySlug) return getHobby(pursuit.hobbySlug)?.name ?? pursuit.hobbySlug;
  return pursuit.customSpace || pursuit.interest || "General";
}

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * A dot per Moment, oldest to newest. Below ~280px of container width, the
 * densest useful count is 8; wider, 12 (docs/my-space-spec.md section 4.2).
 * Measured, not a CSS container query, since the dot count changes what
 * gets sliced and rendered — a layout concern JS already has to own.
 */
function useNarrow(ref: React.RefObject<HTMLElement | null>) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 280));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return narrow;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function Trail({
  moments,
  onOpenMoment,
}: {
  moments: TrailMoment[];
  onOpenMoment: (id: number | string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const narrow = useNarrow(containerRef);
  const reducedMotion = usePrefersReducedMotion();
  const [hovered, setHovered] = useState<number | string | null>(null);

  const capacity = narrow ? 8 : 12;
  const shown = moments.slice(-capacity);
  const truncated = moments.length > shown.length;
  const latestId = moments[moments.length - 1]?.id;
  const hoveredMoment = shown.find((m) => m.id === hovered);

  return (
    <div ref={containerRef} className="relative mt-2">
      <div className="relative flex h-5 items-center">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" aria-hidden="true" />
        {truncated && (
          <span
            className="ns-section-kicker relative z-10 mr-1.5 shrink-0 text-muted-foreground/70"
            aria-hidden="true"
          >
            +earlier
          </span>
        )}
        <div className="relative flex w-full items-center justify-between">
          {shown.map((m, i) => {
            const isLatest = m.id === latestId;
            const isPrivate = isOnlyYou(m);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onOpenMoment(m.id)}
                onMouseEnter={() => setHovered(m.id)}
                onMouseLeave={() => setHovered((h) => (h === m.id ? null : h))}
                onFocus={() => setHovered(m.id)}
                onBlur={() => setHovered((h) => (h === m.id ? null : h))}
                aria-label={`${shortDate(m.createdAt)}: ${firstWords(m.caption)}`}
                className={
                  "relative z-10 size-2.5 shrink-0 rounded-full transition-transform hover:scale-125 focus-visible:scale-125 " +
                  (isLatest
                    ? "bg-gold"
                    : isPrivate
                      ? "border border-dashed border-muted-foreground bg-transparent"
                      : "border border-muted-foreground bg-transparent")
                }
                style={
                  reducedMotion
                    ? undefined
                    : { animation: `ns-rise 500ms ease-out both`, animationDelay: `${i * 30}ms` }
                }
              />
            );
          })}
        </div>
      </div>
      {hoveredMoment && (
        <div
          role="tooltip"
          className="absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-sm"
        >
          {shortDate(hoveredMoment.createdAt)} · {firstWords(hoveredMoment.caption)}
        </div>
      )}
    </div>
  );
}

export function PursuitTrack({
  pursuit,
  posts,
  entryProject,
  lastActivity,
  quickLog = true,
}: {
  pursuit: Project;
  posts: Post[];
  entryProject: Record<string, string>;
  /** Latest Moment across posts AND private logs — the trail below only
   * draws shared posts, so without this a Pursuit logged privately read as
   * "No Moments yet." */
  lastActivity?: number;
  /** Show the inline "Log a Moment" box toggle. */
  quickLog?: boolean;
}) {
  const [openMomentId, setOpenMomentId] = useState<number | string | null>(null);
  const [logging, setLogging] = useState(false);
  const moments = pursuitMoments(posts, pursuit.id, entryProject);
  const lastMomentAt = lastActivity ?? moments[moments.length - 1]?.createdAt;
  const goal = pursuit.goal;
  // Goal as a plain sentence: "4 of 10 pieces · by Nov 15". No bar, no %.
  const goalLine = goal
    ? [goal.shape === "number" ? goalProgressText(goal) : goal.label, goal.shape === "number" && goalDeadlineText(goal) ? `by ${goalDeadlineText(goal)}` : undefined]
        .filter(Boolean)
        .join(" · ")
    : undefined;
  const openPost = openMomentId != null ? posts.find((p) => p.id === openMomentId) ?? null : null;
  const allProgress = useJournalSlice((s) => s.progress ?? NO_PROGRESS);
  const measured = hasMeasure(pursuit) ? summarize(pursuit.measure!, allProgress.filter((e) => e.projectId === pursuit.id)) : undefined;

  return (
    <div className="py-3 first:pt-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/pursuit/${pursuit.id}`}
            className="block text-base text-foreground hover:text-accent"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {pursuit.title}
          </Link>
          <p className="ns-section-kicker mt-0.5 text-muted-foreground">
            {spaceLabel(pursuit).toUpperCase()} · {startedLabel(pursuit.startedAt).toUpperCase()}
          </p>
        </div>
        {quickLog && measured ? (
          <Link
            to={`/pursuit/${pursuit.id}/moment`}
            aria-label={`Add a Moment to ${pursuit.title}`}
            className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-[var(--coral-deep)]"
          >
            <Plus className="size-3" />
            Moment
          </Link>
        ) : quickLog && (
          <button
            type="button"
            onClick={() => setLogging((v) => !v)}
            aria-expanded={logging}
            aria-label={`Log a Moment on ${pursuit.title}`}
            className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-[var(--coral-deep)]"
          >
            <Plus className="size-3" />
            Moment
          </button>
        )}
      </div>

      {moments.length > 0 && <Trail moments={moments} onOpenMoment={setOpenMomentId} />}

      {measured ? (
        <div className="mt-2">
          <ProgressBar fraction={measured.fraction} thin />
          <p className="mt-1 text-xs text-foreground">
            {formatAmount(measured.current)} / {formatAmount(measured.target)} {pursuit.measure!.unit}
            <span className="text-muted-foreground"> · {measured.percent}%</span>
          </p>
        </div>
      ) : (
        goalLine && <p className="mt-2 text-xs text-foreground">{goalLine}</p>
      )}
      <p className="mt-0.5 text-xs text-muted-foreground">{lastMomentText(lastMomentAt)}</p>

      {logging && (
        <div className="mt-2.5">
          <QuickLog pursuit={pursuit} compact onDone={() => setLogging(false)} />
        </div>
      )}

      <MomentDetail post={openPost} owned onOpenChange={(open) => !open && setOpenMomentId(null)} />
    </div>
  );
}
