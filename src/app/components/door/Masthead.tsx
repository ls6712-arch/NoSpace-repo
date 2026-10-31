import { APP_NAME } from "../../config";
import { formatDate, formatWeekday } from "../../lib/dates";
import { issueNumber } from "../../lib/doorList";

/**
 * The top of Discover's Door list: the issue line, the name set huge with a
 * full stop in the accent colour, and the strip under it (a 2px rule above,
 * a 1px rule at 40% below).
 */
export function Masthead() {
  const now = Date.now();
  return (
    <header className="mb-5 tab:mb-8">
      <p className="mb-1 flex items-center justify-between gap-4 text-small text-muted-foreground">
        <span>{`Issue ${issueNumber(now)} · ${formatWeekday(now)} ${formatDate(now)}`}</span>
      </p>
      <h1
        style={{ fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 0.9 }}
        className="text-display text-foreground"
      >
        {APP_NAME}
        <span className="text-[var(--accent)]">.</span>
      </h1>
      <div className="mt-3 flex items-center justify-between gap-4 border-b border-t-2 border-b-[color-mix(in_srgb,var(--foreground)_40%,transparent)] border-t-foreground py-2 text-small font-semibold">
        <span>Things to do tonight</span>
        <span>For members</span>
      </div>
    </header>
  );
}
