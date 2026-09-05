import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BookOpen, Check, ChevronDown, ChevronRight, Hammer, Sprout, Users } from "lucide-react";
import { intentsFor } from "../data/participation";
import { subHobbyLabel, getHobby } from "../data/hobbies";
import { useSocial } from "../context/SocialContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

/**
 * One primary action on a post, contextual to it: "Be part" opens a sheet of
 * four ways in, and the button afterwards shows the state you chose.
 *
 * None of these is a follow. "Keep exploring" attaches you to pottery — the
 * hobby — not to whoever threw the cups. The two mutual ones are requests
 * about a specific thing, and only an accepted one opens a message thread.
 */
type Option = "keep_exploring" | "join_in" | "make_together" | "explore_together";

const OPTIONS: {
  id: Option;
  label: string;
  icon: typeof Sprout;
  tint: string;
  copy: (hobby: string) => string;
}[] = [
  {
    id: "keep_exploring",
    label: "Keep exploring",
    icon: Sprout,
    tint: "var(--pastel-sage)",
    copy: (h) => `See more around ${h} (e.g. techniques, projects, people).`,
  },
  {
    id: "join_in",
    label: "Join in",
    icon: Users,
    tint: "var(--pastel-stone)",
    copy: () => "Take part in something happening (e.g. workshops, challenges, groups).",
  },
  {
    id: "make_together",
    label: "Make together",
    icon: Hammer,
    tint: "var(--pastel-clay)",
    copy: () => "Create or do something together (e.g. a project, collection, or idea).",
  },
  {
    id: "explore_together",
    label: "Explore together",
    icon: BookOpen,
    tint: "var(--pastel-sky)",
    copy: (h) => `Ask, compare, learn or share how you approach ${h}.`,
  },
];

const LIMIT = 200;

export function BePart({
  personName,
  personId,
  hobbySlug,
  subSlug,
  postId,
  activityTitle,
  activityWhen,
  activityWhere,
  isActivity,
  className = "",
}: {
  personName?: string;
  personId?: string;
  hobbySlug: string;
  subSlug?: string;
  postId?: number;
  activityTitle?: string;
  activityWhen?: string;
  activityWhere?: string;
  isActivity?: boolean;
  className?: string;
}) {
  const social = useSocial();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<Option | null>(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // You can't ask yourself, and you can't ask someone the app can't identify.
  const isSelf = !!user && !!personId && personId === user.id;
  const canAsk = !!personName && !!personId && !isSelf;

  useEffect(() => {
    if (!open) {
      setPane(null);
      setText("");
      setSent(false);
      setError(null);
      setSending(false);
    }
  }, [open]);

  const hobbyKey = subSlug ?? `space:${hobbySlug}`;
  const hobbyLabel = (
    (subSlug ? subHobbyLabel(subSlug) : undefined) ??
    getHobby(hobbySlug)?.shortName ??
    hobbySlug
  ).toLowerCase();

  const exploring = social.isFollowingHobby(hobbyKey);
  const going = postId ? social.isGoing(postId) : false;
  const goingCount = postId ? social.goingCount(postId) : 0;
  // Matched on user id only. Matching on name meant two people called Sam
  // shared a state, and matching on an absent id meant every unidentified
  // profile claimed you had already asked them.
  const pending = personId
    ? social.participations.find(
        (p) =>
          p.status === "pending" &&
          (p.kind === "make_together" || p.kind === "explore_together") &&
          p.toUser === personId,
      )
    : undefined;

  // The button reflects whichever state you're actually in.
  const state = going
    ? { label: "You're joining", icon: Check }
    : exploring
      ? { label: `Exploring ${hobbyLabel}`, icon: Sprout }
      : null;

  // All four ways in stay listed, so the choice never changes shape from one
  // post to the next. Join in still leads somewhere real on a moment with no
  // date on it — the hobby's own activities — rather than a dead pane.
  const options = OPTIONS.filter((o) => {
    if (o.id === "join_in") return !!postId;
    if (o.id === "make_together" || o.id === "explore_together") return canAsk;
    return true;
  });

  const send = async (kind: "make_together" | "explore_together") => {
    if (!text.trim() || !canAsk || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await social.requestTogether({
        kind,
        toUser: personId,
        toName: personName!,
        hobbyKey,
        postId,
        intent: text.trim().slice(0, LIMIT),
      });
      if (result?.error === "self") setError("That's you.");
      else if (result?.error === "no-recipient")
        setError("We can't reach this maker yet — try from their profile.");
      else setSent(true);
    } catch {
      setError("That didn't send. Check your connection and try again.");
    } finally {
      // Always runs, so the button can never stay stuck on "Sending…".
      setSending(false);
    }
  };

  const active = pane ? OPTIONS.find((o) => o.id === pane)! : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-colors ${
          state
            ? "text-[var(--forest)] [background-color:color-mix(in_srgb,var(--pastel-sage)_38%,var(--cream))]"
            : "text-white [background-color:var(--forest)]"
        } ${className}`}
      >
        {state ? (
          <>
            <state.icon className="size-4" strokeWidth={1.9} />
            {state.label}
          </>
        ) : (
          "Be part"
        )}
        <ChevronDown className="size-4 opacity-70" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          {!active ? (
            <>
              <DialogHeader className="gap-1 text-left">
                <DialogTitle className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                  Be part of this
                </DialogTitle>
                <DialogDescription className="leading-relaxed">
                  Different ways to engage, based on what you want to do next.
                </DialogDescription>
              </DialogHeader>

              <ul className="space-y-1">
                {options.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setPane(o.id)}
                      className="flex w-full items-center gap-3.5 rounded-2xl px-2 py-3 text-left transition-colors hover:bg-surface-muted"
                    >
                      <span
                        className="flex size-11 shrink-0 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${o.tint} 42%, var(--cream))`,
                        }}
                      >
                        <o.icon className="size-5 text-[var(--forest-ink)]" strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm">{o.label}</span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">
                          {o.copy(hobbyLabel)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>

              <p className="rounded-xl bg-surface-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                Each interaction helps you go deeper in what you love.
              </p>
            </>
          ) : (
            <>
              <DialogHeader className="text-left">
                <DialogTitle className="flex items-center gap-2.5 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `color-mix(in srgb, ${active.tint} 42%, var(--cream))` }}
                  >
                    <active.icon className="size-4 text-[var(--forest-ink)]" strokeWidth={1.7} />
                  </span>
                  {active.label}
                </DialogTitle>
                <DialogDescription className="sr-only">{active.copy(hobbyLabel)}</DialogDescription>
              </DialogHeader>

              {/* ── Keep exploring ─────────────────────────────────────── */}
              {active.id === "keep_exploring" && (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    You'll see more posts, activities and people around {hobbyLabel}.
                  </p>
                  {exploring ? (
                    <>
                      <div className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm text-[var(--forest)] [background-color:color-mix(in_srgb,var(--pastel-sage)_38%,var(--cream))]">
                        <Check className="size-4" />
                        Exploring {hobbyLabel}
                      </div>
                      <p className="text-center text-xs text-muted-foreground">
                        You can change this anytime.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => social.toggleHobbyFollow(hobbyKey, hobbyLabel)}
                      >
                        Stop exploring
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="w-full text-white [background-color:var(--forest)]"
                      onClick={() => social.toggleHobbyFollow(hobbyKey, hobbyLabel)}
                    >
                      Start exploring
                    </Button>
                  )}
                </>
              )}

              {/* ── Join in ────────────────────────────────────────────── */}
              {active.id === "join_in" && postId && !isActivity && (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Nothing scheduled on this one — it's a moment, not an
                    activity. There may be something happening in {hobbyLabel}{" "}
                    you can take part in.
                  </p>
                  <Link to={`/space/${hobbySlug}`} onClick={() => setOpen(false)}>
                    <Button variant="outline" className="w-full">
                      See what's happening in {hobbyLabel}
                    </Button>
                  </Link>
                </>
              )}

              {active.id === "join_in" && postId && isActivity && (
                <>
                  <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                    <div className="text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                      {activityTitle ?? "This activity"}
                    </div>
                    {activityWhen && (
                      <div className="mt-0.5 text-xs text-muted-foreground">{activityWhen}</div>
                    )}
                    {activityWhere && (
                      <div className="text-xs text-muted-foreground">{activityWhere}</div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {goingCount} going
                    </div>
                  </div>

                  {going ? (
                    <>
                      <div className="flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm text-[var(--forest)] [background-color:color-mix(in_srgb,var(--pastel-stone)_38%,var(--cream))]">
                        <Check className="size-4" />
                        You're joining
                      </div>
                      <p className="text-center text-xs text-muted-foreground">
                        You'll get updates about this activity.
                      </p>
                      <Button variant="outline" onClick={() => social.leaveActivity(postId)}>
                        Can't make it
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="w-full text-white [background-color:var(--forest)]"
                      onClick={() => social.joinIn(postId, activityTitle ?? hobbyLabel, personId)}
                    >
                      Join this
                    </Button>
                  )}
                </>
              )}

              {/* ── The two mutual ones ────────────────────────────────── */}
              {(active.id === "make_together" || active.id === "explore_together") && (
                <>
                  {sent ? (
                    <div className="rounded-2xl bg-surface-muted px-4 py-4">
                      <p className="mb-1 flex items-center gap-2 text-sm">
                        <Check className="size-4 text-[var(--forest)]" />
                        Sent to {personName}.
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        They'll be notified and can accept. Once accepted, you can message.
                      </p>
                    </div>
                  ) : pending ? (
                    <p className="rounded-2xl bg-surface-muted px-4 py-4 text-sm text-muted-foreground">
                      You've already asked {personName}. Waiting on them.
                    </p>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="bp-text" className="mb-2 block text-sm">
                          {active.id === "make_together"
                            ? "What would you like to make?"
                            : "What would you like to discuss?"}
                        </label>
                        <Textarea
                          id="bp-text"
                          value={text}
                          maxLength={LIMIT}
                          onChange={(e) => setText(e.target.value)}
                          placeholder={`e.g. ${intentsFor(active.id, subSlug, hobbySlug)
                            .slice(0, 3)
                            .join(", ")
                            .toLowerCase()}…`}
                          className="min-h-24"
                        />
                        <div className="mt-1 text-right text-[11px] text-muted-foreground">
                          {text.length}/{LIMIT}
                        </div>
                      </div>

                      {error && (
                        <p className="rounded-xl bg-surface-muted px-4 py-2.5 text-xs text-[var(--coral-text)]">
                          {error}
                        </p>
                      )}
                      <Button
                        className="w-full text-white [background-color:var(--forest)]"
                        disabled={!text.trim() || sending}
                        onClick={() => send(active.id as "make_together" | "explore_together")}
                      >
                        {sending ? "Sending…" : "Send request"}
                      </Button>
                      <p className="text-center text-xs leading-relaxed text-muted-foreground">
                        They'll be notified and can accept.
                        <br />
                        Once accepted, you can message.
                      </p>
                    </>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => setPane(null)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                ← All options
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
