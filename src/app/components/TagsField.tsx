import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { bestMatch, normalize } from "../lib/tagMatching";
import { useKnownTags } from "./useKnownTags";
import { Input } from "./ui/input";

const MAX_TAGS = 8;

/**
 * What a Moment is about — open, multiple, and never gated behind a fixed
 * list. Replaces the old single-value InterestField-plus-Space-picker pair
 * on the composer's caption screen: instead of picking one Space and typing
 * one "interest" underneath it, a Moment just carries however many tags
 * actually describe it ("food photography" is two tags, not a contradiction
 * between a Space and its interest field).
 *
 * Suggestions come from every tag anyone's already used (useKnownTags), so
 * spelling converges on its own the same way InterestField's did — the
 * first person to type "Bouldering" makes it the obvious spelling for the
 * next, with nobody maintaining a taxonomy.
 */
export function TagsField({
  value,
  onChange,
  id = "tags",
  placeholder = "Add tags — pottery, sourdough, bouldering…",
  max = MAX_TAGS,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  id?: string;
  placeholder?: string;
  max?: number;
}) {
  const known = useKnownTags();
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

  const atCap = value.length >= max;
  const alreadyAdded = useMemo(() => new Set(value.map((t) => normalize(t))), [value]);

  const query = draft.trim().toLowerCase();
  const suggestions = useMemo(() => {
    const pool = known.filter((k) => !alreadyAdded.has(normalize(k)));
    const filtered = query ? pool.filter((k) => k.toLowerCase().includes(query)) : pool;
    return filtered.slice(0, 8);
  }, [known, query, alreadyAdded]);

  // Same single source of truth for "does this already exist?" every other
  // free-text tag entry point uses — so "espresso" resolves to the same
  // canonical tag here as it would typed into InterestField elsewhere.
  const match = useMemo(() => bestMatch(draft, known), [draft, known]);
  const exactExisting = match?.kind === "exact" ? match.label : undefined;
  const closeMatch = match && match.kind !== "exact" ? match : null;

  const addTag = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || atCap) return;
    if (alreadyAdded.has(normalize(trimmed))) {
      setDraft("");
      return;
    }
    // Converge on the existing spelling when this is an exact match under
    // normalization (case/accents/punctuation) — a fresh, only-differently-
    // cased tag would otherwise silently fork the same concept in two.
    const canonical = bestMatch(trimmed, known);
    const label = canonical?.kind === "exact" ? canonical.label : trimmed;
    onChange([...value, label].slice(0, max));
    setDraft("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div className="relative">
      <div
        className={`flex min-h-11 flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-surface px-3 py-2 transition-colors ${
          focused ? "border-[var(--coral-deep)]" : ""
        }`}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {!atCap && (
          <input
            id={id}
            value={draft}
            maxLength={40}
            autoComplete="off"
            onChange={(e) => {
              const v = e.target.value;
              // Comma commits a tag the same way Enter does, so a fast
              // "pottery, glazing" paste turns into two tags, not one.
              if (v.includes(",")) {
                const [head, ...rest] = v.split(",");
                addTag(head);
                setDraft(rest.join(","));
                return;
              }
              setDraft(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(draft);
              } else if (e.key === "Backspace" && !draft && value.length > 0) {
                removeTag(value[value.length - 1]);
              }
            }}
            onFocus={() => setFocused(true)}
            // A click on a suggestion has to land before the list closes.
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            placeholder={value.length === 0 ? placeholder : "Add another…"}
            className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        )}
      </div>

      {atCap && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Up to {max} tags per Moment — that's plenty to find by.
        </p>
      )}

      {!atCap && draft.trim() && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {exactExisting ? (
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
                onClick={() => addTag(closeMatch.label)}
                className="text-[var(--coral-text)] underline decoration-dotted underline-offset-2"
              >
                use that instead
              </button>
              , or press Enter to keep your own.
            </span>
          ) : (
            "New one. Press Enter to add it — it'll suggest itself to others after this."
          )}
        </p>
      )}

      {!atCap && !draft.trim() && value.length === 0 && !focused && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Anything you like, not listed? Type your own and press Enter.
        </p>
      )}

      {focused && !atCap && suggestions.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-56 overflow-y-auto rounded-2xl border border-border bg-popover py-1 shadow-xl">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(s)}
                className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
