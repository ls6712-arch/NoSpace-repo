import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  Bell,
  Check,
  Clock,
  Crown,
  DoorOpen,
  Handshake,
  Bookmark,
  Heart,
  MessageCircleQuestion,
  MessagesSquare,
  Sprout,
  Target,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useSocial } from "../context/SocialContext";
import { useAuth } from "../context/AuthContext";
import { respondToFollow } from "../lib/profileFollows";
import { formatBadgeCount } from "../lib/messageSync";
import { useNotificationBadge } from "../lib/useNotificationBadge";
import { RailItem } from "./nav/RailItem";
import { isDismissKey } from "../lib/menuDismiss";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { APP_NAME } from "../config";
import { Time } from "./ui/time";
import { EmptyState } from "./StateViews";
import { notificationBodyText } from "../lib/text";

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
  space_moment_pending: Clock,
  space_moment_approved: Check,
  first_moment: Sprout,
  love: Heart,
  save: Bookmark,
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** One person's photo, initials when they have none. */
function Face({ name, src, className }: { name: string; src?: string; className: string }) {
  return (
    <Avatar className={`${className} ring-2 ring-[var(--popover)]`}>
      {src && <AvatarImage src={src} alt="" className="object-cover" />}
      <AvatarFallback className="text-caption">{initials(name) || "·"}</AvatarFallback>
    </Avatar>
  );
}

/**
 * Who a notification is from, at a glance: their photo (two overlapping when
 * several people did the same thing), with what happened as a small icon on
 * the corner. A line with nobody behind it (a Space update, a save count)
 * shows the icon on its own.
 */
function NotificationFace({ actors, icon: Icon }: { actors: Array<{ name: string; avatar?: string }>; icon?: typeof Bell }) {
  const badge = Icon && (
    <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-popover" aria-hidden="true">
      <span className="flex size-4 items-center justify-center rounded-full [background-color:var(--accent)] text-[var(--accent-foreground)]">
        <Icon className="size-2.5" strokeWidth={2.6} />
      </span>
    </span>
  );
  if (actors.length === 0) {
    return (
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted" aria-hidden="true">
        {Icon ? <Icon className="size-5 text-muted-foreground" /> : <Bell className="size-5 text-muted-foreground" />}
      </span>
    );
  }
  return (
    <span className="relative block size-11 shrink-0" aria-hidden="true">
      {actors.length > 1 ? (
        <>
          <Face name={actors[1].name} src={actors[1].avatar} className="absolute right-0 top-0 size-8" />
          <Face name={actors[0].name} src={actors[0].avatar} className="absolute bottom-0 left-0 size-8" />
        </>
      ) : (
        <Face name={actors[0].name} src={actors[0].avatar} className="size-11" />
      )}
      {badge}
    </span>
  );
}

/**
 * The bell and its panel. `variant="rail"` is the same menu opened from the
 * left rail: the trigger is a rail item and the panel opens beside the rail.
 * The rail passes `open` and `onOpenChange` so only one of its panels is open.
 */
export function NotificationsMenu({
  variant = "header",
  open: controlledOpen,
  onOpenChange,
}: {
  variant?: "header" | "rail";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const setOpen = (next: boolean | ((cur: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(open) : next;
    (onOpenChange ?? setOwnOpen)(value);
  };
  const ref = useRef<HTMLDivElement>(null);
  const social = useSocial();
  const { user } = useAuth();
  const location = useLocation();
  const [followRefreshKey, setFollowRefreshKey] = useState(0);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const { groups, groupedUnread, incoming, incomingFollows, badgeCount } = useNotificationBadge(followRefreshKey);

  // Only while this panel is the open one. On the rail, `setOpen(false)` tells
  // the rail "close the panel", so listening while closed shut the More menu
  // on the first press inside it, before the tap could reach Settings or a
  // Theme button. Pointer events, not mouse events: a tap on an empty spot
  // fires no mousedown on iOS, so the panel never closed on an iPad.
  useEffect(() => {
    if (!open) return;
    function onPointerOutside(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerOutside);
    return () => document.removeEventListener("pointerdown", onPointerOutside);
  }, [open]);

  // Navigating away while this is open (a header link, browser back/
  // forward) used to leave it hanging open over the new page — a group's
  // own click already closes it via openGroup, but nothing else did.
  useEffect(() => {
    if (open) setOpen(false);
  }, [location.pathname]);

  // Escape closes it and returns focus to the bell, same as any other
  // dismissable menu — it previously had no keyboard way to close at all.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!isDismissKey(e.key)) return;
      setOpen(false);
      ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

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
      {variant === "rail" ? (
        <RailItem
          icon={Bell}
          label="Notifications"
          aria={badgeCount > 0 ? `Notifications (${badgeCount} unread)` : "Notifications"}
          badge={badgeCount}
          expanded={open}
          onClick={() => setOpen((v) => !v)}
        />
      ) : (
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
              className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full [background-color:var(--accent-text)] text-caption text-on-brand tabular-nums"
              aria-hidden="true"
            >
              {formatBadgeCount(badgeCount)}
            </span>
          )}
        </Button>
      )}

      {/* Under 640px the panel is pinned to the screen edges. Anchored to the
          bell (right-0, w-80) it ran 40px off the left edge of a 390px phone. */}
      {open && (
        <div
          className={
            variant === "rail"
              ? "fixed left-[80px] top-3 z-50 max-h-[calc(100dvh-1.5rem)] w-96 overflow-y-auto rounded-card border border-border bg-popover shadow-overlay wide:left-[248px]"
              : "absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-card border border-border bg-popover shadow-overlay max-tab:fixed max-tab:inset-x-3 max-tab:top-[calc(var(--safe-top)+4.5rem)] max-tab:mt-0 max-tab:w-auto"
          }
        >
          <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3 text-small">
            Notifications
            {groupedUnread > 0 && (
              <button
                type="button"
                onClick={() => void social.markAllRead()}
                className="text-caption text-muted-foreground transition-colors hover:text-foreground hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {incoming.length > 0 && (
            <ul className="border-b border-[var(--hairline)]">
              {incoming.map((p) => (
                <li key={p.id} className="flex gap-3 px-4 py-3">
                  <NotificationFace actors={[{ name: p.fromName, avatar: p.fromAvatar }]} icon={p.kind === "make_together" ? Handshake : MessagesSquare} />
                  <div className="min-w-0 flex-1">
                  <p className="text-small">
                    <strong className="font-normal" style={{ fontFamily: "var(--font-serif)" }}>
                      {p.fromName}
                    </strong>{" "}
                    asked to {p.kind === "make_together" ? "make" : "explore"} together.
                  </p>
                  <p className="mt-0.5 text-caption text-muted-foreground">{p.intent}</p>
                  {p.note && (
                    <p className="mt-1 text-caption italic text-muted-foreground">“{p.note}”</p>
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
                  </div>
                </li>
              ))}
            </ul>
          )}

          {incomingFollows.length > 0 && (
            <ul className="border-b border-[var(--hairline)]">
              {incomingFollows.map((r) => (
                <li key={r.followerId} className="flex gap-3 px-4 py-3">
                  <NotificationFace actors={[{ name: r.displayName, avatar: r.avatarUrl }]} icon={UserPlus} />
                  <div className="min-w-0 flex-1">
                  <p className="text-small">
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
                  </div>
                </li>
              ))}
            </ul>
          )}

          {groups.length === 0 && incoming.length === 0 && incomingFollows.length === 0 ? (
            <EmptyState
              size="rail"
              className="mt-0 px-4 py-4"
              line="Nothing yet."
              hint="Thoughts on your Moments, people joining your activities, follow requests, and asks to make or explore together all turn up here."
              action={{ label: "Log a Moment", to: "/create" }}
            />
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {groups.map((g) => {
                const Icon = ICON[g.kind] ?? Bell;
                const body = (
                  <span className="flex items-center gap-3 px-4 py-2.5">
                    <NotificationFace actors={g.actors} icon={Icon} />
                    <span className="min-w-0">
                      <span className="block text-small leading-snug">{notificationBodyText(g.kind, g.body)}</span>
                      <span className="block text-caption text-muted-foreground">
                        <Time value={g.createdAt} ago />
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
                    {/* Step 4: someone you invited added their first moment.
                        One tap opens it with the reply box ready. */}
                    {g.kind === "first_moment" && g.href && (
                      <div className="px-4 pb-2.5 pl-[4.5rem]">
                        <Button asChild variant="coral" size="sm">
                          <Link
                            to={`${g.href}?reply=1`}
                            onClick={() => openGroup(g.memberIds, g.read)}
                          >
                            Welcome to {APP_NAME}
                          </Link>
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {!social.isShared && (
            <p className="border-t border-[var(--hairline)] px-4 py-2.5 text-caption leading-relaxed text-muted-foreground">
              You’re not logged in, so requests can’t reach anyone else yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
