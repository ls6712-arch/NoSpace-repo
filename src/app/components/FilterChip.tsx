import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const ANY = "__any";

/**
 * A filter as a pill that opens its options. Unchosen it reads as its own
 * "any" label ("Any time"); chosen it shows the option and fills with the
 * accent. Pick the "any" row, or use the page's Clear link, to unset it.
 */
export function FilterChip<T extends string | number>({
  anyLabel,
  options,
  value,
  onChange,
}: {
  anyLabel: string;
  options: readonly { id: T; label: string }[];
  value: T | null;
  onChange: (next: T | null) => void;
}) {
  const chosen = value !== null;
  return (
    <Select
      value={chosen ? String(value) : ANY}
      onValueChange={(v) => onChange(v === ANY ? null : (options.find((o) => String(o.id) === v)?.id ?? null))}
    >
      <SelectTrigger
        aria-label={anyLabel}
        className={`h-11 w-auto shrink-0 rounded-full px-3.5 font-semibold ${
          chosen
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)] [&_svg]:text-[var(--accent-foreground)]"
            : "border-border bg-surface text-foreground"
        }`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{anyLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={String(o.id)} value={String(o.id)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
