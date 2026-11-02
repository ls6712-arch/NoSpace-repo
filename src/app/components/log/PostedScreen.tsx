import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { StubArt } from "../stub/StubArt";
import { StubReveal } from "../stub/StubReveal";
import { Stubby } from "../stubby/Stubby";
import { PillButton } from "../ui/PillButton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { EndingDialog } from "../EndingDialog";
import { PunchCard } from "./PunchCard";
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
import type { Project } from "../../lib/journal";
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

/** What the Moment moved forward, worded by Log (lib/punchCards.ts has the numbers). */
export interface PostedPunch {
  /** "4 of 10 days in Pottery". */
  headline: string;
  /** "6 more days in November and you keep a Regular Stub." */
  line: string;
  /** The Stub's name on the card's stub end: Regular or Finisher. */
  label: string;
  done: number;
  total: number;
  /** This Moment punched the last filled hole. */
  fresh: boolean;
  /** A second card it moved, in one line: "Also a day in Bread baking: 7 of 10 days". */
  also?: string;
}

/** One tap after posting: count the Moment toward a Pursuit or a Corner. */
export interface PostedChoice {
  key: string;
  label: string;
  /** "Pursuit · 2 of 3 days" or "3 of 10 days this month". */
  line?: string;
}

/**
 * Posted (screen 7): who it was posted to and when they see it, Stubby's jump,
 * the punch card this Moment moved, and, when nothing was picked in Log, one
 * optional tap to count it toward a Pursuit or a Corner. A Stub, when this
 * Moment earned one, is issued by the database in the same transaction and
 * revealed here; a Pursuit with no goal that has its 3 days offers Finish.
 * Then a card if someone loves the Moment while you are here, what's next,
 * Log another and a way home.
 */
export function PostedScreen({
  postId,
  audience,
  holdLine,
  punch,
  corner,
  pursuit,
  place,
  undo,
  choices,
  choicesLine,
  onChoose,
  finish,
  onLogAnother,
  onDone,
}: {
  postId: number | null;
  audience: PostedAudience;
  /** "They see it at 7:17 PM." while the Moment is held back. */
  holdLine?: string;
  punch?: PostedPunch;
  corner?: { spaceSlug: string; slug: string; name: string };
  pursuit?: { id: string; done: number; total: number; otherNames: string[] };
  place?: string;
  undo?: { onUndo: () => void; busy: boolean; error: string | null };
  /** Shown only when nothing was picked in Log. Nothing is added until one is tapped. */
  choices?: PostedChoice[];
  choicesLine?: string;
  onChoose?: (key: string) => Promise<boolean>;
  /** A Pursuit with no goal and 3 days: Finish keeps the Finisher. */
  finish?: Project;
  onLogAnother?: () => void;
  onDone?: () => void;
}) {
  const [choiceState, setChoiceState] = useState<"offer" | "skipped" | "busy" | "added" | "failed">("offer");
  const [stub, setStub] = useState<StubFace | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [lover, setLover] = useState<{ name: string; avatarUrl?: string } | null>(null);
  const [nextSession, setNextSession] = useState<number | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  // Bumped after a Corner or Pursuit is added, or a Pursuit is finished, so a
  // Stub that change earned is looked up again.
  const [stubTick, setStubTick] = useState(0);

  const related = useMemo(() => (corner ? relatedCorner(corner.spaceSlug, corner.slug) : undefined), [corner]);

  // The database issues any Stub in the same transaction as the Moment (or the change).
  useEffect(() => {
    if (postId == null) return;
    let live = true;
    const look = () =>
      fetchEarnedStub(postId).then(async (e) => {
        if (!e || !live) return;
        const cover = e.coverPath ? (await signMomentPaths([e.coverPath])).get(e.coverPath) : undefined;
        if (!live) return;
        setStub(faceFromEarned(e, cover));
        setRevealing(true);
      });
    // A Finish is written a moment after the dialog closes; look once more after it lands.
    const timer = stubTick > 0 ? window.setTimeout(() => void look(), 1500) : undefined;
    void look();
    return () => {
      live = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [postId, stubTick]);

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

  const offering = !punch && !!onChoose && !!choices?.length && (choiceState === "offer" || choiceState === "busy" || choiceState === "failed");

  return (
    <div className="flex min-h-viewport flex-col bg-background">
      {stub && revealing && <StubReveal face={stub} onDone={() => setRevealing(false)} onPin={stub.id ? () => pinStub(stub.id!, true) : undefined} />}
      <div className="mx-auto w-full max-w-[calc(680px+2rem)] tab:max-w-[calc(680px+3rem)] desk:max-w-[calc(680px+4rem)] px-4 tab:px-6 desk:px-8 flex flex-1 flex-col items-center gap-5 pt-10 pb-48">
        <Stubby state="done" size={96} label="" />

        <motion.div initial={PAGE_FROM} animate={PAGE_TO} transition={page} className="flex flex-col items-center gap-1 text-center">
          {punch ? (
            <>
              <h1 className="text-title font-bold" style={{ fontFamily: "var(--font-display)" }}>
                {punch.headline}
              </h1>
              <p className="text-body text-muted-foreground">{punch.line}</p>
            </>
          ) : (
            <h1 className="text-title font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {AUDIENCE_LINE[audience]}
            </h1>
          )}
        </motion.div>

        {punch && (
          <div className="flex w-full flex-col gap-2">
            <PunchCard label={punch.label} done={punch.done} total={punch.total} fresh={punch.fresh} ariaLabel={punch.headline} />
            {punch.also && <p className="text-small text-muted-foreground">{punch.also}</p>}
          </div>
        )}

        <p className="w-full text-center text-small text-muted-foreground">
          {punch ? `${AUDIENCE_LINE[audience]}. ` : ""}
          {holdLine ?? ""}
        </p>

        {finish && (
          <section className="flex w-full flex-col gap-3 rounded-card bg-card p-4">
            <p className="text-body">Finish it now and keep a Finisher Stub.</p>
            <PillButton className="w-full" onClick={() => setFinishOpen(true)}>
              Finish
            </PillButton>
            <EndingDialog
              open={finishOpen}
              onOpenChange={(o) => {
                setFinishOpen(o);
                if (!o) setStubTick((t) => t + 1);
              }}
              project={finish}
              mode="finish"
            />
          </section>
        )}

        <AnimatePresence>
          {stub && !revealing && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={pop} className="flex justify-center">
              <StubArt face={stub} width={200} interactive shimmer={stub.kind === "drop" || stub.kind === "finish"} />
            </motion.div>
          )}
        </AnimatePresence>

        {offering && (
          <section aria-labelledby="counts-toward" className="flex w-full flex-col gap-3 rounded-card border-2 border-dashed border-[var(--accent-text)] bg-card p-4">
            <div>
              <h2 id="counts-toward" className="text-lead font-semibold">
                Counts toward
              </h2>
              {choicesLine && <p className="text-small text-muted-foreground">{choicesLine}</p>}
            </div>
            <div className="flex flex-col gap-2">
              {(choices ?? []).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  disabled={choiceState === "busy"}
                  onClick={async () => {
                    setChoiceState("busy");
                    const ok = onChoose ? await onChoose(c.key) : false;
                    setChoiceState(ok ? "added" : "failed");
                    if (ok) setStubTick((t) => t + 1);
                  }}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-control border border-border bg-surface-muted px-4 text-left disabled:opacity-60"
                >
                  <span className="text-body font-semibold">{c.label}</span>
                  {c.line && <span className="shrink-0 text-caption text-muted-foreground">{c.line}</span>}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setChoiceState("skipped")}
              className="min-h-11 self-start px-1 text-small font-semibold text-muted-foreground underline underline-offset-4"
            >
              Skip
            </button>
            {choiceState === "failed" && (
              <p role="alert" className="text-caption text-accent-text">
                Couldn’t add it. Try again.
              </p>
            )}
          </section>
        )}

        <AnimatePresence>
          {lover && (
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={shared}
              className="flex w-full items-center gap-3 rounded-card bg-card p-4"
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

        {rows.length > 0 && (
          <section aria-labelledby="whats-next" className="flex w-full flex-col gap-3">
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
        {place && <p className="text-caption text-muted-foreground">{place}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background">
        <div className="mx-auto flex w-full max-w-[calc(680px+2rem)] tab:max-w-[calc(680px+3rem)] desk:max-w-[calc(680px+4rem)] flex-col gap-1 px-4 tab:px-6 desk:px-8 pt-3 pb-[max(1rem,var(--safe-bottom,0px))]">
          <div className="grid grid-cols-2 gap-3">
            {onLogAnother ? (
              <PillButton className="w-full" onClick={onLogAnother}>
                Log another
              </PillButton>
            ) : (
              <span />
            )}
            <Link to="/my-space" onClick={onDone} className="block">
              <PillButton variant="outline" className="w-full">
                Go to Home
              </PillButton>
            </Link>
          </div>
          {undo && (
            <div className="flex flex-col items-center">
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
      </div>
    </div>
  );
}
