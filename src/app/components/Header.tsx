import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { MessagesSquare, Package, Plus, Search, ShoppingBag, Sparkle, User, UserRound, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { hobbies } from "../data/hobbies";
import { seedPosts } from "../data/posts";
import { products } from "../data/products";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { useSocial } from "../context/SocialContext";
import { usePeopleSearch, profilePath } from "../lib/people";
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
    <Link to="/you" aria-label="You — your work, saved ideas, and settings" title="You">
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

type SearchResult = {
  kind: "hobby" | "product" | "creator" | "person";
  key: string;
  label: string;
  sub: string;
  to: string;
  avatarUrl?: string;
};

/**
 * Real accounts, searched live. The rest of this box searches the app's
 * sample content, which is fine for hobbies and products but meant that a
 * person who had actually signed up could never be found here.
 */
function usePersonResults(query: string): SearchResult[] {
  const { people } = usePeopleSearch(query);
  return useMemo(
    () =>
      people.map((person) => ({
        kind: "person" as const,
        key: `person-${person.id}`,
        label: person.displayName,
        sub:
          person.hobbyKeys
            .map((k) => hobbies.find((h) => h.slug === k)?.shortName)
            .filter(Boolean)
            .slice(0, 2)
            .join(" · ") || "On NoSpace",
        to: profilePath(person),
        avatarUrl: person.avatarUrl,
      })),
    [people],
  );
}

function useSearchResults(query: string): SearchResult[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: SearchResult[] = [];

    for (const hobby of hobbies) {
      if (
        hobby.shortName.toLowerCase().includes(q) ||
        hobby.name.toLowerCase().includes(q) ||
        hobby.tagline.toLowerCase().includes(q)
      ) {
        results.push({
          kind: "hobby",
          key: `hobby-${hobby.slug}`,
          label: hobby.shortName,
          sub: hobby.tagline,
          to: `/space/${hobby.slug}`,
        });
      }
    }

    for (const product of products) {
      if (product.name.toLowerCase().includes(q)) {
        results.push({
          kind: "product",
          key: `product-${product.id}`,
          label: product.name,
          sub: `$${product.price.toFixed(0)} · ${hobbies.find((h) => h.slug === product.hobbySlug)?.shortName ?? ""}`,
          to: `/product/${product.id}`,
        });
      }
    }

    const seenCreators = new Set<string>();
    for (const post of seedPosts) {
      if (post.creator.toLowerCase().includes(q) && !seenCreators.has(post.creator)) {
        seenCreators.add(post.creator);
        results.push({
          kind: "creator",
          key: `creator-${post.creator}`,
          label: post.creator,
          sub: `Posts in ${hobbies.find((h) => h.slug === post.hobbySlug)?.shortName ?? ""}`,
          to: `/space/${post.hobbySlug}`,
        });
      }
    }

    return results.slice(0, 8);
  }, [query]);
}

const RESULT_ICON: Record<SearchResult["kind"], typeof Sparkle> = {
  hobby: Sparkle,
  product: Package,
  creator: User,
  person: User,
};

/**
 * The four primary destinations, identical on desktop and mobile so the app
 * has one mental model rather than two. "You" is deliberately absent: it hangs
 * off the avatar, because a personal archive is somewhere you go on purpose,
 * not a tab competing with the places you go to make and find things.
 */
/**
 * Desktop has room for the full set. The phone bar carries five of these and
 * folds Circles and People into Discover, which is where they're defined to
 * live anyway — so the two bars name the same places in the same order rather
 * than describing two different apps.
 */
const PRIMARY_NAV = [
  { to: "/my-space", label: "My Space", hint: "New work from the people, hobbies and Circles you're part of",
    match: (p: string) => p === "/" || p.startsWith("/my-space") },
  { to: "/discover", label: "Discover", hint: "Hobbies, interests, people, Circles and projects",
    match: (p: string) => p.startsWith("/discover") || p.startsWith("/space") },
  { to: "/circles", label: "Circles", hint: "Communities you can join",
    match: (p: string) => p.startsWith("/circles") },
  { to: "/people", label: "People", hint: "Find people by what they make",
    match: (p: string) => p.startsWith("/people") },
  { to: "/create", label: "Create", hint: "Share a moment, post or project", accent: true,
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
  const sampleResults = useSearchResults(query);
  const personResults = usePersonResults(query);
  // Real people first — someone typing a name is looking for the person.
  const results = useMemo(() => {
    // A real account always wins over a sample creator of the same name, so
    // the same person never appears twice in one list.
    const realNames = new Set(personResults.map((r) => r.label.toLowerCase()));
    return [
      ...personResults,
      ...sampleResults.filter(
        (r) => !(r.kind === "creator" && realNames.has(r.label.toLowerCase())),
      ),
    ];
  }, [personResults, sampleResults]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function goToResult(result: SearchResult) {
    navigate(result.to);
    setQuery("");
    setSearchOpen(false);
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setQuery("");
      setSearchOpen(false);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Enter" && results.length > 0) {
      goToResult(results[0]);
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--hairline)] [background-color:color-mix(in_srgb,var(--sky)_92%,#FFFFFF)] backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="text-2xl font-semibold text-[var(--forest)]" style={{ fontFamily: "var(--font-serif)" }}>
              NoSpace
            </span>
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
                      ? "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm text-white transition-[filter] [background-color:var(--coral-deep)] hover:brightness-110"
                      : `relative py-1 text-sm transition-colors ${
                          active ? "text-foreground" : "text-foreground/80 hover:text-foreground"
                        }`
                  }
                >
                  {item.accent && <Plus className="size-3.5" aria-hidden="true" />}
                  {item.label}
                  {/* Understated active marker — a short rule, not a pill */}
                  {active && !item.accent && (
                    <span
                      className="absolute -bottom-0.5 left-0 right-0 h-px"
                      style={{ backgroundColor: "var(--coral)" }}
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
              aria-label="Search people, projects, and spaces"
              placeholder="Search people, projects, spaces..."
              className="pl-9 w-full rounded-full"
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
                      const Icon = RESULT_ICON[result.kind];
                      return (
                        <li key={result.key}>
                          <button
                            type="button"
                            onClick={() => goToResult(result)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-muted transition-colors"
                          >
                            {result.kind === "person" ? (
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
              aria-label="Search people, projects, and spaces"
              placeholder="Search people, projects, spaces..."
              className="w-full rounded-full pl-9"
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
