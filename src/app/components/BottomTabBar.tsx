import { Link, useLocation } from "react-router";
import { Compass, Plus, Library, Users, User } from "lucide-react";

/**
 * Phone and tablet navigation, five positions: Discover · My Space · [+] · Circles ·
 * Profile. Create is not a flat tab — it's raised out of the bar as a coral
 * disc, because logging something you made is the one action the whole app
 * exists for.
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
    to: "/profile",
    label: "My Space",
    icon: Library,
    match: (p: string) => p.startsWith("/profile"),
  },
  { to: "/create", label: "", icon: Plus, match: () => false, primary: true },
  {
    to: "/circles",
    label: "Circles",
    icon: Users,
    match: (p: string) => p.startsWith("/circles"),
  },
  { to: "/profile", label: "Profile", icon: User, match: () => false },
];

export function BottomTabBar() {
  const { pathname } = useLocation();

  return (
    <>
      {/* Keeps page content clear of the bar, including the iOS home indicator. */}
      <div className="h-[76px] lg:hidden" aria-hidden="true" />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main"
      >
        <div className="mx-auto flex max-w-md items-end justify-around px-2 pb-2 pt-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.match(pathname);

            if (tab.primary) {
              return (
                <Link
                  key={tab.label || "create"}
                  to={tab.to}
                  aria-label="Create — log something you made"
                  className="-mt-7 flex size-15 items-center justify-center rounded-full text-white shadow-[0_8px_20px_rgba(0,0,0,0.45)] ring-4 ring-surface transition-[filter,transform] duration-150 hover:brightness-110 active:scale-95"
                  style={{ backgroundColor: "var(--coral-deep)", width: 60, height: 60 }}
                >
                  <Icon className="size-7" strokeWidth={2.2} />
                </Link>
              );
            }

            return (
              <Link
                key={tab.label || "create"}
                to={tab.to}
                className={`flex w-16 flex-col items-center gap-1 py-1 transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground/70"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-5" strokeWidth={active ? 2 : 1.6} />
                <span className="text-[10px] leading-none">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
