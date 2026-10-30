/**
 * A sign-in code for an address with no account is refused by the server at
 * once, while one for a real account waits for the email to be handed over.
 * The screen must not show that difference, so a refusal is held back until
 * it has taken about as long as a real send usually does on this device
 * (the median of the last few, default one second). Best effort: it removes
 * what this page can show; whether an email actually arrives is not something
 * the page can hide.
 */
const KEY = "soosh.sendMs";
const KEEP = 5;
export const DEFAULT_SEND_MS = 1000;
const MIN_MS = 400;
const MAX_MS = 4000;

function read(): number[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number" && Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

/** Remembers how long a real send took. */
export function recordSendMs(ms: number): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...read(), ms].slice(-KEEP)));
  } catch {
    // Without it the default is used.
  }
}

/** How long a real send usually takes here, kept between 0.4 and 4 seconds. */
export function typicalSendMs(): number {
  const seen = [...read()].sort((a, b) => a - b);
  const median = seen.length ? seen[Math.floor(seen.length / 2)] : DEFAULT_SEND_MS;
  return Math.min(MAX_MS, Math.max(MIN_MS, median));
}

/** Waits out whatever is left of a typical send, counted from `startedAt`. */
export function waitForTypicalSend(startedAt: number): Promise<void> {
  const left = typicalSendMs() - (Date.now() - startedAt);
  return left > 0 ? new Promise((resolve) => setTimeout(resolve, left)) : Promise.resolve();
}
