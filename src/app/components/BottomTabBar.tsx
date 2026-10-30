import { Link, useLocation } from "react-router";
import { CalendarDays, House, Plus, Search, UserRound, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { pop, press, PRESS_SCALE } from "../lib/motionTokens";
import { useAuth } from "../context/AuthContext";
import { useIncomingFollowRequests } from "../lib/useIncomingFollowRequests";

/**
 * Phone and tablet navigation: Home, Discover, Log, Week and You. Each tab is a
 * line icon over a short label, so it reads the same as the desktop top nav's
 * destinations in the same order (Profile hangs off the avatar there). The
 * desktop button reads "Log a Moment"; this tab says "Log" (the glossary's
 * short form) since a single-line tab has no room for more.
 *
 * Log sits in the middle because it's the thing you came to do. It is the
 * one solid shape on the bar: an accent pill holding a plus, with "Log" under
 * it. On the Log screen the plus turns 45 degrees into a cross (on `pop`).
 *
 * Inbox isn't a tab of its own here: the header's notification bell and
 * message icon are visible on every breakpoint, including this one, so /inbox
 * stays one tap away without needing another slot. The one inbox-adjacent
 * signal that lived on this bar, a dot for a pending follow request someone's
 * waiting on, sits on You, the nearest personal-content tab.
 *
 * Visible below lg, exactly where the desktop top nav is hidden, so there is
 * never a width with no primary navigation and never two at once.
 */
export const TABS: {
  to: string;
  label: string;
  icon: LucideIcon;
  match: (p: string) => boolean;
  accent?: boolean;
}[] = [
  { to: "/my-space", label: "Home", icon: House, match: (p) => p.startsWith("/my-space") },
  {
    to: "/discover",
    label: "Discover",
    icon: Search,
    match: (p) =>
      p.startsWith("/discover") ||
      p.startsWith("/corners") ||
      p.startsWith("/browse") ||
      p.startsWith("/space") ||
      p.startsWith("/people"),
  },
  { to: "/create", label: "Log", icon: Plus, match: (p) => p.startsWith("/create") || p.startsWith("/log"), accent: true },
  { to: "/week", label: "Week", icon: CalendarDays, match: (p) => p.startsWith("/week") },
  { to: "/you", label: "You", icon: UserRound, match: (p) => p.startsWith("/you") },
];

export function BottomTabBar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const incomingFollows = useIncomingFollowRequests(user?.id) ?? [];
  const waiting = incomingFollows.length > 0;

  return (
    <>
      {/* Keeps page content clear of the bar, including the iOS home indicator. */}
      <div className="h-[calc(72px+var(--safe-bottom))] lg:hidden" aria-hidden="true" />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "var(--safe-bottom)", paddingLeft: "var(--safe-left)", paddingRight: "var(--safe-right)" }}
        aria-label="Main"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-1 pb-1.5 pt-1.5">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            const Icon = tab.icon;
            if (tab.accent) {
              return (
                <Link key={tab.to} to={tab.to} aria-current={active ? "page" : undefined} aria-label="Log a Moment" className="flex min-h-12 flex-col items-center justify-end gap-0.5">
                  <motion.span
                    whileTap={{ scale: PRESS_SCALE }}
                    transition={press}
                    className="inline-flex h-10 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                  >
                    <motion.span animate={{ rotate: active ? 45 : 0 }} transition={pop} className="inline-flex" aria-hidden="true">
                      <Icon className="size-[22px]" strokeWidth={2.4} />
                    </motion.span>
                  </motion.span>
                  <span className="text-caption font-semibold text-foreground">{tab.label}</span>
                </Link>
              );
            }
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-12 flex-col items-center justify-end gap-1 rounded-card pb-0.5 transition-colors ${active ? "text-accent-text" : "text-muted-foreground"}`}
              >
                <span className="relative">
                  <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
                  {/* A dot, not a number: something is waiting, not how much. */}
                  {tab.to === "/you" && waiting && (
                    <span className="absolute -right-1 -top-0.5 size-2 rounded-full" style={{ backgroundColor: "var(--coral-deep)" }} aria-hidden="true" />
                  )}
                </span>
                <span className={`text-caption ${active ? "font-bold" : "font-medium"}`}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
