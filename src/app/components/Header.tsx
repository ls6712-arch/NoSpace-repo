import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { Flag, MessagesSquare, Package, Plus, Search, Settings as SettingsIcon, ShoppingBag, Sparkle, UserRound, PenLine, Compass, ChevronDown, X, type LucideIcon } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useQuickLog } from "../context/QuickLogContext";
import { useAuth } from "../context/AuthContext";
import { useTheme, type ThemePreference } from "../context/ThemeContext";
import { useCategories } from "../context/CategoriesContext";
import { supabase } from "../../lib/supabase";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useUnifiedSearch, type SearchGroup, type SearchHit } from "../lib/search";
import { NotificationsMenu } from "./NotificationsMenu";
import { useSocial } from "../context/SocialContext";
import { formatBadgeCount } from "../lib/messageSync";
import { APP_NAME } from "../config";
import { isDismissKey } from "../lib/menuDismiss";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function MessagesLink() {
  const social = useSocial();
  const badgeCount = social.chatsUnreadCount + social.messageRequests.length;

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
            className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full [background-color:var(--coral-deep)] text-caption text-on-brand"
            aria-hidden="true"
          >
            {formatBadgeCount(badgeCount)}
          </span>
        )}
      </Button>
    </Link>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** The avatar itself always goes straight to /you — that's intentional, a
 * personal archive is somewhere you go on purpose. This small caret next to
 * it is the actual "avatar menu": quick access to Settings and an instant
 * theme switch, without hijacking the avatar's own click. */
function AccountMenuPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { preference, setPreference } = useTheme();
  const { isAdmin } = useCategories();
  const location = useLocation();
  const [openReportCount, setOpenReportCount] = useState<number | null>(null);

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

  // Cheap (a HEAD request, no rows) and only for an admin who's actually
  // opened the menu — every other visitor never runs this at all.
  useEffect(() => {
    if (!open || !isAdmin || !supabase) return;
    let cancelled = false;
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .then(({ count }) => {
        if (!cancelled) setOpenReportCount(count ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isAdmin]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 min-w-6 items-center justify-center rounded-control text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className="size-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-control border border-border bg-popover shadow-lg">
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-2.5 px-4 py-3 text-small transition-colors hover:bg-surface-muted"
          >
            <SettingsIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            Settings
          </Link>
          {isAdmin && (
            <Link
              to="/admin/reports"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-2.5 px-4 py-3 text-small transition-colors hover:bg-surface-muted"
            >
              <Flag className="size-4 text-muted-foreground" aria-hidden="true" />
              Reports
              {!!openReportCount && (
                <span
                  className="ml-auto flex size-5 items-center justify-center rounded-full [background-color:var(--coral-deep)] text-caption text-on-brand"
                  aria-label={`${openReportCount} open`}
                >
                  {formatBadgeCount(openReportCount)}
                </span>
              )}
            </Link>
          )}
          <div className="border-t border-[var(--hairline)] px-4 py-3">
            <div className="mb-2 text-caption text-muted-foreground">Theme</div>
            <div className="flex gap-1 rounded-control border border-border p-0.5">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={preference === opt.value}
                  onClick={() => setPreference(opt.value)}
                  className={
                    "min-h-8 flex-1 rounded-control px-2 text-caption transition-colors " +
                    (preference === opt.value
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
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
    <div className="flex items-center gap-0.5">
      <Link to="/you" aria-label="You: your profile and saved ideas" title="You">
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

/** Same grouping/order/coverage the dedicated /search results page uses
 * (lib/search.ts) — this box is a live preview onto the same index, not a
 * separate, narrower search of its own. */
const RESULT_ICON: Record<SearchGroup, LucideIcon> = {
  space: Compass,
  corner: Sparkle,
  person: UserRound,
  pursuit: PenLine,
  moment: MessagesSquare,
  product: Package,
};

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
  { to: "/discover", label: "Discover", hint: "Spaces, people and pursuits",
    match: (p: string) => p.startsWith("/discover") || p.startsWith("/space") || p.startsWith("/people") },
  { to: "/my-space", label: "Home", hint: "New Moments from the people and hobbies you're part of",
    match: (p: string) => p.startsWith("/my-space") },
  { to: "/create", label: "Log a Moment", hint: "Share a moment, or start a pursuit.", accent: true,
    match: (p: string) => p.startsWith("/create") || p.startsWith("/log") },
];

export function Header() {
  const { openCart, cartCount } = useCart();
  const { openQuickLog } = useQuickLog();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { all: results } = useUnifiedSearch(query);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function goToResult(result: SearchHit) {
    navigate(result.to);
    setQuery("");
    setSearchOpen(false);
  }

  function goToResults(q: string) {
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setQuery("");
    setSearchOpen(false);
    setMobileSearchOpen(false);
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setQuery("");
      setSearchOpen(false);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Enter" && query.trim()) {
      // Submitting used to jump straight into whatever happened to be
      // first in the preview list — often an unrelated product, since the
      // old search barely covered anything but Space names and products.
      // Enter now always goes to the full grouped results page; picking
      // one specific item from the dropdown is still just a click away.
      goToResults(query.trim());
    }
  }

  return (
    <header className="ns-site-header sticky top-0 z-50 w-full pt-[var(--safe-top)] border-b border-[var(--hairline)]">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-center gap-6">
          {/* The landing page ("/") isn't one of PRIMARY_NAV's own entries
              below — it's this wordmark — so it carries the same active
              underline itself rather than leaving no primary item active
              (or, as before, leaving My Space wrongly claiming it). */}
          <Link
            to="/"
            className="ns-wordmark relative flex shrink-0 items-center gap-2.5"
            aria-current={pathname === "/" ? "page" : undefined}
          >
            <span className="ns-wordmark-mark" aria-hidden="true" />
            <span className="text-title font-semibold text-foreground" style={{ fontFamily: "var(--font-serif)" }}>{APP_NAME}</span>
            {pathname === "/" && (
              <span
                className="absolute -bottom-0.5 left-0 right-0 h-px"
                style={{ backgroundColor: "var(--violet-electric)" }}
                aria-hidden="true"
              />
            )}
          </Link>
          {/* Three destinations, generously spaced. Individual hobby spaces
              are reached through Discover rather than crowding the bar. */}
          <nav className="hidden lg:flex items-center gap-8" aria-label="Primary">
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
                  <button
                    key={item.to}
                    type="button"
                    title={item.hint}
                    onClick={openQuickLog}
                    className="flex items-center gap-1.5 rounded-control bg-accent px-3.5 py-1.5 text-small text-accent-foreground transition-[filter] hover:brightness-110"
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {item.label}
                  </button>
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
                      style={{ backgroundColor: "var(--violet-electric)" }}
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden w-56 md:block lg:w-64">
          <div className="relative w-full" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search Moments, people, Spaces"
              placeholder="Search Moments, people, Spaces"
              className="w-full rounded-none border-x-0 border-t-0 border-b-[var(--border)] bg-transparent pl-9 focus-visible:ring-0"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={onSearchKeyDown}
            />
            {searchOpen && query.trim() && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-card border border-border bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
                {results.length === 0 ? (
                  <p className="px-4 py-3 text-small text-muted-foreground">
                    No matches for "{query}"
                  </p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto py-1">
                    {results.map((result) => {
                      const Icon = RESULT_ICON[result.group];
                      return (
                        <li key={result.key}>
                          <button
                            type="button"
                            onClick={() => goToResult(result)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-muted transition-colors"
                          >
                            {result.group === "person" ? (
                              <Avatar className="size-8 shrink-0">
                                {result.avatarUrl && <AvatarImage src={result.avatarUrl} alt="" className="object-cover" />}
                                <AvatarFallback className="text-caption">{initials(result.label)}</AvatarFallback>
                              </Avatar>
                            ) : (
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                                <Icon className="size-3.5 text-muted-foreground" />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block text-small truncate">{result.label}</span>
                              <span className="block text-caption text-muted-foreground truncate">{result.sub}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
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
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full [background-color:var(--coral-deep)] text-caption text-on-brand">
                {cartCount}
              </span>
            </Button>
          )}
          <AccountMenu />
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="border-t border-[var(--hairline)] px-4 py-3 md:hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              autoFocus
              aria-label="Search Moments, people, Spaces"
              placeholder="Search Moments, people, Spaces"
              className="w-full rounded-none border-x-0 border-t-0 border-b-[var(--border)] bg-transparent pl-9 focus-visible:ring-0"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
          </div>
          {query.trim() && (
            <ul className="mt-2 max-h-64 overflow-y-auto rounded-card border border-border bg-popover">
              {results.length === 0 ? (
                <li className="px-4 py-3 text-small text-muted-foreground">No matches for "{query}"</li>
              ) : (
                results.map((result) => (
                  <li key={result.key}>
                    <button
                      type="button"
                      onClick={() => {
                        goToResult(result);
                        setMobileSearchOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-small">{result.label}</span>
                        <span className="block truncate text-caption text-muted-foreground">{result.sub}</span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </header>
  );
}
