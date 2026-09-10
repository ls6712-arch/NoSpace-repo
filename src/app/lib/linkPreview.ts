/**
 * The first http(s) URL in a piece of text, or none. Used to detect a link
 * as someone types or pastes it into a caption, so a preview can appear
 * without a separate "add a link" field to fill out on purpose.
 */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  if (!match) return null;
  // Trim trailing punctuation a sentence would leave attached ("...see this
  // pattern." shouldn't pull the period into the URL).
  return match[0].replace(/[.,!?;:'")\]]+$/, "");
}

/** A short, human label for the card — the domain, without "www.". */
export function urlDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
