import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Bell,
  Check,
  Handshake,
  MessageCircleQuestion,
  MessagesSquare,
  Sprout,
  UserPlus,
  X,
} from "lucide-react";
import { useSocial } from "../context/SocialContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";

/**
 * Notifications that describe what actually happened — "Reo accepted your Make
 * together request. You can now message each other." — rather than "you have a
 * new connection". Pending requests sit at the top with Accept and Decline on
 * them, because a request you can't answer from the notification isn't much of
 * a notification.
 */
const ICON: Record<string, typeof Bell> = {
  thought: MessageCircleQuestion,
  joined: UserPlus,
  make_together: Handshake,
  explore_together: MessagesSquare,
  accepted: Check,
  message: MessagesSquare,
  hobby_follow: Sprout,
};

function ago(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const social = useSocial();
  const { user } = useAuth();

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
      (user ? p.toUser === user.id : false),
  );

  const dot = social.unreadCount > 0 || incoming.length > 0;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={dot ? `Notifications (${social.unreadCount + incoming.length})` : "Notifications"}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open && social.unreadCount > 0) social.markAllRead();
        }}
        className="relative"
      >
        <Bell className="size-5" />
        {dot && (
          <span
            className="absolute right-1.5 top-1.5 size-1.5 rounded-full [background-color:var(--coral-deep)]"
            aria-hidden="true"
          />
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
          <div className="border-b border-[var(--hairline)] px-4 py-3 text-sm">Notifications</div>

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

          {social.notifications.length === 0 && incoming.length === 0 ? (
            <p className="px-4 py-4 text-xs leading-relaxed text-muted-foreground">
              Nothing yet. Thoughts on your moments, people joining your
              activities, and requests to make or explore together turn up here.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {social.notifications.map((n) => {
                const Icon = ICON[n.kind] ?? Bell;
                const body = (
                  <span className="flex items-start gap-3 px-4 py-2.5">
                    <Icon className="mt-0.5 size-4 shrink-0 text-[var(--forest)]" />
                    <span className="min-w-0">
                      <span className="block text-sm leading-snug">{n.body}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {ago(n.createdAt)} ago
                      </span>
                    </span>
                  </span>
                );
                return (
                  <li key={n.id} className={n.read ? "" : "bg-[color-mix(in_srgb,var(--yellow)_10%,transparent)]"}>
                    {n.href ? (
                      <Link to={n.href} onClick={() => setOpen(false)} className="block hover:bg-surface-muted">
                        {body}
                      </Link>
                    ) : (
                      body
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
