import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useCorners } from "../context/CornersContext";
import { Input } from "./ui/input";

/**
 * Tags a Moment into a Corner inside one Space. Corners are created by
 * tagging, not suggestion-and-approval (sql/corners.sql): typing a name that
 * doesn't exist yet in this Space and confirming it creates the Corner,
 * right here, no queue.
 *
 * Existing Corners in the Space show as chips for a one-tap pick. Typing
 * autocompletes toward them first — "Pasta" surfaces "Pasta Making" before
 * offering to create anything new — so near-duplicate spellings converge on
 * one real Corner instead of fragmenting into dead ends.
 */
export function CornerTagField({
  spaceSlug,
  value,
  onChange,
}: {
  spaceSlug: string;
  /** The selected Corner's slug, or "" for none. */
  value: string;
  onChange: (slug: string, name: string) => void;
}) {
  const { cornersFor, matchesFor, getOrCreateCorner } = useCorners();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [creating, setCreating] = useState(false);

  const topCorners = cornersFor(spaceSlug).slice(0, 8);
  const q = query.trim();
  const matches = q ? matchesFor(spaceSlug, q) : [];
  const exact = matches.find((m) => m.name.toLowerCase() === q.toLowerCase());

  function pick(slug: string, name: string) {
    onChange(slug, name);
    setQuery("");
    setFocused(false);
  }

  async function createNew() {
    if (!q || creating) return;
    setCreating(true);
    const { slug, name } = await getOrCreateCorner(spaceSlug, q);
    setCreating(false);
    pick(slug, name);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {topCorners.map((c) => {
          const active = value === c.slug;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => pick(active ? "" : c.slug, c.name)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-transparent text-white [background-color:var(--coral-deep)]"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      <div className="relative mt-2">
        <Input
          value={query}
          maxLength={60}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          placeholder="Type a Corner, e.g. Pasta Making"
        />

        {focused && q && (
          <ul className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-border bg-popover py-1 shadow-xl">
            {matches.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(c.slug, c.name)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
                >
                  <span>{c.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {c.momentCount > 0 ? `${c.momentCount} Moments` : "New"}
                  </span>
                </button>
              </li>
            ))}
            {!exact && (
              <li className="border-t border-[var(--hairline)] px-4 py-2.5">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={createNew}
                  disabled={creating}
                  className="flex items-center gap-1.5 text-left text-xs text-[var(--coral-text)]"
                >
                  <Plus className="size-3" />
                  {creating ? "Creating…" : `Create "${q}" as a new Corner`}
                </button>
              </li>
            )}
            {exact && (
              <li className="border-t border-[var(--hairline)] px-4 py-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Check className="size-3 text-[var(--forest)]" />
                  Already a Corner here. Pick it above to use it.
                </span>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
