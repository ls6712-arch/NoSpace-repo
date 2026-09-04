import { Link } from "react-router";
import { SubHobbyArt } from "./SubHobbyArt";

/**
 * One hobby, as a picture. Used both inside a space (where it filters that
 * space's feed) and on Discover (where it links into the space, pre-filtered).
 * The illustration does the work — the label is confirmation, not the content.
 */
export function HobbyTile({
  hobbySlug,
  subSlug,
  label,
  active,
  onClick,
  to,
  count,
}: {
  hobbySlug: string;
  subSlug: string;
  label: string;
  active?: boolean;
  /** Makes the tile a filter button. Mutually exclusive with `to`. */
  onClick?: () => void;
  /** Makes the tile a link. Mutually exclusive with `onClick`. */
  to?: string;
  /** Number of posts, shown as a small badge when there are any. */
  count?: number;
}) {
  const inner = (
    <>
      <div className="relative overflow-hidden rounded-xl">
        <SubHobbyArt
          hobbySlug={hobbySlug}
          subSlug={subSlug}
          className="w-full h-auto aspect-square transition-transform duration-300 group-hover:scale-[1.06]"
        />
        {!!count && (
          <span className="absolute top-1.5 right-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] leading-none text-white backdrop-blur-sm">
            {count}
          </span>
        )}
      </div>
      <span
        className={`mt-2 block text-center text-xs leading-tight ${
          active ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </>
  );

  const className = `group block rounded-2xl border p-1.5 text-left transition-colors ${
    active
      ? "border-[#38BDF8] bg-white/[0.07]"
      : "border-white/10 hover:border-white/25 hover:bg-white/[0.04]"
  }`;

  if (to) {
    return (
      <Link to={to} className={className} aria-label={label}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} w-full`}
      aria-label={label}
      aria-pressed={active}
    >
      {inner}
    </button>
  );
}
