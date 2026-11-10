import { useMemo, useState } from "react";
import { Check, Flag, Search } from "lucide-react";
import { BottomSheet } from "../ui/BottomSheet";
import { Input } from "../ui/input";
import { useCorners, matchCorners } from "../../context/CornersContext";
import type { CornerSuggestion } from "../../lib/cornerSuggestions";

export interface PickerPursuit {
  id: string;
  title: string;
}

/**
 * Where a Moment goes, picked from one full-height list (Log a Moment). Like
 * Instagram's "Add location": a search box on top and plain rows below, no
 * floating dropdowns, so the whole list scrolls inside the sheet on any screen.
 *
 * Without a search: your Pursuits, your Corners, then every Corner A to Z.
 * With one: Pursuits whose title matches, then matching Corners.
 * A tap picks and closes. Tapping what is already picked clears it.
 */
export function CornerPickerSheet({
  open,
  onOpenChange,
  pursuits,
  yourCorners,
  pickedPursuitId,
  pickedCorner,
  onPickPursuit,
  onPickCorner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pursuits: PickerPursuit[];
  yourCorners: CornerSuggestion[];
  pickedPursuitId: string;
  /** `${spaceSlug}/${slug}` of the picked Corner, or "". */
  pickedCorner: string;
  onPickPursuit: (id: string) => void;
  onPickCorner: (c: CornerSuggestion) => void;
}) {
  const { allCorners } = useCorners();
  const [query, setQuery] = useState("");
  const q = query.trim();

  const everyCorner = useMemo(
    () => [...allCorners].sort((a, b) => a.name.localeCompare(b.name)),
    [allCorners],
  );
  const shownPursuits = q ? pursuits.filter((p) => p.title.toLowerCase().includes(q.toLowerCase())) : pursuits;
  const shownCorners = q ? matchCorners(allCorners, q) : everyCorner;
  const yours = q ? [] : yourCorners;
  const yoursKeys = new Set(yours.map((c) => `${c.spaceSlug}/${c.slug}`));

  const close = () => {
    setQuery("");
    onOpenChange(false);
  };
  const row = "flex min-h-14 w-full items-center justify-between gap-3 border-b border-border py-3 text-left text-body";

  return (
    <BottomSheet open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())} title="Add to a Corner" full>
      <div className="sticky top-0 z-10 bg-card pb-2 pt-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Corners"
            aria-label="Search Corners"
            className="pl-9"
          />
        </div>
      </div>

      {shownPursuits.length > 0 && (
        <section aria-labelledby="picker-pursuits" className="mt-3">
          <h2 id="picker-pursuits" className="text-small text-muted-foreground">Your Pursuits</h2>
          <ul>
            {shownPursuits.map((p) => {
              const on = pickedPursuitId === p.id;
              return (
                <li key={p.id}>
                  <button type="button" aria-pressed={on} className={row} onClick={() => { onPickPursuit(p.id); close(); }}>
                    <span className="flex min-w-0 items-center gap-2">
                      <Flag className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{p.title}</span>
                    </span>
                    {on && <Check className="size-4 shrink-0 text-[var(--coral)]" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {yours.length > 0 && (
        <section aria-labelledby="picker-yours" className="mt-5">
          <h2 id="picker-yours" className="text-small text-muted-foreground">Your Corners</h2>
          <ul>
            {yours.map((c) => {
              const key = `${c.spaceSlug}/${c.slug}`;
              const on = !pickedPursuitId && pickedCorner === key;
              return (
                <li key={key}>
                  <button type="button" aria-pressed={on} className={row} onClick={() => { onPickCorner(c); close(); }}>
                    <span className="truncate">{c.name}</span>
                    {on && <Check className="size-4 shrink-0 text-[var(--coral)]" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="picker-all" className="mt-5">
        <h2 id="picker-all" className="text-small text-muted-foreground">{q ? "Corners" : "All Corners"}</h2>
        {shownCorners.length === 0 ? (
          <p className="py-4 text-small text-muted-foreground">No Corner matches that.</p>
        ) : (
          <ul>
            {shownCorners
              .filter((c) => !yoursKeys.has(`${c.spaceSlug}/${c.slug}`))
              .map((c) => {
                const key = `${c.spaceSlug}/${c.slug}`;
                const on = !pickedPursuitId && pickedCorner === key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      aria-pressed={on}
                      className={row}
                      onClick={() => { onPickCorner({ spaceSlug: c.spaceSlug, slug: c.slug, name: c.name }); close(); }}
                    >
                      <span className="truncate">{c.name}</span>
                      {on && <Check className="size-4 shrink-0 text-[var(--coral)]" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
      </section>
    </BottomSheet>
  );
}
