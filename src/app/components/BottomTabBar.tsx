import { Link, useLocation } from "react-router";
import { Home, Compass, Plus, Library, User } from "lucide-react";

/**
 * Phone navigation: Home · Explore · + · Shelf · Profile, with the create
 * action raised into a wooden disc in the middle. Shown only on small screens
 * — the desktop header already carries the same destinations, and two navs at
 * once would be noise.
 *
 * "Shelf" is the marketplace for now, as the closest existing destination.
 */
const TABS = [
  { to: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
  {
    to: "/discover",
    label: "Explore",
    icon: Compass,
    match: (p: string) => p.startsWith("/discover") || p.startsWith("/space"),
  },
  { to: "/create", label: "", icon: Plus, match: () => false, primary: true },
  { to: "/shop", label: "Shelf", icon: Library, match: (p: string) => p.startsWith("/shop") },
  { to: "/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/profile") },
];

export function BottomTabBar() {
  const { pathname } = useLocation();

  return (
    <>
      {/* Keeps page content clear of the bar, including the iOS home indicator. */}
      <div className="h-[76px] sm:hidden" aria-hidden="true" />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0A0B14]/95 backdrop-blur-xl sm:hidden"
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
                  key={tab.to}
                  to={tab.to}
                  aria-label="Log a session"
                  className="-mt-6 flex size-14 items-center justify-center rounded-full text-[#F3EDE0] shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
                  style={{
                    background:
                      "linear-gradient(160deg, var(--wood-light) 0%, var(--wood) 60%, var(--wood-dark) 100%)",
                  }}
                >
                  <Icon className="size-6" strokeWidth={2} />
                </Link>
              );
            }

            return (
              <Link
                key={tab.to}
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
