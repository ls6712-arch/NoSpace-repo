import { useEffect, useState } from "react";
import { Check, Clock, Compass, Send, Sprout, UserPlus } from "lucide-react";
import { hobbies, subHobbyLabel, getHobby } from "../data/hobbies";
import { useSocial } from "../context/SocialContext";
import { useConnections } from "../context/ConnectionsContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

/**
 * The three things you can do about another person.
 *
 *   Explore          attaches you to a hobby, not to them. No permission
 *                    needed, because nothing about them changes.
 *   Connect          asks them. Nothing private happens until they accept.
 *   Invite           asks them into the narrowest scope this context
 *                    actually has — a Corner or Circle a Moment belongs to,
 *                    falling back to the whole Space only when there's
 *                    nothing narrower to offer.
 *
 * The distinction that matters: Explore is one-way and about a subject;
 * the other two are requests to a person, and both wait for a yes.
 */
type Pane = "explore" | "connect" | "invite" | null;

export function PersonActions({
  personName,
  personId,
  /** Hobbies this person works in, so Explore has something concrete to offer. */
  hobbyKeys = [],
  /**
   * Explore stays on by default (the Space hero and a profile's own action
   * row both still use it) — only a Moment card's own per-post row turns it
   * off. Repeating "follow this hobby" on every card of a feed you're
   * already browsing was redundant, and it overloaded "Explore" with a
   * second meaning the Space-hero button already has.
   */
  showExplore = true,
  /**
   * The Corner this context actually belongs to, if any — a Moment's own
   * subHobby tag, resolved to a display name. When set, Invite defaults
   * straight to this Corner instead of the generic Space picker. Corners
   * have no membership of their own to invite into, so under the hood this
   * still uses the same Space invite-and-accept mechanic, aimed at a Space
   * auto-matched (or made) for this Corner rather than asked about up
   * front — the person inviting never needs to know that detail.
   */
  corner,
  /**
   * The Circle this context actually belongs to, if any — a Moment posted
   * with circle visibility. Takes priority over corner when a Moment
   * somehow has both, since a Circle is a more deliberate scope than a
   * topic tag. Circles have real, existing membership (join to see updates)
   * that Invite must not bypass — see inviteToCircle/circle_invites.
   */
  circle,
  compact = false,
  className = "",
}: {
  personName?: string;
  personId?: string;
  hobbyKeys?: string[];
  showExplore?: boolean;
  corner?: { spaceSlug: string; slug: string; name: string };
  circle?: { id: number; hobbySlug: string; name: string };
  /** Smaller buttons for a denser card. Opens the exact same dialogs. */
  compact?: boolean;
  className?: string;
}) {
  const social = useSocial();
  const connections = useConnections();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [pane, setPane] = useState<Pane>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [chosenHobby, setChosenHobby] = useState<string | null>(null);
  const [chosenSpace, setChosenSpace] = useState<string>("");
  const [newSpaceName, setNewSpaceName] = useState("");
  const [ownInterest, setOwnInterest] = useState("");
  // "context" invites straight to the Corner or Circle this row is scoped
  // to; "space" is the escape hatch back to the original, unscoped picker.
  // Only ever means anything when a Corner or Circle was actually passed in.
  const [inviteScope, setInviteScope] = useState<"context" | "space">("context");

  useEffect(() => {
    if (!open) {
      setNote("");
      setError(null);
      setDone(null);
      setBusy(false);
      setChosenHobby(null);
      setChosenSpace("");
      setNewSpaceName("");
      setOwnInterest("");
      setPane(null);
      setInviteScope("context");
    }
  }, [open]);

  const isSelf = !!user && !!personId && personId === user.id;
  // Both of these write to the database as you, so they need an account.
  // Offering them signed out produced a failure instead of a prompt.
  const canAsk = !!user && !!personId && !!personName && !isSelf;
  const status = personId ? connections.statusWith(personId) : "none";
  const existing = personId ? connections.connectionWith(personId) : undefined;

  // A Circle is a more deliberate scope than a topic tag, so it wins if a
  // Moment somehow carries both.
  const narrowContext = circle
    ? { kind: "circle" as const, name: circle.name, hobbySlug: circle.hobbySlug }
    : corner
      ? { kind: "corner" as const, name: corner.name, hobbySlug: corner.spaceSlug }
      : null;
  const parentSpaceLabel = narrowContext
    ? (getHobby(narrowContext.hobbySlug)?.shortName ?? narrowContext.hobbySlug)
    : null;
  const inContextInvite = !!narrowContext && inviteScope === "context";

  // What Explore can offer: the hobbies this person actually works in, or the
  // whole list if we don't know yet. Either way you pick the subject.
  const exploreOptions = (hobbyKeys.length > 0 ? hobbyKeys : hobbies.map((h) => h.slug))
    .map((key) => {
      const isSpace = key.startsWith("space:");
      const slug = isSpace ? key.slice(6) : key;
      const label = subHobbyLabel(slug) ?? getHobby(slug)?.shortName ?? slug;
      return { key: isSpace || getHobby(slug) ? `space:${slug}` : slug, label };
    })
    .filter((o, i, all) => all.findIndex((x) => x.key === o.key) === i)
    .slice(0, 10);

  const startExplore = async (key: string, hobbyLabel: string) => {
    await social.toggleHobbyFollow(key, hobbyLabel);
    setDone(
      social.isFollowingHobby(key)
        ? `Stopped exploring ${hobbyLabel.toLowerCase()}.`
        : `Exploring ${hobbyLabel.toLowerCase()}.`,
    );
  };

  const sendConnect = async () => {
    if (!personId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await connections.requestConnection(personId, note);
      if (res.error) setError(res.error);
      else setDone("Request sent.");
    } catch {
      setError("That didn't send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendInvite = async () => {
    if (!personId || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (inContextInvite && circle) {
        const res = await connections.inviteToCircle(circle.id, personId, note);
        if (res.error) setError(res.error);
        else setDone("Invitation sent.");
        return;
      }

      if (inContextInvite && corner) {
        // Corners have no membership of their own — this reuses the exact
        // same Space invite-and-accept mechanic as the fallback below, just
        // aimed automatically at a Space already scoped to this Corner
        // (reusing one of my own if I already made one) instead of asking
        // "which Space?" up front. Matched by name, not `interest`, so the
        // Inbox's own "invited you to X · Y" rendering doesn't show the
        // same word twice.
        let target = connections.mySpaces.find(
          (s) => s.hobbySlug === corner.spaceSlug && s.name.toLowerCase() === corner.name.toLowerCase(),
        );
        if (!target) {
          const created = await connections.createSpace({
            name: corner.name,
            hobbySlug: corner.spaceSlug,
          });
          if (!created.space) {
            setError(created.error ?? "Couldn't set that up.");
            return;
          }
          target = created.space;
        }
        const res = await connections.inviteToSpace(target.id, personId, note);
        if (res.error) setError(res.error);
        else setDone("Invitation sent.");
        return;
      }

      // The original, unscoped flow — reached directly when a post has no
      // narrower context, or via the "invite to the Space instead" escape
      // hatch when it does.
      let spaceId = chosenSpace;
      if (!spaceId && newSpaceName.trim()) {
        const created = await connections.createSpace({
          name: newSpaceName.trim(),
          interest: chosenHobby ?? undefined,
        });
        if (!created.space) {
          setError(created.error ?? "Couldn't make that Space.");
          return;
        }
        spaceId = String(created.space.id);
      }
      if (!spaceId) {
        setError("Choose a Space, or name a new one.");
        return;
      }
      const res = await connections.inviteToSpace(spaceId, personId, note);
      if (res.error) setError(res.error);
      else setDone("Invitation sent.");
    } catch {
      setError("That didn't send. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const OPTIONS = [
    {
      id: "explore" as const,
      label: "Explore",
      icon: Compass,
      tint: "var(--pastel-sage)",
      copy: "Follow a hobby they work in, the subject, not the person.",
      show: showExplore,
    },
    {
      id: "connect" as const,
      label: status === "connected" ? "Connected" : "Connect",
      icon: UserPlus,
      tint: "var(--pastel-clay)",
      copy:
        status === "connected"
          ? "You're connected. You can message each other."
          : status === "pending_out"
            ? "Request sent. Waiting on them."
            : "Send a connection request, with a short note if you like.",
      show: canAsk,
    },
    {
      id: "invite" as const,
      label: inContextInvite ? `Invite to ${narrowContext!.name}` : "Invite to Space",
      icon: Send,
      tint: "var(--pastel-sky)",
      copy: narrowContext
        ? `Ask them to join ${narrowContext.name}.`
        : "Ask them into a Space you're part of.",
      show: canAsk,
    },
  ].filter((o) => o.show);

  // Nothing to ask, and Explore turned off for this row (a Moment card) —
  // there is genuinely nothing to render, rather than an empty bordered box.
  if (OPTIONS.length === 0) return null;

  const active = OPTIONS.find((o) => o.id === pane);
  // A literal class per count, not a template string — Tailwind's build only
  // picks up class names it can see written out, so "grid-cols-" + n would
  // silently produce no columns at all in the production build.
  const gridColsClass =
    OPTIONS.length === 1 ? "grid-cols-1" : OPTIONS.length === 2 ? "grid-cols-2" : "grid-cols-3";

  // Connect and Invite only appear when there's an actual person to ask;
  // Explore, where it's still shown, asks nothing of anyone.
  return (
    <>
      <div className={`grid gap-2 ${gridColsClass} ${className}`}>
        {OPTIONS.map((o) => {
          const isConnect = o.id === "connect";
          const primary = isConnect && status === "none";
          const settled = isConnect && (status === "connected" || status === "pending_out");
          return (
            <button
              key={o.id}
              type="button"
              aria-haspopup="dialog"
              onClick={() => {
                setPane(o.id);
                setOpen(true);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors ${
                compact ? "min-h-8 px-2 py-1.5 text-[11px]" : "min-h-11 px-3 py-2.5 text-[13px]"
              } ${
                primary
                  ? "text-white [background-image:var(--gradient-brand)]"
                  : settled
                    ? "text-foreground [background-color:color-mix(in_srgb,var(--pastel-sage)_38%,var(--surface-elevated))]"
                    : "border border-border bg-surface text-foreground hover:border-[var(--foreground)]/35"
              }`}
            >
              {isConnect && status === "connected" ? (
                <Check className="size-3.5 shrink-0" strokeWidth={2} />
              ) : isConnect && status === "pending_out" ? (
                <Clock className="size-3.5 shrink-0" strokeWidth={2} />
              ) : (
                <o.icon className="size-3.5 shrink-0" strokeWidth={1.9} />
              )}
              {/* Never ellipsis: a clipped "Conn…" or "Inv…" reads as broken,
                  not abbreviated. Two buttons at full labels comfortably fit
                  even the narrowest supported card column; whitespace-nowrap
                  keeps a two-word label ("Invite to Space" doesn't appear
                  here — see the shorter labels below — but "Connected" or
                  "Invite" could still wrap awkwardly without it) on one
                  line rather than breaking mid-word. */}
              <span className="whitespace-nowrap">
                {isConnect && status === "pending_out"
                  ? "Sent"
                  : o.id === "invite"
                    ? "Invite"
                    : o.label}
              </span>
            </button>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          {active && (
            <>
              <DialogHeader className="text-left">
                <DialogTitle
                  className="flex items-center gap-2.5 text-lg"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: `color-mix(in srgb, ${active.tint} 42%, var(--surface-elevated))` }}
                  >
                    <active.icon className="size-4 text-foreground" strokeWidth={1.7} />
                  </span>
                  {active.label}
                </DialogTitle>
                <DialogDescription className="sr-only">{active.copy}</DialogDescription>
              </DialogHeader>

              {/* ── Explore: pick the hobby, not the person ─────────────── */}
              {active.id === "explore" && (
                <>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Which hobby do you want to see more of? You'll follow the
                    hobby itself. {personName ?? "they"} won't be notified, and
                    you aren't following them.
                  </p>
                  <ul className="max-h-52 space-y-1 overflow-y-auto">
                    {exploreOptions.map((o) => {
                      const following = social.isFollowingHobby(o.key);
                      return (
                        <li key={o.key}>
                          <button
                            type="button"
                            onClick={() => startExplore(o.key, o.label)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 text-left text-sm transition-colors hover:border-[var(--foreground)]/30"
                          >
                            {o.label}
                            {following ? (
                              <span className="flex shrink-0 items-center gap-1 text-xs text-foreground">
                                <Sprout className="size-3.5" />
                                Exploring
                              </span>
                            ) : (
                              <span className="shrink-0 text-xs text-muted-foreground">Explore</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {/* The list is what they happen to work in — never the set of
                      hobbies that exist. Anything you can name, you can follow. */}
                  <div className="border-t border-[var(--hairline)] pt-4">
                    <label htmlFor="explore-own" className="mb-2 block text-sm">
                      Not listed? Enter your own
                    </label>
                    <div className="flex gap-2">
                      <Input
                        id="explore-own"
                        value={ownInterest}
                        maxLength={40}
                        onChange={(e) => setOwnInterest(e.target.value)}
                        placeholder="Pottery, bouldering, sourdough…"
                      />
                      <Button
                        variant="outline"
                        disabled={!ownInterest.trim()}
                        onClick={() => {
                          const label = ownInterest.trim();
                          startExplore(`interest:${label.toLowerCase()}`, label);
                          setOwnInterest("");
                        }}
                      >
                        Explore
                      </Button>
                    </div>
                  </div>
                  {done && <p className="text-center text-xs text-muted-foreground">{done}</p>}
                </>
              )}

              {/* ── Connect: a request, and nothing before the yes ──────── */}
              {active.id === "connect" && (
                <>
                  {status === "connected" ? (
                    <p className="rounded-2xl bg-surface-muted px-4 py-4 text-sm leading-relaxed">
                      You're connected with {personName}. They're in your Home
                      feed, and you can message each other from the Inbox.
                    </p>
                  ) : status === "pending_out" || done ? (
                    <>
                      <div className="rounded-2xl bg-surface-muted px-4 py-4">
                        <p className="mb-1 flex items-center gap-2 text-sm">
                          <Clock className="size-4 text-foreground" />
                          Request sent.
                        </p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {personName} can accept or decline. Until then there's
                          no messaging either way.
                        </p>
                      </div>
                      {existing && (
                        <Button
                          variant="outline"
                          onClick={() => connections.withdrawConnection(existing.id)}
                        >
                          Withdraw request
                        </Button>
                      )}
                    </>
                  ) : status === "pending_in" && existing ? (
                    <>
                      <p className="text-sm leading-relaxed">
                        {personName} already asked to connect with you.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 text-white [background-image:var(--gradient-brand)]"
                          onClick={() => connections.respondToConnection(existing.id, true)}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => connections.respondToConnection(existing.id, false)}
                        >
                          Decline
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="conn-note" className="mb-2 block text-sm">
                          Add a note <span className="text-muted-foreground">(optional)</span>
                        </label>
                        <Textarea
                          id="conn-note"
                          value={note}
                          maxLength={200}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Where you know them from, or what you'd like to talk about."
                          className="min-h-20"
                        />
                        <div className="mt-1 text-right text-[11px] text-muted-foreground">
                          {note.length}/200
                        </div>
                      </div>
                      {error && (
                        <p className="rounded-xl bg-surface-muted px-4 py-2.5 text-xs text-[var(--coral-text)]">
                          {error}
                        </p>
                      )}
                      <Button
                        className="w-full text-white [background-image:var(--gradient-brand)]"
                        disabled={busy}
                        onClick={sendConnect}
                      >
                        {busy ? "Sending…" : "Send request"}
                      </Button>
                      <p className="text-center text-xs leading-relaxed text-muted-foreground">
                        Once accepted you'll appear in each other's Home feed and
                        can message. Not before.
                      </p>
                    </>
                  )}
                </>
              )}

              {/* ── Invite ───────────────────────────────────────────────
                  Context-aware: a Corner or Circle this row is actually
                  scoped to is the default target, no picker shown — asking
                  someone into the whole Space is a bigger ask than the
                  context they're actually looking at calls for. "or invite
                  to the Space instead" is the one-tap way out for when the
                  broader ask really is what's wanted. No narrower context
                  at all (the common case, most Moments) skips straight to
                  the original, unscoped picker below, unchanged. */}
              {active.id === "invite" && (
                <>
                  {done ? (
                    <div className="rounded-2xl bg-surface-muted px-4 py-4">
                      <p className="mb-1 flex items-center gap-2 text-sm">
                        <Check className="size-4 text-foreground" />
                        {done}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {personName} can accept or decline from their Inbox.
                      </p>
                    </div>
                  ) : inContextInvite ? (
                    <>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {circle
                          ? `They'll need to accept before they're a member — same as joining any other Circle.`
                          : `They'll need to accept before anything happens.`}
                      </p>

                      <Textarea
                        value={note}
                        maxLength={200}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add a note (optional)"
                        className="min-h-16"
                      />

                      {error && (
                        <p className="rounded-xl bg-surface-muted px-4 py-2.5 text-xs text-[var(--coral-text)]">
                          {error}
                        </p>
                      )}
                      <Button
                        className="w-full text-white [background-image:var(--gradient-brand)]"
                        disabled={busy}
                        onClick={sendInvite}
                      >
                        {busy ? "Sending…" : "Send invitation"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => {
                          // A courtesy pre-fill, not a requirement — freely
                          // editable, matching whatever narrower scope they
                          // were just looking at instead of a blank Space.
                          const label = narrowContext?.name ?? "";
                          setNewSpaceName((v) => v || label);
                          setChosenHobby((v) => v ?? label);
                          setInviteScope("space");
                        }}
                        className="mx-auto block text-center text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground"
                      >
                        or invite to {parentSpaceLabel} instead
                      </button>
                    </>
                  ) : (
                    <>
                      {narrowContext && (
                        <button
                          type="button"
                          onClick={() => setInviteScope("context")}
                          className="-mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          ← Back to {narrowContext.name}
                        </button>
                      )}

                      <div>
                        <label htmlFor="inv-space" className="mb-2 block text-sm">
                          Which Space?
                        </label>
                        {connections.mySpaces.length > 0 ? (
                          <select
                            id="inv-space"
                            value={chosenSpace}
                            onChange={(e) => setChosenSpace(e.target.value)}
                            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-ring"
                          >
                            <option value="">Choose a Space…</option>
                            {connections.mySpaces.map((s) => (
                              <option key={s.id} value={String(s.id)}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            You're not in a Space yet. Name one below and it'll be
                            made when you send the invitation.
                          </p>
                        )}
                      </div>

                      {!chosenSpace && (
                        <div>
                          <label htmlFor="inv-new" className="mb-2 block text-sm">
                            {connections.mySpaces.length > 0 ? "Or start a new one" : "Name it"}
                          </label>
                          <Input
                            id="inv-new"
                            value={newSpaceName}
                            maxLength={60}
                            onChange={(e) => setNewSpaceName(e.target.value)}
                            placeholder="e.g. Sunday throwing sessions"
                          />
                        </div>
                      )}

                      <div>
                        <label htmlFor="inv-hobby" className="mb-2 block text-sm">
                          What's it about?{" "}
                          <span className="text-muted-foreground">
                            (optional, type anything)
                          </span>
                        </label>
                        <Input
                          id="inv-hobby"
                          value={chosenHobby ?? ""}
                          maxLength={40}
                          onChange={(e) => setChosenHobby(e.target.value)}
                          placeholder="Pottery, bouldering, sourdough…"
                        />
                      </div>

                      <Textarea
                        value={note}
                        maxLength={200}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add a note (optional)"
                        className="min-h-16"
                      />

                      {error && (
                        <p className="rounded-xl bg-surface-muted px-4 py-2.5 text-xs text-[var(--coral-text)]">
                          {error}
                        </p>
                      )}
                      <Button
                        className="w-full text-white [background-image:var(--gradient-brand)]"
                        disabled={busy || (!chosenSpace && !newSpaceName.trim())}
                        onClick={sendInvite}
                      >
                        {busy ? "Sending…" : "Send invitation"}
                      </Button>
                    </>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Close
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
