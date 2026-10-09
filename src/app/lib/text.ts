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

/** The five product nouns are always capitalized (Moment, Shelf, Pursuit,
 * Corner, Space), but older notification bodies stored by the database say
 * "your moment". Fixes the casing when a stored body is shown. */
export function withProductNouns(text: string): string {
  return text.replace(/\b(moment|pursuit|corner|space|shelf)(s?)\b/g, (_m, noun: string, s: string) => {
    return noun.charAt(0).toUpperCase() + noun.slice(1) + s;
  });
}

/** Everything a stored notification body needs before it is shown. */
export function notificationText(body: string): string {
  return withProductNouns(withoutDashes(body));
}

/** What the bell shows for one stored notification. A save notification quotes
 * the Moment's caption, which is the author's own text, so it is shown exactly
 * as stored: no re-capitalized nouns, no stripped dashes. Everything else gets
 * notificationText. */
export function notificationBodyText(kind: string, body: string): string {
  return kind === "save" ? body : notificationText(body);
}

/** Full sentences end with a period. Empty-state lines and hints are written
 * without one at the call site; this adds it when the text doesn't already end
 * in punctuation. */
export function endSentence(text: string): string {
  const t = text.trim();
  return /[.!?…:]$/.test(t) ? t : `${t}.`;
}
