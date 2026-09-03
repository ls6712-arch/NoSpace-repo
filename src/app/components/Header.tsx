import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { LogOut, Menu, Package, Plus, Search, ShoppingBag, Sparkle, User, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { hobbies } from "../data/hobbies";
import { seedPosts } from "../data/posts";
import { products } from "../data/products";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { RewardsWidget } from "./RewardsWidget";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AccountMenu() {
  const { user, profile, isConfigured, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

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
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Account menu">
        <Avatar className="size-8">
          <AvatarFallback className="text-[11px]">{initials(name)}</AvatarFallback>
        </Avatar>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-white/10 bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
          <div className="px-4 py-3 text-sm truncate border-b border-white/10">{name}</div>
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
          >
            <User className="size-3.5" />
            Profile
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-white/5 transition-colors"
          >
            <LogOut className="size-3.5" />
            Log out
          </button>
        </div>
      )}
    </div>
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

export function Header() {
  const { openCart, cartCount } = useCart();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <span className="text-2xl font-semibold text-gradient-brand" style={{ fontFamily: "var(--font-heading)" }}>
              NoSpace
            </span>
          </Link>
          <nav className="hidden lg:flex items-center gap-5">
            {hobbies.map((hobby) => (
              <Link
                key={hobby.slug}
                to={`/space/${hobby.slug}`}
                title={hobby.name}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {hobby.shortName}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden md:flex flex-1 max-w-sm">
          <div className="relative w-full" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search creators, spaces, and drops"
              placeholder="Search creators, spaces, drops..."
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
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-white/10 bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden z-50">
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
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                          >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5">
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

        <div className="flex items-center gap-2 shrink-0">
          <Link to="/create" className="hidden sm:block">
            <Button variant="brand" size="sm">
              <Plus className="size-4" />
              Create
            </Button>
          </Link>
          <RewardsWidget />
          <Button
            variant="ghost"
            size="icon"
            onClick={openCart}
            className="relative"
          >
            <ShoppingBag className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-[#D8739B] text-[10px] text-white">
                {cartCount}
              </span>
            )}
          </Button>
          <AccountMenu />
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-background/95 backdrop-blur-xl">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-1">
            {hobbies.map((hobby) => (
              <Link
                key={hobby.slug}
                to={`/space/${hobby.slug}`}
                onClick={() => setMobileMenuOpen(false)}
                className="text-sm py-2 hover:text-accent transition-colors"
              >
                {hobby.name}
              </Link>
            ))}
            <Link
              to="/create"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm py-2 text-[#38BDF8]"
            >
              + Create something
            </Link>
            <Link
              to="/shop"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm py-2 text-muted-foreground"
            >
              Marketplace
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
