import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { pursuitStatus, useJournalSlice, type Project } from "../lib/journal";
import { collectPursuitMoments } from "../lib/pursuitTrail";
import { formatAmount, pursuitCorner, unitFor } from "../lib/pursuitProgress";
import { usePursuitMembers, usePursuitProgress } from "../lib/usePursuitProgress";
import { daysBetween } from "../lib/pursuitGoal";
import { withLine } from "../lib/withLine";
import { formatDate, formatDateRange } from "../lib/dates";
import { plural } from "../lib/plural";
import { renderRecap } from "../lib/recapImage";
import { heroCandidates } from "../lib/discoverHero";
import { useInterests } from "../lib/interests";
import { fetchOpenPursuits } from "../lib/openPursuits";
import { formatDateTime } from "../lib/dates";
import { cornerMeta, curatedBySlug } from "../data/curatedCorners";
import { StubArt } from "../components/stub/StubArt";
import { PillButton } from "../components/ui/PillButton";
import { Confetti } from "../components/pursuit/Confetti";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { PAGE_FROM, PAGE_TO, haptic, page, press, PRESS_SCALE } from "../lib/motionTokens";

const MotionLink = motion.create(Link);

/**
 * Pursuit complete (screen 13): how long it took, the Moments as a 5 by 2 grid
 * that flips in tile by tile, the gold stub, a story image to share, and what
 * to do next. Confetti once, skipped under reduced motion.
 */
export function PursuitRecap() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { posts } = useContent();
  const { logs: privateLogs } = usePrivateLogs();
  const entryProject = useJournalSlice((s) => s.entryProject);
  const projects = useJournalSlice((s) => s.projects);
  const project: Project | undefined = useMemo(() => projects.find((p) => p.id === id), [projects, id]);
  const members = usePursuitMembers(project, undefined, 0);
  const interests = useInterests();
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [nextGroup, setNextGroup] = useState<string | null>(null);

  const complete = !!project && pursuitStatus(project) === "complete";

  // Not finished, or not yours: back to the Pursuit.
  useEffect(() => {
    if (project && !complete) void navigate(`/pursuit/${id}`, { replace: true });
  }, [project, complete, id, navigate]);
  useEffect(() => {
    if (complete) haptic();
  }, [complete]);

  const moments = useMemo(
    () => (project ? collectPursuitMoments(project.id, posts, entryProject, privateLogs).sort((a, b) => a.createdAt - b.createdAt) : []),
    [project, posts, entryProject, privateLogs],
  );
  // The grid: the Pursuit's Moments in order; each Moment logged toward a measured Pursuit also leaves a photo on its progress entry, which fills the grid when the Moments themselves are not in this browser.
  const entries = usePursuitProgress(project?.id);
  const tiles = useMemo(() => {
    const fromMoments = moments.filter((m) => m.image);
    if (fromMoments.length > 0) return fromMoments.slice(0, 10);
    return [...entries]
      .filter((e) => e.image)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 10)
      .map((e) => ({ key: e.id, image: e.image }));
  }, [moments, entries]);

  // "Try something new": the first Corner from what you want more of that is not this one.
  const next = useMemo(() => {
    if (!project) return undefined;
    return heroCandidates(interests.moods, "quick").find((c) => c.cornerSlug !== project.subHobby);
  }, [project, interests.moods]);
  useEffect(() => {
    if (!next) return;
    let live = true;
    void fetchOpenPursuits(next.spaceSlug, next.cornerSlug, 1).then((list) => {
      if (live && list[0]?.session) setNextGroup(`Group starting ${formatDateTime(list[0].session.startsAt)}`);
    });
    return () => {
      live = false;
    };
  }, [next]);

  if (!project || !complete) {
    return <div className="min-h-viewport bg-surface" />;
  }

  const measure = project.measure;
  const target = measure?.target ?? project.goal?.targetNumber ?? 0;
  const unit = measure ? unitFor(measure, target) : "";
  const finished = project.finishedAt ?? Date.now();
  const days = daysBetween(project.startedAt, finished);
  const corner = pursuitCorner(project) ?? project.title;
  const others = members.filter((m) => m.status === "joined" && m.userId !== user?.id).map((m) => m.displayName);
  const done = Math.min(measure ? Math.max(tiles.length, 0) : 0, target) || tiles.length;
  const stubCount = { done: Math.min(target || done, target || done), total: target || done };
  const meta = [withLine(others), formatDateRange(project.startedAt, finished)].filter(Boolean).join(" · ");
  const headline = target > 0 ? `You finished ${formatAmount(target)} ${unit}`.trim() : `You finished ${project.title}`;

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    setShareError(null);
    const blob = await renderRecap({
      kicker: `Pursuit complete · ${plural(days, "day")}`,
      title: headline,
      stubTitle: target > 0 ? `${formatAmount(stubCount.total)}/${formatAmount(stubCount.total)} ${unit}` : corner,
      stubCount: target > 0 ? `${formatAmount(stubCount.done)}/${formatAmount(stubCount.total)}` : "",
      stubMeta: meta,
      photoUrls: tiles.map((t) => t.image).filter((u): u is string => !!u),
    });
    setSharing(false);
    if (!blob) {
      setShareError("We couldn’t make the image. Try again.");
      return;
    }
    const file = new File([blob], "soosh-recap.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: headline });
        return;
      }
    } catch {
      // Closing the share sheet is not an error; fall through to a download only when sharing was unavailable.
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = "soosh-recap.png";
    a.click();
    URL.revokeObjectURL(url);
  };

  const keepGoing = [
    {
      key: "level",
      to: `/pursuits/new?title=${encodeURIComponent(`${corner} ${Math.max(2, Math.round((target || 5) * 1.5))} times`)}${project.hobbySlug ? `&hobby=${encodeURIComponent(project.hobbySlug)}` : ""}${project.subHobby ? `&sub=${encodeURIComponent(project.subHobby)}` : ""}&together=1`,
      title: `Level up: ${Math.max(2, Math.round((target || 5) * 1.5))} times`,
      line: "Same group, harder goal",
    },
    ...(project.subHobby
      ? [{ key: "host", to: `/corners/${project.subHobby}?host=1`, title: "Host it for beginners", line: "Teach 3 people your starter routine" }]
      : []),
    ...(next
      ? [
          {
            key: "new",
            to: `/corners/${next.cornerSlug}`,
            title: `Try something new: ${next.label}`,
            line: nextGroup ?? (() => {
              const c = curatedBySlug(next.cornerSlug);
              return c ? cornerMeta(c) : "";
            })(),
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-viewport bg-background pb-24">
      <Confetti />
      <div className="mx-auto w-full max-w-[calc(680px+2rem)] tab:max-w-[calc(680px+3rem)] desk:max-w-[calc(680px+4rem)] px-4 tab:px-6 desk:px-8 flex flex-col gap-8 pt-10">
        <header className="text-center">
          <p className="text-small text-muted-foreground">{`Pursuit complete · ${plural(days, "day")}`}</p>
          <motion.h1
            initial={PAGE_FROM}
            animate={PAGE_TO}
            transition={page}
            className="mt-2 font-[family-name:var(--font-display)] text-display font-extrabold"
            style={{ viewTransitionName: "pursuit-title" }}
          >
            {headline}
          </motion.h1>
        </header>

        {tiles.length > 0 && (
          <ul className="grid grid-cols-5 gap-2" aria-label="Your Moments">
            {tiles.map((t, i) => (
              <motion.li
                key={t.key}
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ duration: 0.35, delay: i * 0.04, ease: "easeOut" }}
                style={{ transformPerspective: 600 }}
                className="relative aspect-square overflow-hidden rounded-control bg-card"
              >
                {t.image && <ImageWithFallback src={t.image} alt="" width={200} className="absolute inset-0 size-full" />}
                <span className="absolute inset-0 bg-[image:var(--scrim-card)]" aria-hidden="true" />
                <span className="absolute inset-x-0 bottom-1 text-center text-caption font-semibold text-[var(--photo-text)]">{`#${i + 1}`}</span>
              </motion.li>
            ))}
          </ul>
        )}

        {/* The Finisher, on a soft amber glow (a static gradient: the animated shader is not used). */}
        <div className="rounded-card p-3" style={{ background: "radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--cat-amber) 28%, transparent), transparent 70%)" }}>
          <div className="flex justify-center">
            <StubArt
              face={{
                kind: "finish",
                title: project.title,
                cornerName: corner,
                color: "var(--cat-amber)",
                day: formatDate(finished),
                goal: target > 0 ? Math.round(target) : undefined,
                photoUrl: tiles[tiles.length - 1]?.image ?? undefined,
              }}
              width={232}
              interactive
              shimmer
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <PillButton variant="outline" className="w-full" disabled={sharing} onClick={() => void share()}>
            Share the recap
          </PillButton>
          {shareError && (
            <p role="alert" className="text-caption text-accent-text">
              {shareError}
            </p>
          )}
        </div>

        <section aria-labelledby="keep-going" className="flex flex-col gap-3">
          <h2 id="keep-going" className="font-[family-name:var(--font-display)] text-title font-bold">
            Keep going
          </h2>
          {keepGoing.map((k) => (
            <MotionLink
              key={k.key}
              to={k.to}
              whileTap={{ scale: PRESS_SCALE }}
              transition={press}
              className="flex min-h-11 items-center justify-between gap-3 rounded-card bg-card p-4"
            >
              <span className="min-w-0">
                <span className="block text-body font-semibold">{k.title}</span>
                {k.line && <span className="block text-small text-muted-foreground">{k.line}</span>}
              </span>
              <ArrowRight className="size-5 shrink-0 text-accent-text" strokeWidth={1.75} aria-hidden="true" />
            </MotionLink>
          ))}
        </section>
      </div>
    </div>
  );
}
