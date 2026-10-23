import { APP_NAME } from "../../config";
import { formatDate, formatWeekday } from "../../lib/dates";
import { displayStyle, issueNumber } from "../../lib/doorList";

/**
 * The top of Discover's Door list: the issue line, the name set huge with a
 * full stop in the accent colour, and the strip under it (a 2px rule above,
 * a 1px rule at 40% below).
 */
export function Masthead() {
  const now = Date.now();
  return (
    <header className="mb-8 md:mb-10">
      <p className="mb-2 flex items-center justify-between gap-4 text-caption text-muted-foreground">
        <span>{`Issue ${issueNumber(now)} · ${formatWeekday(now)} ${formatDate(now)}`}</span>
      </p>
      <h1
        style={displayStyle(140, { fontSize: "clamp(88px, 28vw, 140px)", letterSpacing: "-0.05em", lineHeight: 0.82 })}
        className="text-foreground"
      >
        {APP_NAME}
        <span className="text-[var(--accent)]">.</span>
      </h1>
      <div className="mt-4 flex items-center justify-between gap-4 border-b border-t-2 border-b-[color-mix(in_srgb,var(--foreground)_40%,transparent)] border-t-foreground py-2 text-caption font-semibold">
        <span>Things to do tonight</span>
        <span>For members</span>
      </div>
    </header>
  );
}
