import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useCorners } from "../context/CornersContext";
import { bestMatch, MatchResult } from "../lib/tagMatching";
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
  // A close-but-not-identical hit on the about-to-create name — same
  // pattern as CreateCornerDialog.tsx, since this field can mint a Corner
  // too. Confirmed once (via createNew's own guard below), then a second
  // "Create anyway" proceeds.
  const [pendingConfirm, setPendingConfirm] = useState<MatchResult | null>(null);

  const topCorners = cornersFor(spaceSlug).slice(0, 8);
  const q = query.trim();
  const matches = q ? matchesFor(spaceSlug, q) : [];
  const cornerNames = useMemo(() => cornersFor(spaceSlug).map((c) => c.name), [cornersFor, spaceSlug]);
  // Same "does this already exist?" check every other free-text tag entry
  // point uses (lib/tagMatching.ts) — case, accents, and punctuation all
  // fold together here, a stricter bar than the plain case-fold this used
  // to do, and the same bar CreateCornerDialog's slug check applies.
  const tagMatch = q ? bestMatch(q, cornerNames) : null;
  const exact = tagMatch?.kind === "exact";

  function pick(slug: string, name: string) {
    onChange(slug, name);
    setQuery("");
    setPendingConfirm(null);
    setFocused(false);
  }

  async function createNew() {
    if (!q || creating) return;
    if (!pendingConfirm && tagMatch && tagMatch.kind !== "exact") {
      setPendingConfirm(tagMatch);
      return;
    }
    setCreating(true);
    const { slug, name } = await getOrCreateCorner(spaceSlug, q);
    setCreating(false);
    setPendingConfirm(null);
    pick(slug, name);
  }

  function useExistingInstead() {
    if (!pendingConfirm) return;
    const existing = cornersFor(spaceSlug).find((c) => c.name === pendingConfirm.label);
    if (existing) pick(existing.slug, existing.name);
    setPendingConfirm(null);
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
          onChange={(e) => {
            setQuery(e.target.value);
            setPendingConfirm(null);
          }}
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
            {!exact && !pendingConfirm && (
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
            {/* A fuzzy, not-exact hit — hard-blocking (like the exact case
                below) would be too aggressive for a real typo/near-miss, but
                creating silently would fragment "Pasta Making" and "Pasta
                Makign" into two dead-end Corners. Pause once, then either
                choice proceeds. */}
            {!exact && pendingConfirm && (
              <li className="border-t border-[var(--hairline)] px-4 py-2.5">
                <p className="mb-2 text-[11px] text-muted-foreground">
                  Close to “{pendingConfirm.label}” — the same Corner, or something different?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={useExistingInstead}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] text-foreground transition-colors hover:border-foreground/30"
                  >
                    Use “{pendingConfirm.label}”
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={createNew}
                    disabled={creating}
                    className="rounded-full border border-transparent bg-[var(--coral-deep)] px-2.5 py-1 text-[11px] text-white"
                  >
                    {creating ? "Creating…" : "Create anyway"}
                  </button>
                </div>
              </li>
            )}
            {exact && (
              <li className="border-t border-[var(--hairline)] px-4 py-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Check className="size-3 text-foreground" />
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
