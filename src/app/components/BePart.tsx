import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Compass, Handshake, MessagesSquare, UserPlus } from "lucide-react";
import {
  ACTIONS,
  ACTION_ORDER,
  ParticipationKind,
  hasHobbyContext,
  intentsFor,
} from "../data/participation";
import { subHobbyLabel, getHobby } from "../data/hobbies";
import { useSocial } from "../context/SocialContext";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

const ICON: Record<ParticipationKind, typeof Compass> = {
  keep_exploring: Compass,
  join_in: UserPlus,
  make_together: Handshake,
  explore_together: MessagesSquare,
};

/**
 * One button, four ways to be part of something.
 *
 * This deliberately replaces Follow. Following a person makes the person the
 * unit; here the unit is the hobby or the thing being done. "Keep exploring"
 * attaches you to Film Photography, not to whoever posted it — you can be deep
 * in a hobby without owing anyone a relationship.
 *
 * The primary action is whichever one this context calls for: an activity you
 * could turn up to shows Join in; anything else leads with Keep exploring. The
 * rest live behind the menu so all four are never shouted at once.
 */
export function BePart({
  personName,
  personId,
  hobbySlug,
  subSlug,
  postId,
  activityTitle,
  isActivity,
  className = "",
}: {
  /** Absent on a hobby page — the two mutual actions need a person. */
  personName?: string;
  personId?: string;
  hobbySlug: string;
  subSlug?: string;
  postId?: number;
  activityTitle?: string;
  isActivity?: boolean;
  className?: string;
}) {
  const social = useSocial();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<null | "make_together" | "explore_together">(null);
  const [intent, setIntent] = useState<string>("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [side, setSide] = useState<"left" | "right">("right");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    // 288px is the menu's width; anchor to whichever edge leaves it on screen.
    setSide(box.right - 288 < 8 ? "left" : "right");
  }, [open]);

  const hobbyKey = subSlug ?? `space:${hobbySlug}`;
  const hobbyLabel =
    (subSlug ? subHobbyLabel(subSlug) : undefined) ?? getHobby(hobbySlug)?.shortName ?? hobbySlug;
  const following = social.isFollowingHobby(hobbyKey);
  const going = postId ? social.isGoing(postId) : false;

  // Anything already asked for and still waiting.
  const pending = social.participations.find(
    (p) =>
      p.status === "pending" &&
      (p.kind === "make_together" || p.kind === "explore_together") &&
      (p.toName === personName || p.toUser === personId),
  );
  const accepted = personName ? social.threadWith(personName) : undefined;

  const primary: ParticipationKind = isActivity && postId ? "join_in" : "keep_exploring";
  const others = ACTION_ORDER.filter((k) => k !== primary).filter(
    // The mutual ones need someone to ask.
    (k) => (k === "make_together" || k === "explore_together" ? !!personName : true),
  ).filter((k) => (k === "join_in" ? !!postId && !!isActivity : true));

  const runPrimary = () => {
    if (primary === "join_in" && postId) {
      going
        ? social.leaveActivity(postId)
        : social.joinIn(postId, activityTitle ?? hobbyLabel, personId);
    } else {
      social.toggleHobbyFollow(hobbyKey, hobbyLabel);
    }
  };

  const primaryLabel =
    primary === "join_in"
      ? going
        ? "Going"
        : "Join in"
      : following
        ? `Exploring ${hobbyLabel}`
        : "Keep exploring";

  const choose = (kind: ParticipationKind) => {
    setOpen(false);
    if (kind === "keep_exploring") {
      social.toggleHobbyFollow(hobbyKey, hobbyLabel);
      return;
    }
    if (kind === "join_in") {
      if (postId) {
        going
          ? social.leaveActivity(postId)
          : social.joinIn(postId, activityTitle ?? hobbyLabel, personId);
      }
      return;
    }
    setIntent("");
    setNote("");
    setSent(false);
    setAsking(kind);
  };

  const send = async () => {
    if (!asking || !intent || !personName) return;
    await social.requestTogether({
      kind: asking,
      toUser: personId,
      toName: personName,
      hobbyKey,
      postId,
      intent,
      note: note.trim() || undefined,
    });
    setSent(true);
  };

  const intents = asking ? intentsFor(asking, subSlug, hobbySlug) : [];
  const generic = !hasHobbyContext(subSlug, hobbySlug);

  return (
    <>
      <div className={`relative inline-flex ${className}`} ref={ref}>
        <Button
          variant={
            (primary === "join_in" && going) || (primary === "keep_exploring" && following)
              ? "outline"
              : "coral"
          }
          size="sm"
          className="rounded-r-none"
          onClick={runPrimary}
          aria-pressed={primary === "join_in" ? going : following}
        >
          {(() => {
            const Icon = ICON[primary];
            return <Icon className="size-3.5" />;
          })()}
          {primaryLabel}
        </Button>
        <Button
          variant={
            (primary === "join_in" && going) || (primary === "keep_exploring" && following)
              ? "outline"
              : "coral"
          }
          size="sm"
          className="rounded-l-none border-l border-white/25 px-2"
          aria-label="Other ways to be part"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <ChevronDown className="size-3.5" />
        </Button>

        {open && (
          <div className={`absolute top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-popover shadow-xl ${
              side === "left" ? "left-0" : "right-0"
            }`}>
            <div className="border-b border-[var(--hairline)] px-4 py-2.5 text-xs text-muted-foreground">
              Be part of {hobbyLabel}
            </div>
            <ul className="py-1">
              {others.map((kind) => {
                const action = ACTIONS[kind];
                const Icon = ICON[kind];
                const isPending =
                  pending &&
                  (pending.kind as string) === kind;
                return (
                  <li key={kind}>
                    <button
                      type="button"
                      disabled={!!isPending}
                      onClick={() => choose(kind)}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-[var(--forest)]" />
                      <span className="min-w-0">
                        <span className="block text-sm">
                          {action.label}
                          {kind === "keep_exploring" && following ? " · already exploring" : ""}
                          {isPending ? " · asked" : ""}
                        </span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">
                          {kind === "keep_exploring"
                            ? `Follows ${hobbyLabel}, not a person.`
                            : action.copy}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {accepted && (
              <p className="border-t border-[var(--hairline)] px-4 py-2.5 text-xs text-muted-foreground">
                You and {personName} are already {accepted.kind === "make_together" ? "making" : "exploring"}{" "}
                together — messaging is open.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Asking to do something specific, together */}
      <Dialog open={!!asking} onOpenChange={(o) => !o && setAsking(null)}>
        <DialogContent className="max-w-md">
          {asking && (
            <>
              <DialogHeader>
                <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>
                  {ACTIONS[asking].label}
                  {personName ? ` with ${personName}` : ""}
                </DialogTitle>
                <DialogDescription>
                  {sent
                    ? `${personName} has to accept before anything opens up — including messages.`
                    : `About ${hobbyLabel}. Pick the thing you actually want to do.`}
                </DialogDescription>
              </DialogHeader>

              {sent ? (
                <div className="rounded-2xl border border-border bg-surface-muted px-4 py-4 text-sm">
                  <p className="mb-1 flex items-center gap-2">
                    <Check className="size-4 text-[var(--coral-deep)]" />
                    Asked.
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    “{intent}” — waiting on {personName}. You'll get a notification
                    either way, and messaging opens only if they accept.
                  </p>
                </div>
              ) : (
                <>
                  <ul className="flex flex-wrap gap-2">
                    {intents.map((option) => (
                      <li key={option}>
                        <button
                          type="button"
                          aria-pressed={intent === option}
                          onClick={() => setIntent(option)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                            intent === option
                              ? "border-transparent text-white [background-color:var(--coral-deep)]"
                              : "border-border bg-card text-foreground hover:border-[var(--foreground)]/35"
                          }`}
                        >
                          {option}
                          {intent === option && <Check className="size-3" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {generic && (
                    <p className="text-xs text-muted-foreground">
                      Generic wording — this hobby doesn't have its own phrasing yet.
                    </p>
                  )}

                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anything you want to add — optional"
                  />

                  <Button variant="coral" disabled={!intent} onClick={send}>
                    Ask {personName}
                  </Button>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
