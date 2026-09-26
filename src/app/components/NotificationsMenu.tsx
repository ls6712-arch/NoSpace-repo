import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Bell,
  Check,
  Crown,
  DoorOpen,
  Handshake,
  MessageCircleQuestion,
  MessagesSquare,
  Target,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useSocial } from "../context/SocialContext";
import { useAuth } from "../context/AuthContext";
import { useIncomingFollowRequests } from "../lib/useIncomingFollowRequests";
import { respondToFollow } from "../lib/profileFollows";
import { formatBadgeCount } from "../lib/messageSync";
import { groupNotifications, unreadGroupCount } from "../lib/notificationGrouping";
import { Button } from "./ui/button";

/**
 * Notifications that describe what actually happened — "Reo accepted your Make
 * together request. You can now message each other." — rather than "you have a
 * new connection". Pending requests sit at the top with Accept and Decline on
 * them, because a request you can't answer from the notification isn't much of
 * a notification.
 *
 * Phase 5: repeats on the same target fold into one line (groupNotifications),
 * a "Mark all read" button replaces the old "opening the bell marks
 * everything read" behavior (so you actually get to see what's new before it
 * clears), and opening one group marks only its own members read.
 */
const ICON: Record<string, typeof Bell> = {
  thought: MessageCircleQuestion,
  joined: UserPlus,
  make_together: Handshake,
  explore_together: MessagesSquare,
  accepted: Check,
  message: MessagesSquare,
  pursuit_invite: UserPlus,
  pursuit_joined: Users,
  pursuit_progress: Target,
  space_join_request: DoorOpen,
  space_join_approved: UserCheck,
  space_join_declined: X,
  space_host_invite: Crown,
};

function ago(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const social = useSocial();
  const { user } = useAuth();
  const [followRefreshKey, setFollowRefreshKey] = useState(0);
  const incomingFollows = useIncomingFollowRequests(user?.id, followRefreshKey) ?? [];
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const groups = useMemo(() => groupNotifications(social.notifications), [social.notifications]);
  const groupedUnread = unreadGroupCount(groups);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Requests waiting on you specifically — never ones you sent. The signed-out
  // case used to fall through to "show everything", so your own outgoing ask
  // reappeared here with an Accept button and you could answer yourself.
  const incoming = social.participations.filter(
    (p) =>
      p.status === "pending" &&
      (p.kind === "make_together" || p.kind === "explore_together") &&
      (user ? p.toUser === user.id : false) &&
      !social.blockedIds.includes(p.fromUser),
  );

  // A pending follow request lives in profile_follows, not SocialContext —
  // this used to only light the bell for one (the request itself was only
  // answerable from /inbox); it's now rendered and answerable right here
  // too, the same respondToFollow() /inbox uses, via answerFollow() below.
  const badgeCount = groupedUnread + incoming.length + incomingFollows.length;

  const answerFollow = async (followerId: string, accept: boolean) => {
    if (!user || respondingTo) return;
    setRespondingTo(followerId);
    await respondToFollow(followerId, user.id, accept);
    setFollowRefreshKey((k) => k + 1);
    setRespondingTo(null);
  };

  const openGroup = (memberIds: Array<number | string>, read: boolean) => {
    setOpen(false);
    if (!read) void social.markNotificationsRead(memberIds);
  };

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={badgeCount > 0 ? `Notifications (${badgeCount} unread)` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <Bell className="size-5" />
        {badgeCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full [background-color:var(--coral-deep)] text-[10px] text-white"
            aria-hidden="true"
          >
            {formatBadgeCount(badgeCount)}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3 text-sm">
            Notifications
            {groupedUnread > 0 && (
              <button
                type="button"
                onClick={() => void social.markAllRead()}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {incoming.length > 0 && (
            <ul className="border-b border-[var(--hairline)]">
              {incoming.map((p) => (
                <li key={p.id} className="px-4 py-3">
                  <p className="text-sm">
                    <strong className="font-normal" style={{ fontFamily: "var(--font-serif)" }}>
                      {p.fromName}
                    </strong>{" "}
                    asked to {p.kind === "make_together" ? "make" : "explore"} together.
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.intent}</p>
                  {p.note && (
                    <p className="mt-1 text-xs italic text-muted-foreground">“{p.note}”</p>
                  )}
                  <div className="mt-2.5 flex gap-2">
                    <Button variant="coral" size="sm" onClick={() => social.respond(p.id, true)}>
                      <Check className="size-3.5" />
                      Accept
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => social.respond(p.id, false)}>
                      <X className="size-3.5" />
                      Not now
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {incomingFollows.length > 0 && (
            <ul className="border-b border-[var(--hairline)]">
              {incomingFollows.map((r) => (
                <li key={r.followerId} className="px-4 py-3">
                  <p className="text-sm">
                    <strong className="font-normal" style={{ fontFamily: "var(--font-serif)" }}>
                      {r.displayName}
                    </strong>{" "}
                    wants to follow your Shelf.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <Button
                      variant="coral"
                      size="sm"
                      disabled={respondingTo === r.followerId}
                      onClick={() => answerFollow(r.followerId, true)}
                    >
                      <Check className="size-3.5" />
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={respondingTo === r.followerId}
                      onClick={() => answerFollow(r.followerId, false)}
                    >
                      <X className="size-3.5" />
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {groups.length === 0 && incoming.length === 0 && incomingFollows.length === 0 ? (
            <p className="px-4 py-4 text-xs leading-relaxed text-muted-foreground">
              Nothing yet. Thoughts on your moments, people joining your
              activities, follow requests, and asks to make or explore
              together all turn up here.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {groups.map((g) => {
                const Icon = ICON[g.kind] ?? Bell;
                const body = (
                  <span className="flex items-start gap-3 px-4 py-2.5">
                    <Icon className="mt-0.5 size-4 shrink-0 text-[var(--violet-electric-bright)]" />
                    <span className="min-w-0">
                      <span className="block text-sm leading-snug">{g.body}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {ago(g.createdAt)}
                      </span>
                    </span>
                  </span>
                );
                return (
                  <li key={g.id} className={g.read ? "" : "bg-[color-mix(in_srgb,var(--yellow)_10%,transparent)]"}>
                    {g.href ? (
                      <Link to={g.href} onClick={() => openGroup(g.memberIds, g.read)} className="block hover:bg-surface-muted">
                        {body}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => openGroup(g.memberIds, g.read)} className="block w-full text-left hover:bg-surface-muted">
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {!social.isShared && (
            <p className="border-t border-[var(--hairline)] px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              You're not signed in, so requests can't reach anyone else yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
