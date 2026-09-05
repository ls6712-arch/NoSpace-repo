import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { hobbies } from "../data/hobbies";
import { useContent } from "../context/ContentContext";
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
  const { posts } = useContent();
  const [focused, setFocused] = useState(false);

  // Everything anyone has used, plus the app's own sub-hobby names as a
  // starting vocabulary so the field isn't empty on day one.
  const known = useMemo(() => {
    const seen = new Map<string, string>();
    const add = (raw?: string) => {
      const label = raw?.trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, label);
    };
    for (const post of posts) add(post.interest);
    for (const hobby of hobbies) for (const sub of hobby.subItems) add(sub.label);
    return [...seen.values()];
  }, [posts]);

  const query = value.trim().toLowerCase();
  const suggestions = useMemo(() => {
    const pool = query
      ? known.filter((k) => k.toLowerCase().includes(query) && k.toLowerCase() !== query)
      : known;
    return pool.slice(0, 8);
  }, [known, query]);

  const exact = known.find((k) => k.toLowerCase() === query);

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

      {value.trim() && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {exact ? (
            <span className="flex items-center gap-1">
              <Check className="size-3 text-[var(--forest)]" />
              Others use this too — your post joins theirs.
            </span>
          ) : (
            "New one. It'll show up as a suggestion for everyone after this."
          )}
        </p>
      )}

      {focused && suggestions.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-52 overflow-y-auto rounded-2xl border border-border bg-popover py-1 shadow-xl">
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
        </ul>
      )}
    </div>
  );
}
