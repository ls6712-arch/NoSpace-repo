import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Minus, Plus } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { Segmented } from "../ui/Segmented";
import { PillButton } from "../ui/PillButton";
import { AvatarStack } from "../ui/AvatarStack";
import { RollNumber } from "../ui/RollNumber";
import { useAuth } from "../../context/AuthContext";
import { addJoinedProject, startProject, type PursuitMember } from "../../lib/journal";
import { defaultMeasure } from "../../lib/pursuitProgress";
import {
  fetchPursuitAsProject,
  mirrorPursuit,
  mirrorPursuitMeasure,
} from "../../lib/pursuitsRemote";
import {
  fetchOpenPursuits,
  joinOpenPursuit,
  mirrorPursuitOpen,
  spotsLine,
  type OpenPursuit,
} from "../../lib/openPursuits";
import { COUNT_RANGE, clampCount, endsAtFor, nextWeeks, pursuitTitleFor } from "../../lib/pursuitGoal";
import { formatDateTime } from "../../lib/dates";
import { plural } from "../../lib/plural";
import { haptic } from "../../lib/motionTokens";
import { DEFAULT_CHECK_IN_DAYS } from "../../lib/journal";

type Who = "open" | "friends" | "solo";

/** How many people an open group you start can hold. */
const OWN_GROUP_CAPACITY = 8;

/**
 * "Make it a Pursuit": a bottom sheet over a Corner (screen 4). Who with (open
 * group, friends, just me), the best open group near you or the chance to start
 * one, and the goal as "Do {Corner} 5 times in 4 weeks". The button joins, or
 * starts, then morphs into a check and opens the Pursuit with its title growing
 * into the page's.
 */
export function MakeItAPursuitSheet({
  open,
  onOpenChange,
  corner,
  startOpenGroup = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  corner: { spaceSlug: string; slug: string; name: string };
  /** Opens on "Open group" with no group picked, so the button starts one (the host flow). */
  startOpenGroup?: boolean;
}) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<OpenPursuit[] | null>(null);
  const [who, setWho] = useState<Who>("friends");
  const [count, setCount] = useState(5);
  const [weeks, setWeeks] = useState(4);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDone(false);
    setRequested(false);
    setError(null);
    setGroups(null);
    let live = true;
    void fetchOpenPursuits(corner.spaceSlug, corner.slug).then((list) => {
      if (!live) return;
      setGroups(list);
      setWho(startOpenGroup || list.length > 0 ? "open" : "friends");
    });
    return () => {
      live = false;
    };
  }, [open, corner.spaceSlug, corner.slug, startOpenGroup]);

  // The best open group: the soonest session, then the newest. A group you are already in or were turned down by is skipped.
  const best = useMemo(() => (startOpenGroup ? undefined : groups?.find((g) => g.mine !== "declined" && g.taken < g.capacity)), [groups, startOpenGroup]);
  const joining = who === "open" && !!best;
  const hostName = best?.ownerName.slice(0, 40);

  const label = joining
    ? requested || best?.mine === "requested"
      ? "Requested"
      : `Join ${hostName}’s Pursuit`
    : who === "friends"
      ? "Start with friends"
      : "Start";

  const begin = async () => {
    if (busy || !user) return;
    setBusy(true);
    setError(null);
    try {
      if (joining && best) {
        const result = await joinOpenPursuit(best.pursuitId);
        if (!result.status) {
          setError(result.error ?? "");
          return;
        }
        if (result.status === "requested") {
          setRequested(true);
          return;
        }
        const project = await fetchPursuitAsProject(best.pursuitId);
        if (project) addJoinedProject({ ...project, role: "member" });
        finishAndGo(`/pursuit/${best.pursuitId}`);
        return;
      }

      const endsAt = endsAtFor(weeks);
      const mode = who === "solo" ? "solo" : "together";
      const owner: PursuitMember = {
        userId: user.id,
        username: profile?.username ?? null,
        displayName: profile?.display_name?.trim() || "You",
        avatarUrl: profile?.avatar_url,
        status: "joined",
        role: "owner",
      };
      const project = startProject({
        title: pursuitTitleFor(corner.name, count, weeks),
        hobbySlug: corner.spaceSlug,
        subHobby: corner.slug,
        measure: { ...defaultMeasure("count"), target: count, unit: "times", targetDate: endsAt },
        mode,
        members: mode === "solo" ? [] : [owner],
        checkInDays: DEFAULT_CHECK_IN_DAYS,
        // An open group has to be readable by people who are not in it yet.
        shared: who === "open",
      });
      await mirrorPursuit(user.id, project);
      await mirrorPursuitMeasure(project.id, mode, project.measure);
      await mirrorPursuitOpen(project.id, { visibility: who, capacity: OWN_GROUP_CAPACITY, endsAt });
      finishAndGo(`/pursuit/${project.id}?new=1`);
    } finally {
      setBusy(false);
    }
  };

  const finishAndGo = (to: string) => {
    haptic();
    setDone(true);
    window.setTimeout(() => {
      onOpenChange(false);
      void navigate(to, { viewTransition: true });
    }, 450);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Make it a Pursuit"
      description="A small goal with an end date."
      footer={
        <div className="flex flex-col items-center gap-2">
          {error && (
            <p role="alert" className="text-caption text-accent-text">
              {error}
            </p>
          )}
          {requested && <p className="text-caption text-muted-foreground">The host will let you in.</p>}
          <PillButton
            className="w-full"
            disabled={busy || requested || best?.mine === "requested"}
            done={done}
            doneLabel={joining ? "You’re in" : "Started"}
            onClick={() => void begin()}
          >
            {label}
          </PillButton>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pt-2">
        <div className="flex flex-col gap-2">
          <p className="text-small text-muted-foreground">Who with</p>
          <Segmented
            label="Who with"
            value={who}
            onChange={setWho}
            options={[
              { value: "open", label: "Open group" },
              { value: "friends", label: "Friends" },
              { value: "solo", label: "Just me" },
            ]}
          />
        </div>

        {who === "open" &&
          (best ? (
            <div className="flex flex-col gap-3 rounded-card border border-accent bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-body font-semibold">{best.title}</p>
                <span className="shrink-0 rounded-full bg-[var(--cat-amber)] px-3 py-1 text-caption font-semibold text-[var(--ink)]">
                  {spotsLine(best.taken, best.capacity)}
                </span>
              </div>
              <p className="text-small text-muted-foreground">
                {`Hosted by ${hostName}`}
                {best.session && ` · First session ${formatDateTime(best.session.startsAt)}${best.session.place ? `, ${best.session.place}` : ""}`}
                {" · or do your own version at home"}
              </p>
              {best.people.length > 0 && <AvatarStack people={best.people} total={best.taken} />}
            </div>
          ) : (
            groups !== null && (
              <p className="rounded-card bg-card p-4 text-small text-muted-foreground">
                {`No open group for ${corner.name} yet. Start one and up to ${OWN_GROUP_CAPACITY} people can join.`}
              </p>
            )
          ))}

        {!joining && (
          <div className="flex flex-col gap-2">
            <p className="text-small text-muted-foreground">Goal</p>
            <div className="flex items-center justify-between gap-3 rounded-card bg-card p-4">
              <p className="text-body">
                {`Do ${corner.name} `}
                <strong className="font-bold">
                  <RollNumber value={count} />
                </strong>
                {" times in "}
                <button
                  type="button"
                  onClick={() => setWeeks((w) => nextWeeks(w))}
                  aria-label={`${plural(weeks, "week")}. Tap to change`}
                  className="min-h-11 font-bold underline decoration-dotted underline-offset-4"
                >
                  <RollNumber value={weeks} />
                  {weeks === 1 ? " week" : " weeks"}
                </button>
              </p>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  aria-label="Fewer times"
                  disabled={count <= COUNT_RANGE.min}
                  onClick={() => setCount((c) => clampCount(c - 1))}
                  className="flex size-11 items-center justify-center rounded-full border border-foreground/30 disabled:opacity-40"
                >
                  <Minus className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="More times"
                  disabled={count >= COUNT_RANGE.max}
                  onClick={() => setCount((c) => clampCount(c + 1))}
                  className="flex size-11 items-center justify-center rounded-full border border-foreground/30 disabled:opacity-40"
                >
                  <Plus className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
