import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { MessagesSquare, Plus, Search, ShoppingBag, UserRound, ChevronDown } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { NotificationsMenu } from "./NotificationsMenu";
import { AccountMenuPanel } from "./nav/AccountMenuPanel";
import { GlobalSearchBox } from "./nav/GlobalSearchBox";
import { useChatsBadge } from "./nav/useChatsBadge";
import { formatBadgeCount } from "../lib/messageSync";
import { APP_NAME } from "../config";
import { isDismissKey } from "../lib/menuDismiss";
import { PAGE_X } from "../lib/pageGrid";

/** Pages on the page frame share one page frame (PAGE_X), so the wordmark lines up with their content. */
const FRAMED_PATHS = ["/discover", "/corners", "/corner", "/browse"];
const isFramed = (pathname: string) => FRAMED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function MessagesLink() {
  const badgeCount = useChatsBadge();

  return (
    <Link
      to="/messages"
      aria-label={badgeCount > 0 ? `Messages (${badgeCount} unread)` : "Messages"}
      title="Messages"
    >
      <Button variant="ghost" size="icon" className="relative">
        <MessagesSquare className="size-5" />
        {badgeCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full [background-color:var(--accent-text)] text-caption text-on-brand tabular-nums"
            aria-hidden="true"
          >
            {formatBadgeCount(badgeCount)}
          </span>
        )}
      </Button>
    </Link>
  );
}

/** The avatar itself always goes straight to /you — that's intentional, a
 * personal archive is somewhere you go on purpose. This small caret next to
 * it is the actual "avatar menu": quick access to Settings and an instant
 * theme switch, without hijacking the avatar's own click. */
function AccountMenuPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Navigating away while this is open (any other header link, browser
  // back/forward) used to leave it hanging open over the new page.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Escape closes it and returns focus to the trigger — it previously had
  // no keyboard way to close at all.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!isDismissKey(e.key)) return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-control text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-control border border-border bg-popover shadow-overlay">
          <AccountMenuPanel onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { user, profile, isConfigured } = useAuth();

  if (!isConfigured) return null;

  if (!user) {
    return (
      // The button says Log in, so it opens the login form rather than sign-up.
      <Link to="/login?mode=signin">
        <Button variant="outline" size="sm">
          Log in
        </Button>
      </Link>
    );
  }

  // Until the profile row arrives there is no name to abbreviate. It used to
  // fall back to "You", so the avatar flashed a stray "Y" that belonged to
  // nobody — worse than showing nothing for a moment.
  const name = profile?.display_name?.trim();

  return (
    <div className="flex items-center">
      <Link to="/you" aria-label="You: your profile and saved ideas" title="You" className="flex size-11 items-center justify-center">
        <Avatar className="size-8">
          {profile?.avatar_url && (
            <AvatarImage src={profile.avatar_url} alt="" className="object-cover" />
          )}
          <AvatarFallback className="text-caption">
            {name ? initials(name) : <UserRound className="size-4 text-muted-foreground" />}
          </AvatarFallback>
        </Avatar>
      </Link>
      <AccountMenuPopover />
    </div>
  );
}

/**
 * The primary destinations, identical on desktop and mobile so the app has
 * one mental model rather than two. "You" is deliberately absent: it hangs
 * off the avatar, because a personal archive is somewhere you go on purpose,
 * not a tab competing with the places you go to make and find things.
 *
 * People doesn't get its own top-level slot: it lives inside Discover, as
 * one of Discover's own Spaces/People tabs (?tab=people) — reached from
 * here whenever "Discover" is active. The /people route still resolves on
 * its own for anyone with a direct link; it's just not a separate stop in
 * primary nav anymore, so the phone bar's five tabs and this list describe
 * the same places in the same order rather than two different apps.
 */
const PRIMARY_NAV = [
  { to: "/my-space", label: "Home", hint: "New Moments from the people and hobbies you’re part of",
    match: (p: string) => p.startsWith("/my-space") },
  { to: "/discover", label: "Discover", hint: "Spaces, people and Pursuits",
    match: (p: string) => p.startsWith("/discover") || p.startsWith("/corners") || p.startsWith("/browse") || p.startsWith("/space") || p.startsWith("/people") },
  { to: "/create", label: "Log a Moment", hint: "Share a Moment or start a Pursuit.", accent: true,
    match: (p: string) => p.startsWith("/create") || p.startsWith("/log") },
];

/**
 * The top site header. `hideWithRail` is for a signed-in page that gets the left
 * rail: from 744px (and 480px tall) the rail replaces this header; below that
 * it is shown as before. Signed-out visitors never get the rail, so they never
 * pass it.
 */
export function Header({ hideWithRail = false }: { hideWithRail?: boolean }) {
  const { openCart, cartCount } = useCart();
  const { pathname } = useLocation();
  const framed = isFramed(pathname);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <header className={`ns-site-header sticky top-0 z-50 w-full pt-[var(--safe-top)] border-b border-[var(--hairline)] ${hideWithRail ? "rail:hidden" : ""}`}>
      <div className={`${framed ? PAGE_X : "container mx-auto px-4"} flex h-16 items-center justify-between gap-4`}>
        <div className="flex min-w-0 items-center gap-6">
          {/* The landing page ("/") isn't one of PRIMARY_NAV's own entries
              below — it’s this wordmark — so it carries the same active
              underline itself rather than leaving no primary item active
              (or, as before, leaving My Space wrongly claiming it). */}
          <Link
            to="/"
            className="ns-wordmark relative flex shrink-0 items-center gap-2.5"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            <span className="ns-wordmark-mark" aria-hidden="true" />
            <span className="text-title font-extrabold text-foreground" style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>{APP_NAME}</span>
            {pathname === "/" && (
              <span
                className="absolute -bottom-0.5 left-0 right-0 h-px"
                style={{ backgroundColor: "var(--accent)" }}
                aria-hidden="true"
              />
            )}
          </Link>
          {/* Three destinations, generously spaced. Individual hobby spaces
              are reached through Discover rather than crowding the bar. */}
          <nav className="hidden desk:flex items-center gap-8" aria-label="Primary">
            {PRIMARY_NAV.map((item) => {
              const active = item.match(pathname);
              // Step 3: "Log a Moment" opens the same two-tap sheet the
              // phone bar's Create tab does, rather than the full /create
              // form — see BottomTabBar.tsx's own comment on why. The full
              // form (Log.tsx) stays one "Open the full form" tap away
              // inside it, and /create itself is untouched for anyone
              // linking straight to it.
              if (item.to === "/create") {
                return (
                  <Link
                    key={item.to}
                    to="/create"
                    title={item.hint}
                    className="flex items-center gap-1.5 rounded-control bg-accent px-3.5 py-1.5 text-small text-accent-foreground transition-[filter] hover:brightness-110"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              }
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={item.hint}
                  aria-current={active ? "page" : undefined}
                  className={
                    item.accent
                      ? "flex items-center gap-1.5 rounded-control bg-accent px-3.5 py-1.5 text-small text-accent-foreground transition-[filter] hover:brightness-110"
                      : `relative py-1 text-small transition-colors ${
                          active ? "text-accent" : "text-foreground/75 hover:text-foreground"
                        }`
                  }
                >
                  {item.accent && <Plus className="size-3.5" aria-hidden="true" />}
                  {item.label}
                  {/* Understated active marker — a short rule, not a pill */}
                  {active && !item.accent && (
                    <span
                      className="absolute -bottom-0.5 left-0 right-0 h-px"
                      style={{ backgroundColor: "var(--accent)" }}
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden w-80 tab:block desk:w-72 wide:w-80">
            <GlobalSearchBox />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="tab:hidden"
            aria-label="Search"
            onClick={() => setMobileSearchOpen((v) => !v)}
          >
            <Search className="size-5" />
          </Button>
          <MessagesLink />
          <NotificationsMenu />
          {cartCount > 0 && (
            <Button variant="ghost" size="icon" onClick={openCart} className="relative" aria-label={`Cart (${cartCount})`}>
              <ShoppingBag className="size-5" />
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full [background-color:var(--accent-text)] text-caption text-on-brand tabular-nums">
                {cartCount}
              </span>
            </Button>
          )}
          <AccountMenu />
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="border-t border-[var(--hairline)] px-4 py-3 tab:hidden">
          {/* The same box the rail and the desktop header use: one search, one scope. */}
          <GlobalSearchBox autoFocus inline onDone={() => setMobileSearchOpen(false)} />
        </div>
      )}
    </header>
  );
}
