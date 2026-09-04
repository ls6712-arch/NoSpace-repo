import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import { Package, Plus, Search, ShoppingBag, Sparkle, User, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { hobbies } from "../data/hobbies";
import { seedPosts } from "../data/posts";
import { products } from "../data/products";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { NotificationsMenu } from "./NotificationsMenu";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AccountMenu() {
  const { user, profile, isConfigured } = useAuth();

  if (!isConfigured) return null;

  if (!user) {
    return (
      <Link to="/login">
        <Button variant="outline" size="sm">
          Log in
        </Button>
      </Link>
    );
  }

  const name = profile?.display_name || "You";

  return (
    <Link to="/you" aria-label="You — your work, saved ideas, and settings" title="You">
      <Avatar className="size-8">
        <AvatarFallback className="text-[11px]">{initials(name)}</AvatarFallback>
      </Avatar>
    </Link>
  );
}

type SearchResult = {
  kind: "hobby" | "product" | "creator";
  key: string;
  label: string;
  sub: string;
  to: string;
};

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
};

/**
 * The four primary destinations, identical on desktop and mobile so the app
 * has one mental model rather than two. "You" is deliberately absent: it hangs
 * off the avatar, because a personal archive is somewhere you go on purpose,
 * not a tab competing with the places you go to make and find things.
 */
const PRIMARY_NAV = [
  { to: "/discover", label: "Discover", hint: "Projects, people, and hobbies worth exploring",
    match: (p: string) => p.startsWith("/discover") || p.startsWith("/space") },
  { to: "/my-space", label: "My Space", hint: "New work from people and Circles you follow",
    match: (p: string) => p.startsWith("/my-space") },
  { to: "/circles", label: "Circles", hint: "Smaller communities built around doing",
    match: (p: string) => p.startsWith("/circles") },
  { to: "/log", label: "Log", hint: "Record your progress", accent: true,
    match: (p: string) => p.startsWith("/log") },
];

export function Header() {
  const { openCart, cartCount } = useCart();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const results = useSearchResults(query);

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
              aria-label="Search projects, spaces, and makers"
              placeholder="Search projects, spaces, makers..."
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
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                              <Icon className="size-3.5 text-muted-foreground" />
                            </span>
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
              aria-label="Search projects, spaces, and makers"
              placeholder="Search projects, spaces, makers..."
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
