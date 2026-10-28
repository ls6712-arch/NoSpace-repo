import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { cn } from "./utils";

export interface StackPerson {
  name: string;
  avatarUrl?: string | null;
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

/**
 * Up to 3 overlapping avatars with a 2px ring in the surface colour, then
 * "+N" for the rest. `total` is how many people there are when the list holds
 * only the first few. Shows people who are in a Pursuit or event, never a
 * member count of a Space.
 */
export function AvatarStack({
  people,
  total,
  size = "size-8",
  className,
}: {
  people: readonly StackPerson[];
  total?: number;
  size?: string;
  className?: string;
}) {
  const shown = people.slice(0, 3);
  const extra = Math.max(0, (total ?? people.length) - shown.length);
  const names = people.map((p) => p.name).join(", ");
  return (
    <span className={cn("inline-flex items-center", className)} role="img" aria-label={extra > 0 ? `${names} and ${extra} more` : names}>
      {shown.map((p, i) => (
        <Avatar key={`${p.name}-${i}`} className={cn(size, "ring-2 ring-[var(--card)]", i > 0 && "-ml-2")}>
          {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-caption">{initials(p.name)}</AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <span className="ml-1.5 text-small font-semibold text-muted-foreground" aria-hidden="true">
          +{extra}
        </span>
      )}
    </span>
  );
}
