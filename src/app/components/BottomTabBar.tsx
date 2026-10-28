import { Link, useLocation } from "react-router";
import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { pop, press, PRESS_SCALE } from "../lib/motionTokens";
import { useAuth } from "../context/AuthContext";
import { useIncomingFollowRequests } from "../lib/useIncomingFollowRequests";

/**
 * Phone and tablet navigation: three text tabs and a "+ Log" pill. Matches the
 * desktop top nav's Discover / Home / Create in the same order (plus
 * Profile, which hangs off the avatar on desktop) — one mental model, not
 * two. The desktop button reads "Log a Moment"; this tab says "Log" (the
 * glossary's short form) since a single-line tab has no room for more.
 *
 * Log sits in the middle because it's the thing you came to do. It is the
 * one solid shape on the bar: an accent pill reading "+ Log". On the Log
 * screen the plus turns 45 degrees into a cross (on `pop`).
 *
 * Inbox isn't a tab of its own here: the header's notification bell and
 * message icon (Header.tsx) are visible on every breakpoint, including this
 * one, so /inbox stays one tap away without needing a sixth slot. The one
 * inbox-adjacent signal that lived on this bar — a dot for a pending follow
 * request someone's waiting on — moves to Profile below, the nearest
 * personal-content tab, so it isn't lost.
 *
 * Visible below lg, exactly where the desktop top nav is hidden, so there is
 * never a width with no primary navigation and never two at once.
 */
export const TABS = [
  {
    to: "/discover",
    label: "Discover",
    match: (p: string) =>
      p.startsWith("/discover") ||
      p.startsWith("/corners") ||
      p.startsWith("/browse") ||
      p.startsWith("/space") ||
      p.startsWith("/people"),
  },
  {
    to: "/my-space",
    label: "Home",
    match: (p: string) => p.startsWith("/my-space"),
  },
  {
    to: "/create",
    label: "Log",
    match: (p: string) => p.startsWith("/create") || p.startsWith("/log"),
    accent: true,
  },
  {
    to: "/you",
    label: "You",
    match: (p: string) => p.startsWith("/you"),
  },
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
        <div className="mx-auto grid max-w-md grid-cols-4 items-center px-1 py-2">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            if (tab.accent) {
              return (
                <Link key={tab.to} to={tab.to} aria-current={active ? "page" : undefined} aria-label="Log a Moment" className="flex justify-center">
                  <motion.span
                    whileTap={{ scale: PRESS_SCALE }}
                    transition={press}
                    className="inline-flex min-h-12 items-center gap-1 rounded-full px-6 text-body font-semibold"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
                  >
                    <motion.span animate={{ rotate: active ? 45 : 0 }} transition={pop} className="inline-flex" aria-hidden="true">
                      <Plus className="size-4" strokeWidth={2.6} />
                    </motion.span>
                    {tab.label}
                  </motion.span>
                </Link>
              );
            }
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-12 items-center justify-center rounded-card text-body font-semibold transition-colors ${active ? "text-accent-text" : "text-foreground"}`}
              >
                <span className="relative">
                  {tab.label}
                  {/* A dot, not a number: something is waiting, not how much. */}
                  {tab.to === "/you" && waiting && (
                    <span className="absolute -right-2.5 -top-0.5 size-2 rounded-full" style={{ backgroundColor: "var(--coral-deep)" }} aria-hidden="true" />
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
