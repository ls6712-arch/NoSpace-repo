/** First N words of some free text, with an ellipsis if it was trimmed —
 * used for a typographic thumbnail and a trail-dot tooltip alike. */
export function firstWords(text: string, n = 6): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "No caption.";
  return words.slice(0, n).join(" ") + (words.length > n ? "…" : "");
}
