import { Link } from "react-router";
import { Bell, MessagesSquare } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSocial } from "../../context/SocialContext";
import { useNotificationBadge } from "../../lib/useNotificationBadge";
import { APP_NAME } from "../../config";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const ICON_LINK = "relative flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-muted";

/**
 * The top of Home on a phone: the wordmark, then Chats, Notifications and the
 * person's avatar. A dot, never a number, says something is waiting. From the
 * large breakpoint up the usual site header is shown instead.
 */
export function HomeHeader() {
  const { profile } = useAuth();
  const social = useSocial();
  const { badgeCount } = useNotificationBadge();
  const chatsWaiting = social.chatsUnreadCount + social.messageRequests.length > 0;
  const name = profile?.display_name?.trim() ?? "";

  return (
    <header className="-mx-1 mb-2 flex items-center justify-between rail:hidden">
      <Link to="/my-space" aria-label={APP_NAME} className="px-1 text-display font-extrabold leading-none text-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.03em" }}>
        {APP_NAME}
      </Link>
      <nav aria-label="Inbox and profile" className="flex items-center">
        <Link to="/messages" aria-label={chatsWaiting ? "Chats, new" : "Chats"} className={ICON_LINK}>
          <MessagesSquare className="size-[22px]" strokeWidth={1.75} aria-hidden="true" />
          {chatsWaiting && <span className="absolute right-2.5 top-2.5 size-2 rounded-full border-2 border-background [background-color:var(--accent-text)]" aria-hidden="true" />}
        </Link>
        <Link to="/inbox" aria-label={badgeCount > 0 ? "Notifications, new" : "Notifications"} className={ICON_LINK}>
          <Bell className="size-[22px]" strokeWidth={1.75} aria-hidden="true" />
          {badgeCount > 0 && <span className="absolute right-2.5 top-2.5 size-2 rounded-full border-2 border-background [background-color:var(--accent-text)]" aria-hidden="true" />}
        </Link>
        <Link to="/you" aria-label="You" className="flex size-11 items-center justify-center">
          <Avatar className="size-[34px]">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" className="object-cover" />}
            <AvatarFallback className="text-caption">{name ? initials(name) : "·"}</AvatarFallback>
          </Avatar>
        </Link>
      </nav>
    </header>
  );
}
