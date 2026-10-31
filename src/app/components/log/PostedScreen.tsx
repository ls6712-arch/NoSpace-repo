import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { StubArt } from "../stub/StubArt";
import { StubReveal } from "../stub/StubReveal";
import { PillButton } from "../ui/PillButton";
import { Chip } from "../ui/Chip";
import type { CornerSuggestion } from "../../lib/cornerSuggestions";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { fetchEarnedStub, fetchLovers, pinStub } from "../../lib/stubs";
import { faceFromEarned, type StubFace } from "../../lib/stubFace";
import { signMomentPaths } from "../../lib/momentMedia";
import { fetchNextSession, fetchOpenPursuits } from "../../lib/openPursuits";
import { profilesById } from "../../lib/pursuitsRemote";
import { relatedCorner } from "../../lib/relatedCorner";
import { cornerPath } from "../../lib/cornerPath";
import { curatedBySlug, cornerMeta } from "../../data/curatedCorners";
import { formatDateTime } from "../../lib/dates";
import { plural } from "../../lib/plural";
import { haptic, PAGE_FROM, PAGE_TO, page, pop, PRESS_SCALE, shared } from "../../lib/motionTokens";

const MotionLink = motion.create(Link);

export type PostedAudience = "group" | "friends" | "everyone";

const AUDIENCE_LINE: Record<PostedAudience, string> = {
  group: "Posted to your group",
  friends: "Posted to your followers",
  everyone: "Posted to everyone",
};

/** Shared with the Log form's photo, so the photo grows into the stub. */
export const LOG_PHOTO_LAYOUT_ID = "log-photo";

/**
 * Posted (screen 7): "Posted to your group", the Stub this Moment earned if it
 * earned one (it grows out of the photo you just posted, then the perforation
 * draws), a card when someone loves the Moment while you are here, three rows
 * for what to do next, and a way home. A Moment earns a Stub only when it
 * finishes a Pursuit or a drop, or is a Corner's 10th day this month
 * (20261115000000); most Moments earn none, and then no ticket shows.
 */
export function PostedScreen({
  postId,
  audience,
  corner,
  pursuit,
  place,
  undo,
  cornerChoices,
  onAddCorner,
  onDone,
}: {
  postId: number | null;
  audience: PostedAudience;
  corner?: { spaceSlug: string; slug: string; name: string };
  pursuit?: { id: string; done: number; total: number; otherNames: string[] };
  place?: string;
  undo?: { onUndo: () => void; busy: boolean; error: string | null };
  /** Up to three Corners to offer when the Moment has none. Nothing is added until one is tapped. */
  cornerChoices?: CornerSuggestion[];
  onAddCorner?: (c: CornerSuggestion) => Promise<boolean>;
  onDone?: () => void;
}) {
  const [cornerState, setCornerState] = useState<"offer" | "skipped" | { added: string } | "failed">("offer");
  const [stub, setStub] = useState<StubFace | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [lover, setLover] = useState<{ name: string; avatarUrl?: string } | null>(null);
  const [nextSession, setNextSession] = useState<number | null>(null);
  const [group, setGroup] = useState<string | null>(null);

  const related = useMemo(() => (corner ? relatedCorner(corner.spaceSlug, corner.slug) : undefined), [corner]);

  // The database issues any Stub in the same transaction as the Moment.
  useEffect(() => {
    if (postId == null) return;
    let live = true;
    void fetchEarnedStub(postId).then(async (e) => {
      if (!e) return;
      const cover = e.coverPath ? (await signMomentPaths([e.coverPath])).get(e.coverPath) : undefined;
      if (!live) return;
      setStub(faceFromEarned(e, cover));
      setRevealing(true);
    });
    return () => {
      live = false;
    };
  }, [postId]);

  // Someone may love it while you are still here: look every few seconds for a couple of minutes.
  useEffect(() => {
    if (postId == null) return;
    let live = true;
    let tries = 0;
    const look = async () => {
      const ids = await fetchLovers(postId);
      if (!live) return;
      if (ids.length > 0) {
        const who = (await profilesById([ids[0]])).get(ids[0]);
        if (live) {
          setLover({ name: who?.displayName ?? "Someone", avatarUrl: who?.avatarUrl });
          haptic();
        }
        return;
      }
      if (++tries < 20) timer = window.setTimeout(look, 6000);
    };
    let timer = window.setTimeout(look, 4000);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [postId]);

  useEffect(() => {
    if (!pursuit) return;
    let live = true;
    void fetchNextSession(pursuit.id).then((s) => live && setNextSession(s?.startsAt ?? null));
    return () => {
      live = false;
    };
  }, [pursuit?.id]);

  useEffect(() => {
    if (!related) return;
    let live = true;
    void fetchOpenPursuits(related.spaceSlug, related.slug, 1).then((list) => {
      const g = list[0];
      if (live && g) setGroup(`${g.ownerName.slice(0, 40)}’s group has ${plural(Math.max(0, g.capacity - g.taken), "spot")}`);
    });
    return () => {
      live = false;
    };
  }, [related]);


  const rows: { key: string; to: string; title: string; line: string }[] = [];
  if (pursuit && corner) {
    rows.push({
      key: "next",
      to: `/pursuit/${pursuit.id}`,
      title: `${corner.name} #${pursuit.done + 1}`,
      line: nextSession ? `Group session ${formatDateTime(nextSession)}` : "Plan your next one",
    });
  }
  if (related) {
    const c = curatedBySlug(related.slug);
    rows.push({
      key: "related",
      to: cornerPath(related.spaceSlug, related.slug),
      title: `People who do ${corner?.name.toLowerCase() ?? "this"} also try ${related.name}`,
      line: group ?? (c ? cornerMeta(c) : ""),
    });
  }
  if (pursuit) {
    rows.push({ key: "invite", to: `/pursuit/${pursuit.id}`, title: "Invite a friend to the next one", line: "They join your Pursuit" });
  }

  return (
    <div className="flex min-h-viewport flex-col bg-background">
      {stub && revealing && <StubReveal face={stub} onDone={() => setRevealing(false)} onPin={stub.id ? () => pinStub(stub.id!, true) : undefined} />}
      <div className="mx-auto w-full max-w-[calc(680px+2rem)] tab:max-w-[calc(680px+3rem)] desk:max-w-[calc(680px+4rem)] px-4 tab:px-6 desk:px-8 flex flex-1 flex-col gap-6 pt-10 pb-40">
        <motion.p initial={PAGE_FROM} animate={PAGE_TO} transition={page} className="text-center text-body text-muted-foreground">
          {AUDIENCE_LINE[audience]}
        </motion.p>

        <AnimatePresence>
          {stub && !revealing && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={pop} className="flex justify-center">
              <StubArt face={stub} width={200} interactive shimmer={stub.kind === "drop" || stub.kind === "finish"} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {lover && (
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={shared}
              className="flex items-center gap-3 rounded-card bg-card p-4"
              role="status"
            >
              <Avatar className="size-9">
                {lover.avatarUrl && <AvatarImage src={lover.avatarUrl} alt="" className="object-cover" />}
                <AvatarFallback className="text-caption">{lover.name.trim().charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <p className="min-w-0 text-body">{`${lover.name.slice(0, 60)} loved your Moment`}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {(typeof cornerState === "object" || (!corner && cornerChoices && cornerChoices.length > 0)) && onAddCorner && cornerState !== "skipped" && (
          <section aria-labelledby="add-corner" className="flex flex-col gap-3">
            {typeof cornerState === "object" ? (
              <p role="status" className="text-body text-muted-foreground">{`Added to ${cornerState.added}`}</p>
            ) : (
              <>
                <h2 id="add-corner" className="text-lead font-semibold">
                  Add it to a Corner
                </h2>
                <div className="flex flex-wrap gap-2">
                  {(cornerChoices ?? []).map((c) => (
                    <Chip
                      key={`${c.spaceSlug}/${c.slug}`}
                      onClick={async () => {
                        const ok = await onAddCorner(c);
                        setCornerState(ok ? { added: c.name } : "failed");
                      }}
                    >
                      {c.name}
                    </Chip>
                  ))}
                  <button type="button" onClick={() => setCornerState("skipped")} className="min-h-11 px-3 text-small font-semibold text-muted-foreground underline underline-offset-4">
                    Skip
                  </button>
                </div>
                {cornerState === "failed" && (
                  <p role="alert" className="text-caption text-accent-text">
                    Couldn’t add it. Try again.
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {rows.length > 0 && (
          <section aria-labelledby="whats-next" className="flex flex-col gap-3">
            <h2 id="whats-next" className="font-[family-name:var(--font-display)] text-title font-bold">
              What’s next
            </h2>
            {rows.map((r, i) => (
              <MotionLink
                key={r.key}
                to={r.to}
                initial={PAGE_FROM}
                animate={PAGE_TO}
                transition={{ ...page, delay: 0.3 + i * 0.04 }}
                whileTap={{ scale: PRESS_SCALE }}
                className="flex min-h-11 items-center justify-between gap-3 rounded-card bg-card p-4"
              >
                <span className="min-w-0">
                  <span className="block text-body font-semibold">{r.title}</span>
                  {r.line && <span className="block text-small text-muted-foreground">{r.line}</span>}
                </span>
                <ArrowRight className="size-5 shrink-0 text-accent-text" strokeWidth={1.75} aria-hidden="true" />
              </MotionLink>
            ))}
          </section>
        )}

        {undo && (
          <div className="flex flex-col items-center gap-1">
            <button type="button" disabled={undo.busy} onClick={undo.onUndo} className="min-h-11 px-4 text-small font-semibold text-muted-foreground underline underline-offset-4 disabled:opacity-50">
              Undo
            </button>
            {undo.error && (
              <p role="alert" className="text-caption text-accent-text">
                {undo.error}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background">
        <div className="mx-auto w-full max-w-[calc(680px+2rem)] tab:max-w-[calc(680px+3rem)] desk:max-w-[calc(680px+4rem)] px-4 tab:px-6 desk:px-8 pt-3 pb-[max(1rem,var(--safe-bottom,0px))]">
          <Link to="/my-space" onClick={onDone} className="block">
            <PillButton variant="outline" className="w-full">
              Go to Home
            </PillButton>
          </Link>
        </div>
      </div>
    </div>
  );
}

