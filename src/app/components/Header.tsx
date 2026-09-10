import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { MessagesSquare, Package, Plus, Search, ShoppingBag, Sparkle, UserRound, Users, PenLine, Compass, X, type LucideIcon } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useSocial } from "../context/SocialContext";
import { useUnifiedSearch, type SearchGroup, type SearchHit } from "../lib/search";
import { NotificationsMenu } from "./NotificationsMenu";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Only appears once an accepted request has actually opened a thread. */
function MessagesLink() {
  const social = useSocial();
  const open = social.participations.some(
    (p) => p.status === "accepted" && (p.kind === "make_together" || p.kind === "explore_together"),
  );
  if (!open) return null;
  return (
    <Link to="/messages" aria-label="Messages" title="Messages">
      <Button variant="ghost" size="icon">
        <MessagesSquare className="size-5" />
      </Button>
    </Link>
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
    <Link to="/you" aria-label="You: your work, saved ideas, and settings" title="You">
      <Avatar className="size-8">
        {profile?.avatar_url && (
          <AvatarImage src={profile.avatar_url} alt="" className="object-cover" />
        )}
        <AvatarFallback className="text-[11px]">
          {name ? initials(name) : <UserRound className="size-4 text-muted-foreground" />}
        </AvatarFallback>
      </Avatar>
    </Link>
  );
}

/** Same grouping/order/coverage the dedicated /search results page uses
 * (lib/search.ts) — this box is a live preview onto the same index, not a
 * separate, narrower search of its own. */
const RESULT_ICON: Record<SearchGroup, LucideIcon> = {
  space: Compass,
  corner: Sparkle,
  circle: Users,
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
 * one of Discover's own Spaces/Circles/People tabs (?tab=people) — reached
 * from here whenever "Discover" is active. The /people route still resolves
 * on its own for anyone with a direct link; it's just not a separate stop in
 * primary nav anymore, so the phone bar's five tabs and this list describe
 * the same places in the same order rather than two different apps.
 */
const PRIMARY_NAV = [
  { to: "/discover", label: "Discover", hint: "Spaces, Circles, people and pursuits",
    match: (p: string) => p.startsWith("/discover") || p.startsWith("/space") || p.startsWith("/people") },
  { to: "/my-space", label: "My Space", hint: "New work from the people, hobbies and Circles you're part of",
    match: (p: string) => p.startsWith("/my-space") },
  { to: "/circles", label: "Circles", hint: "Communities you can join",
    match: (p: string) => p.startsWith("/circles") },
  { to: "/create", label: "Start your log", hint: "Share a moment, or start a pursuit.", accent: true,
    match: (p: string) => p.startsWith("/create") || p.startsWith("/log") },
];

export function Header() {
  const { openCart, cartCount } = useCart();
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
    <header className="ns-site-header sticky top-0 z-50 w-full border-b border-[var(--hairline)]">
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
            <span className="text-2xl font-semibold text-foreground" style={{ fontFamily: "var(--font-serif)" }}>NoSpace</span>
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
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={item.hint}
                  aria-current={active ? "page" : undefined}
                  className={
                    item.accent
                      ? "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm [background-image:var(--gradient-brand)] text-white shadow-[0_0_0_1px_rgba(166,108,255,0.3),0_8px_20px_-8px_rgba(166,108,255,0.55)] transition-[filter] hover:brightness-110"
                      : `relative py-1 text-sm transition-colors ${
                          active ? "text-[var(--violet-electric-bright)]" : "text-foreground/75 hover:text-foreground"
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
              aria-label="Search hobbies, people, or spaces"
              placeholder="Search hobbies, people, or spaces..."
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
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
                {results.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
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
                                <AvatarFallback className="text-[10px]">{initials(result.label)}</AvatarFallback>
                              </Avatar>
                            ) : (
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                                <Icon className="size-3.5 text-muted-foreground" />
                              </span>
                            )}
                            <span className="min-w-0">
                              <span className="block text-sm truncate">{result.label}</span>
                              <span className="block text-xs text-muted-foreground truncate">{result.sub}</span>
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
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full [background-color:var(--coral-deep)] text-[10px] text-white">
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
              aria-label="Search hobbies, people, or spaces"
              placeholder="Search hobbies, people, or spaces..."
              className="w-full rounded-none border-x-0 border-t-0 border-b-[var(--border)] bg-transparent pl-9 focus-visible:ring-0"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
            />
          </div>
          {query.trim() && (
            <ul className="mt-2 max-h-64 overflow-y-auto rounded-2xl border border-border bg-popover">
              {results.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted-foreground">No matches for "{query}"</li>
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
                        <span className="block truncate text-sm">{result.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{result.sub}</span>
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
