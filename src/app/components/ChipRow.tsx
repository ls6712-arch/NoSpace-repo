/**
 * A labelled row of choice chips: tap one to pick it, tap it again to clear.
 * The chip look is Discover's mood grid (MoodGrid): the foreground colour
 * fills the chosen chip, an unchosen one is the surface colour with a border.
 * Chips wrap onto the next line on a phone.
 */
export function ChipRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: T; label: string }[];
  value: T | null;
  onChange: (next: T | null) => void;
}) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-small font-semibold text-foreground">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.id === value;
          return (
            <li key={String(o.id)}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? null : o.id)}
                className={`h-11 rounded-control border px-4 text-small font-semibold transition-colors duration-fast ${
                  on ? "border-foreground bg-foreground text-background" : "border-border bg-surface text-foreground"
                }`}
              >
                {o.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
