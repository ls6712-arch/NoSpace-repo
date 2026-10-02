import type { ComponentProps } from "react";
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatWeekday,
  formatWhen,
  type DateInput,
} from "../../lib/dates";

type Format = "when" | "date" | "datetime" | "time" | "weekday";

/**
 * A date as text, through the app's one formatter (lib/dates.ts), in a
 * <time> element: tabular figures so lists line up, a machine-readable
 * dateTime, and the full date and time on hover.
 *
 *   <Time value={post.createdAt} />                      → "3d" / "Sep 24"
 *   <Time value={t.createdAt} ago />                     → "3d ago"
 *   <Time value={e.starts_at} format="datetime" timeZone={e.timezone} />
 */
export function Time({
  value,
  format = "when",
  ago,
  timeZone,
  className = "",
  ...rest
}: {
  value: DateInput;
  format?: Format;
  ago?: boolean;
  timeZone?: string;
} & Omit<ComponentProps<"time">, "children" | "dateTime">) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const text =
    format === "when"
      ? formatWhen(d, { ago })
      : format === "date"
        ? formatDate(d, { timeZone })
        : format === "datetime"
          ? formatDateTime(d, { timeZone })
          : format === "time"
            ? formatTime(d, timeZone)
            : formatWeekday(d, "short", timeZone);
  return (
    <time
      dateTime={d.toISOString()}
      title={formatDateTime(d, { timeZone, weekday: true })}
      className={`tabular-nums ${className}`.trim()}
      {...rest}
    >
      {text}
    </time>
  );
}
