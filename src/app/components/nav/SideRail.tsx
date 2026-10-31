import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Menu, MessagesSquare } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { APP_NAME } from "../../config";
import { isDismissKey } from "../../lib/menuDismiss";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { NotificationsMenu } from "../NotificationsMenu";
import { AccountMenuPanel } from "./AccountMenuPanel";
import { GlobalSearchBox } from "./GlobalSearchBox";
import { RailItem } from "./RailItem";
import { DISCOVER, HOME, LOG, WEEK, YOU } from "./navItems";
import { useChatsBadge } from "./useChatsBadge";

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
 * Home, Discover, Log a Moment, Week, Chats and Notifications on top; You and
 * More pinned to the bottom. It reads the same destination list as the phone's
 * bottom bar. Search has no item of its own: it lives in Discover's header
 * (founder, Oct 30, 2026), and Cmd+K, Ctrl+K or "/" opens it from any page.
 * Notifications open a panel beside the rail, More opens the account menu;
 * one panel at a time, Escape closes it.
 */
export function SideRail() {
  const { pathname } = useLocation();
  const { profile } = useAuth();
  const chats = useChatsBadge();
  const [panel, setPanel] = useState<Panel>(null);
  const moreRef = useRef<HTMLLIElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const name = profile?.display_name?.trim() ?? "";

  // A new page closes whatever is open.
  useEffect(() => setPanel(null), [pathname]);

  // The search shortcut: Cmd+K or Ctrl+K anywhere, "/" when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (cmdK || (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey)) {
        e.preventDefault();
        setPanel((cur) => (cur === "search" && cmdK ? null : "search"));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

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
        {dest(LOG)}
        {dest(WEEK)}
        <li>
          <RailItem to="/messages" icon={MessagesSquare} label="Chats" aria={chats > 0 ? `Chats (${chats} unread)` : "Chats"} badge={chats} active={pathname.startsWith("/messages")} />
        </li>
        <li>
          <NotificationsMenu variant="rail" open={panel === "notifications"} onOpenChange={(o) => setPanel(o ? "notifications" : null)} />
        </li>
      </ul>

      {panel === "search" && (
        <div
          ref={searchRef}
          role="dialog"
          aria-label="Search"
          className="fixed left-[80px] top-3 z-50 w-96 rounded-card border border-border bg-popover p-4 shadow-overlay wide:left-[248px]"
        >
          <GlobalSearchBox autoFocus inline onDone={() => setPanel(null)} />
        </div>
      )}

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
