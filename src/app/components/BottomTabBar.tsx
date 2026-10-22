import { Link, useLocation } from "react-router";
import { Compass, Library, Plus, UserRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useIncomingFollowRequests } from "../lib/useIncomingFollowRequests";

/**
 * Phone and tablet navigation: four labelled destinations, matching the
 * desktop top nav's Discover / Home / Create in the same order (plus
 * Profile, which hangs off the avatar on desktop) — one mental model, not
 * two. The desktop button reads "Log a Moment"; this tab says "Log" (the
 * glossary's short form) since a single-line tab has no room for more.
 *
 * Log sits in the middle because it's the thing you came to do. It is the
 * one solid tile on the bar: an accent square with a plus, over the same
 * "Log" label (the tile only adds weight).
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
    icon: Compass,
    match: (p: string) =>
      p.startsWith("/discover") ||
      p.startsWith("/space") ||
      p.startsWith("/people"),
  },
  {
    to: "/my-space",
    label: "Home",
    icon: Library,
    match: (p: string) => p.startsWith("/my-space"),
  },
  {
    to: "/create",
    label: "Log",
    icon: Plus,
    match: (p: string) => p.startsWith("/create") || p.startsWith("/log"),
    accent: true,
  },
  {
    to: "/you",
    label: "You",
    icon: UserRound,
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "var(--safe-bottom)", paddingLeft: "var(--safe-left)", paddingRight: "var(--safe-right)" }}
        aria-label="Main"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 px-1 pb-1.5 pt-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.match(pathname);
            const tint = tab.accent
              ? "var(--violet-electric-bright)"
              : active
                ? "var(--violet-electric-bright)"
                : undefined;

            const content = (
              <>
                <span
                  className={`relative flex h-7 items-center justify-center ${tab.accent ? "w-7 rounded-control" : ""}`}
                  style={tab.accent ? { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" } : undefined}
                >
                  <Icon className="size-5" strokeWidth={tab.accent ? 2.4 : active ? 2.1 : 1.7} />
                  {/* A dot, not a number: something is waiting, not how much. */}
                  {tab.to === "/you" && waiting && (
                    <span
                      className="absolute -right-0.5 -top-0.5 size-2 rounded-full"
                      style={{ backgroundColor: "var(--coral-deep)" }}
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="text-caption font-medium leading-none">{tab.label}</span>
              </>
            );
            const className = `flex min-h-12 flex-col items-center justify-center gap-1 rounded-card py-1.5 transition-colors ${
              tint ? "" : "text-muted-foreground"
            }`;
            const style = { color: tint };


            return (
              <Link key={tab.to} to={tab.to} aria-current={active ? "page" : undefined} className={className} style={style}>
                {content}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
