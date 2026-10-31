import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Menu, MessagesSquare, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { APP_NAME } from "../../config";
import { isDismissKey } from "../../lib/menuDismiss";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { NotificationsMenu } from "../NotificationsMenu";
import { AccountMenuPanel } from "./AccountMenuPanel";
import { GlobalSearchBox } from "./GlobalSearchBox";
import { SEARCH_SHORTCUT_EVENT } from "../../lib/searchShortcut";
import { RailItem } from "./RailItem";
import { DISCOVER, HOME, LOG, WEEK, YOU } from "./navItems";
import { useChatsBadge } from "./useChatsBadge";

/** Search gets the plain magnifier; Discover moved to the compass so the two never share a shape (founder, Oct 30, 2026). */
const SEARCH_ICON = Search;

type Panel = "search" | "notifications" | "more" | null;

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * The left rail: every destination on one fixed column, from 744px wide.
 * Icons only from 744px (72px wide), icons and words from 1280px (240px wide).
 * Home, Discover, Search, Log a Moment, Week, Chats and Notifications on top;
 * You and More pinned to the bottom. It reads the same destination list as
 * the phone's bottom bar. Search and Notifications open a panel beside the
 * rail, More opens the account menu; one panel at a time, Escape closes it.
 */
export function SideRail() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const chats = useChatsBadge();
  const [panel, setPanel] = useState<Panel>(null);
  const moreRef = useRef<HTMLLIElement>(null);
  const searchRef = useRef<HTMLLIElement>(null);
  const name = profile?.display_name?.trim() ?? "";

  // A new page closes whatever is open.
  useEffect(() => setPanel(null), [pathname]);

  // "/" opens the Search panel (on /search the page's own box answers instead).
  useEffect(() => {
    const open = () => {
      if (pathname !== "/search") setPanel("search");
    };
    window.addEventListener(SEARCH_SHORTCUT_EVENT, open);
    return () => window.removeEventListener(SEARCH_SHORTCUT_EVENT, open);
  }, [pathname]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => isDismissKey(e.key) && setPanel(null);
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panel === "more" && moreRef.current && !moreRef.current.contains(target)) setPanel(null);
      if (panel === "search" && searchRef.current && !searchRef.current.contains(target)) setPanel(null);
    };
    document.addEventListener("keydown", onKey);
    // Pointer events so a tap outside closes it on touch screens too.
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [panel]);

  const toggle = (next: Exclude<Panel, null>) => setPanel((cur) => (cur === next ? null : next));
  const dest = (d: typeof HOME) => (
    <li>
      <RailItem to={d.to} icon={d.icon} label={d.label} aria={d.aria} active={d.match(pathname)} accent={d.accent} />
    </li>
  );

  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-border bg-background px-2 pb-3 rail:flex wide:w-[240px] wide:px-3"
      style={{ paddingTop: "calc(var(--safe-top) + 1rem)", paddingLeft: "max(0.5rem, var(--safe-left))" }}
    >
      <Link
        to={HOME.to}
        aria-label={APP_NAME}
        className="ns-wordmark mb-3 flex min-h-12 items-center justify-center gap-2.5 rounded-control wide:justify-start wide:px-3"
      >
        <span className="ns-wordmark-mark" aria-hidden="true" />
        <span className="hidden text-title font-extrabold text-foreground wide:inline" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
          {APP_NAME}
        </span>
      </Link>

      <ul className="flex flex-1 flex-col gap-1">
        {dest(HOME)}
        {dest(DISCOVER)}
        <li ref={searchRef} className="relative">
          <RailItem icon={SEARCH_ICON} label="Search" expanded={panel === "search"} active={panel === "search"} onClick={() => toggle("search")} />
          {panel === "search" && (
            <div className="fixed left-[80px] top-3 z-50 w-96 rounded-card border border-border bg-popover p-4 shadow-overlay wide:left-[248px]">
              <GlobalSearchBox autoFocus inline onDone={() => setPanel(null)} />
            </div>
          )}
        </li>
        {dest(LOG)}
        {dest(WEEK)}
        <li>
          <RailItem to="/messages" icon={MessagesSquare} label="Chats" aria={chats > 0 ? `Chats (${chats} unread)` : "Chats"} badge={chats} active={pathname.startsWith("/messages")} />
        </li>
        <li>
          <NotificationsMenu variant="rail" open={panel === "notifications"} onOpenChange={(o) => setPanel(o ? "notifications" : null)} />
        </li>
      </ul>

      <ul className="flex flex-col gap-1">
        <li>
          <RailItem
            to={YOU.to}
            label={YOU.label}
            active={YOU.match(pathname)}
            leading={
              <Avatar className="size-7">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" className="object-cover" />}
                <AvatarFallback className="text-caption">{name ? initials(name) : "·"}</AvatarFallback>
              </Avatar>
            }
          />
        </li>
        <li ref={moreRef} className="relative">
          <RailItem icon={Menu} label="More" expanded={panel === "more"} onClick={() => toggle("more")} />
          {panel === "more" && (
            <div className="fixed bottom-3 left-[80px] z-50 w-56 rounded-control border border-border bg-popover shadow-overlay wide:left-[248px]">
              <AccountMenuPanel includeYou={false} onNavigate={() => setPanel(null)} />
            </div>
          )}
        </li>
      </ul>
    </nav>
  );
}
