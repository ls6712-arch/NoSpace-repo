import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { SEARCH_SHORTCUT_EVENT } from "../../lib/searchShortcut";
import { Compass, MessagesSquare, Package, PenLine, Search, Sparkle, UserRound, type LucideIcon } from "lucide-react";
import { Input } from "../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useUnifiedSearch, type SearchGroup, type SearchHit } from "../../lib/search";

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Same grouping/order/coverage the dedicated /search results page uses
 * (lib/search.ts): this box is a live preview onto the same index, not a
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
 * The search box with its live results: type, pick a result, or press Enter
 * for the full results page. The top header's desktop box and the rail's
 * Search panel are this one component. `onDone` runs after a result or the
 * results page is chosen, and when Escape is pressed.
 */
export function GlobalSearchBox({
  onDone,
  autoFocus = false,
  inline = false,
  launcher = false,
}: {
  onDone?: () => void;
  autoFocus?: boolean;
  inline?: boolean;
  /**
   * A page-level box (Discover's) that only leads to the search: focusing or tapping it opens /search, where the
   * cursor is already in the box. It never shows results of its own.
   */
  launcher?: boolean;
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { all: results } = useUnifiedSearch(query);

  // "/" on desktop: the box that is on screen takes the focus (the launcher never does, it would just navigate).
  useEffect(() => {
    if (launcher || inline) return;
    const focus = () => {
      const el = inputRef.current;
      if (el && el.offsetParent !== null) el.focus();
    };
    window.addEventListener(SEARCH_SHORTCUT_EVENT, focus);
    return () => window.removeEventListener(SEARCH_SHORTCUT_EVENT, focus);
  }, [launcher, inline]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const goToResult = (result: SearchHit) => {
    navigate(result.to);
    setQuery("");
    setOpen(false);
    onDone?.();
  };
  const goToResults = (q: string) => {
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setQuery("");
    setOpen(false);
    onDone?.();
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
      (e.target as HTMLInputElement).blur();
      onDone?.();
    } else if (e.key === "Enter" && query.trim()) {
      // Enter always goes to the full grouped results page; picking one
      // specific item from the list is still just a click away.
      goToResults(query.trim());
    }
  };

  if (launcher) {
    return (
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          readOnly
          aria-label="Search Moments, people, Spaces"
          placeholder="Search Moments, people, Spaces"
          className="min-h-12 w-full rounded-full border-border bg-card pl-11 pr-4 text-body"
          onFocus={() => navigate("/search")}
          onClick={() => navigate("/search")}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={ref}>
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="search"
        autoFocus={autoFocus}
        aria-label="Search Moments, people, Spaces"
        placeholder="Search Moments, people, Spaces"
        className="w-full rounded-none border-x-0 border-t-0 border-b-[var(--border)] bg-transparent pl-9 focus-visible:ring-0"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && query.trim() && (
        <div
          className={`${inline ? "mt-2" : "absolute left-0 right-0 top-full mt-2"} z-50 overflow-hidden rounded-card border border-border bg-popover/95 shadow-overlay backdrop-blur-xl`}
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-small text-muted-foreground">No matches for “{query}”</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((result) => {
                const Icon = RESULT_ICON[result.group];
                return (
                  <li key={result.key}>
                    <button type="button" onClick={() => goToResult(result)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-muted">
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
                        <span className="block truncate text-small" title={result.label}>
                          {result.label}
                        </span>
                        <span className="block truncate text-caption text-muted-foreground" title={result.sub}>
                          {result.sub}
                        </span>
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
  );
}
