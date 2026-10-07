/** First N words of some free text, with an ellipsis if it was trimmed —
 * used for a typographic thumbnail and a trail-dot tooltip alike. */
export function firstWords(text: string, n = 6): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "No caption";
  return words.slice(0, n).join(" ") + (words.length > n ? "…" : "");
}

/**
 * Copy that comes from the database (notification bodies, messages a SQL
 * function raises on purpose) can still contain em or en dashes, written
 * before the style rule banned them. Reads them as a sentence break (or "to"
 * between numbers) so no dash ever reaches the screen. Not applied to what
 * people write themselves.
 */
export function withoutDashes(text: string): string {
  return text
    .replace(/(\d)\s*–\s*(\d)/g, "$1 to $2")
    .replace(/\s+[—–]\s+(\S)/g, (_m, next: string) => `. ${next.toUpperCase()}`)
    .replace(/[—–]/g, ", ");
}
