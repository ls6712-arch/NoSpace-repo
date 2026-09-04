import { Link, useLocation } from "react-router";
import { Compass, PenLine, Library, Users } from "lucide-react";

/**
 * Phone and tablet navigation: four evenly spaced, labelled destinations —
 * the same four as the desktop bar, in the same order, so the app has one
 * mental model rather than two.
 *
 * Log is not a floating disc. A raised centre "+" is the grammar of a
 * post-something-now social app, and it also hides the word; here the word
 * Log stays visible and the coral accent does the emphasis instead.
 *
 * Visible below lg, exactly where the desktop top nav is hidden, so there is
 * never a width with no primary navigation and never two at once.
 */
const TABS = [
  {
    to: "/discover",
    label: "Discover",
    icon: Compass,
    match: (p: string) => p.startsWith("/discover") || p.startsWith("/space") || p === "/",
  },
  {
    to: "/my-space",
    label: "My Space",
    icon: Library,
    match: (p: string) => p.startsWith("/my-space"),
  },
  {
    to: "/circles",
    label: "Circles",
    icon: Users,
    match: (p: string) => p.startsWith("/circles"),
  },
  {
    to: "/log",
    label: "Log",
    icon: PenLine,
    match: (p: string) => p.startsWith("/log"),
    accent: true,
  },
];

export function BottomTabBar() {
  const { pathname } = useLocation();

  return (
    <>
      {/* Keeps page content clear of the bar, including the iOS home indicator. */}
      <div className="h-[72px] lg:hidden" aria-hidden="true" />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 pb-1.5 pt-1.5">
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
                <Icon className="size-5" strokeWidth={active || tab.accent ? 2.1 : 1.7} />
                <span className="text-[11px] font-medium leading-none">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
