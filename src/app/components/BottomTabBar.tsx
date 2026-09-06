import { Link, useLocation } from "react-router";
import { Compass, Library, PlusCircle, UserRound, Users } from "lucide-react";
import { useConnections } from "../context/ConnectionsContext";

/**
 * Phone and tablet navigation: five labelled destinations, matching the
 * desktop top nav's Discover / My Space / Circles / Create in the same
 * order (plus Profile, which hangs off the avatar on desktop) — one mental
 * model, not two.
 *
 * Create sits in the middle because it's the thing you came to do, and it
 * keeps its word rather than becoming an anonymous "+".
 *
 * Inbox isn't a tab of its own here: the header's notification bell and
 * message icon (Header.tsx) are visible on every breakpoint, including this
 * one, so /inbox stays one tap away without needing a sixth slot. The one
 * inbox-adjacent signal that lived on this bar — a dot for a pending
 * connection request or Circle invitation someone's waiting on — moves to
 * Profile below, the nearest personal-content tab, so it isn't lost.
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
    label: "My Space",
    icon: Library,
    match: (p: string) => p === "/" || p.startsWith("/my-space"),
  },
  {
    to: "/create",
    label: "Create",
    icon: PlusCircle,
    match: (p: string) => p.startsWith("/create") || p.startsWith("/log"),
    accent: true,
  },
  {
    to: "/circles",
    label: "Circles",
    icon: Users,
    match: (p: string) => p.startsWith("/circles"),
  },
  {
    to: "/you",
    label: "Profile",
    icon: UserRound,
    match: (p: string) => p.startsWith("/you"),
  },
];

export function BottomTabBar() {
  const { pathname } = useLocation();
  const connections = useConnections();
  const waiting =
    connections.connections.filter((c) => c.status === "pending" && c.addressee).length > 0 ||
    connections.spaceInvitations.length > 0;

  return (
    <>
      {/* Keeps page content clear of the bar, including the iOS home indicator. */}
      <div className="h-[72px] lg:hidden" aria-hidden="true" />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 px-1 pb-1.5 pt-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.match(pathname);
            const tint = tab.accent
              ? "var(--coral-deep)"
              : active
                ? "var(--foreground)"
                : undefined;

            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl py-1.5 transition-colors ${
                  tint ? "" : "text-muted-foreground"
                }`}
                style={{
                  color: tint,
                  backgroundColor:
                    tab.accent && active
                      ? "color-mix(in srgb, var(--coral-deep) 12%, transparent)"
                      : undefined,
                }}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active || tab.accent ? 2.1 : 1.7} />
                  {/* A dot, not a number: something is waiting, not how much. */}
                  {tab.to === "/you" && waiting && (
                    <span
                      className="absolute -right-0.5 -top-0.5 size-2 rounded-full"
                      style={{ backgroundColor: "var(--coral-deep)" }}
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="text-[10px] font-medium leading-none">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
