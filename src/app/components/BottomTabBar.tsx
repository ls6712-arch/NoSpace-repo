import { Link, useLocation } from "react-router";
import { Compass, Library, Inbox, PlusCircle, UserRound } from "lucide-react";
import { useConnections } from "../context/ConnectionsContext";

/**
 * Phone and tablet navigation: five labelled destinations — the same five as
 * the desktop bar, in the same order, so the app has one mental model rather
 * than two.
 *
 * Log sits in the middle because it's the thing you came to do, and it keeps
 * its word rather than becoming an anonymous "+". Inbox carries a dot when
 * something is actually waiting on you — a count would turn correspondence
 * into a score.
 *
 * Visible below lg, exactly where the desktop top nav is hidden, so there is
 * never a width with no primary navigation and never two at once.
 */
export const TABS = [
  {
    to: "/",
    label: "My Space",
    icon: Library,
    match: (p: string) => p === "/" || p.startsWith("/my-space"),
  },
  {
    // Discover holds hobbies, projects, Circles and People — a phone bar can't
    // carry all four as separate tabs, and Discover is defined as the place
    // those live, so they sit inside it rather than competing with it.
    to: "/discover",
    label: "Discover",
    icon: Compass,
    match: (p: string) =>
      p.startsWith("/discover") ||
      p.startsWith("/space") ||
      p.startsWith("/circles") ||
      p.startsWith("/people"),
  },
  {
    to: "/create",
    label: "Create",
    icon: PlusCircle,
    match: (p: string) => p.startsWith("/create") || p.startsWith("/log"),
    accent: true,
  },
  {
    to: "/inbox",
    label: "Inbox",
    icon: Inbox,
    match: (p: string) => p.startsWith("/inbox") || p.startsWith("/messages"),
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
                  {tab.to === "/inbox" && waiting && (
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
