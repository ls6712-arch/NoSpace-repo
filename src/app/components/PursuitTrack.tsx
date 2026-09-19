import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Post } from "../data/posts";
import { Project, goalProgressText } from "../lib/journal";
import { getHobby } from "../data/hobbies";
import { lastMomentText, pursuitMoments, startedText, TrailMoment } from "../lib/pursuitTrail";
import { MomentDetail } from "./MomentDetail";

/** {SPACE} for the meta line — a real Space, a made-up one, or free-text interest. */
function spaceLabel(pursuit: Project): string {
  if (pursuit.hobbySlug) return getHobby(pursuit.hobbySlug)?.name ?? pursuit.hobbySlug;
  return pursuit.customSpace || pursuit.interest || "General";
}

function shortDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function firstWords(caption: string, n = 6): string {
  const words = caption.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "No caption.";
  return words.slice(0, n).join(" ") + (words.length > n ? "…" : "");
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
            const isPrivate = m.visibility === "friends";
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

export function PursuitTrack({ pursuit, posts, entryProject }: { pursuit: Project; posts: Post[]; entryProject: Record<string, string> }) {
  const [openMomentId, setOpenMomentId] = useState<number | string | null>(null);
  const moments = pursuitMoments(posts, pursuit.id, entryProject);
  const lastMomentAt = moments[moments.length - 1]?.createdAt;
  const target = pursuit.goal ? goalProgressText(pursuit.goal) : undefined;
  const openPost = openMomentId != null ? posts.find((p) => p.id === openMomentId) ?? null : null;

  return (
    <div className="py-3 first:pt-0">
      <Link
        to={`/pursuit/${pursuit.id}`}
        className="block text-base hover:text-accent"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {pursuit.title}
      </Link>
      <p className="ns-section-kicker mt-0.5 text-muted-foreground">
        {spaceLabel(pursuit).toUpperCase()} · {startedText(pursuit.startedAt)}
      </p>

      <Trail moments={moments} onOpenMoment={setOpenMomentId} />

      <p className="mt-2 text-xs text-muted-foreground">{lastMomentText(lastMomentAt)}</p>
      {target && <p className="mt-0.5 text-xs text-foreground">{target}</p>}

      <MomentDetail post={openPost} owned onOpenChange={(open) => !open && setOpenMomentId(null)} />
    </div>
  );
}
