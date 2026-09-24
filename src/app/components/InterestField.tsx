import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { bestMatch } from "../lib/tagMatching";
import { useKnownInterests } from "./useKnownInterests";
import { Input } from "./ui/input";

/**
 * What a post is *about*: "Pottery", "Bouldering", "Sourdough".
 *
 * Free text, because nobody's hobby fits a list somebody else wrote. The
 * suggestions come from what people have already typed, so wording converges
 * on its own — the first person to write "Bouldering" makes it the obvious
 * spelling for the next, without anyone maintaining a taxonomy.
 *
 * Deliberately separate from the Space a post goes in. The Space is where it
 * lives; this is what it's about.
 */
export function InterestField({
  value,
  onChange,
  id = "interest",
  placeholder = "Pottery, bouldering, sourdough…",
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  placeholder?: string;
}) {
  const known = useKnownInterests();
  const [focused, setFocused] = useState(false);

  const query = value.trim().toLowerCase();
  const suggestions = useMemo(() => {
    const pool = query
      ? known.filter((k) => k.toLowerCase().includes(query) && k.toLowerCase() !== query)
      : known;
    return pool.slice(0, 8);
  }, [known, query]);

  // The single source of truth for "does this already exist?" — exact,
  // typo, and truncation matches all come from the same check every other
  // free-text tag entry point uses (lib/tagMatching.ts), so "espresso"
  // resolves the same way here as it does everywhere else.
  const match = useMemo(() => bestMatch(value, known), [value, known]);
  const exact = match?.kind === "exact" ? match.label : undefined;
  // A close-but-not-exact match is a suggestion, never a redirect — typing
  // stays exactly what was typed unless the person clicks it themselves.
  const closeMatch = match && match.kind !== "exact" ? match : null;

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        maxLength={40}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        // A click on a suggestion has to land before the list closes.
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
      />
      {!value.trim() && !focused && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Anything you like, not listed? Enter your own.
        </p>
      )}

      {value.trim() && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {exact ? (
            <span className="flex items-center gap-1">
              <Check className="size-3 text-foreground" />
              Others use this too. Your Moment joins theirs.
            </span>
          ) : closeMatch ? (
            <span>
              Close to “{closeMatch.label}” —{" "}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChange(closeMatch.label)}
                className="text-[var(--coral-text)] underline decoration-dotted underline-offset-2"
              >
                use that instead
              </button>
              , or keep typing your own.
            </span>
          ) : (
            "New one. It'll show up as a suggestion for everyone after this."
          )}
        </p>
      )}

      {focused && (suggestions.length > 0 || query.length > 0) && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-border bg-popover py-1 shadow-xl">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s);
                  setFocused(false);
                }}
                className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
              >
                {s}
              </button>
            </li>
          ))}

          {/* The suggestions are a convenience, never a list you must pick
              from. Saying so out loud stops people abandoning a hobby that
              isn't offered — which is most of them. */}
          <li className="border-t border-[var(--hairline)] px-4 py-2.5">
            {query.length > 0 && !exact ? (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setFocused(false)}
                className="text-left text-xs text-[var(--coral-text)]"
              >
                Use “{value.trim()}” as your own
              </button>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                Not listed? Just type your own.
              </span>
            )}
          </li>
        </ul>
      )}
    </div>
  );
}
