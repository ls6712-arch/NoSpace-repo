import { ERROR_LINE, OFFLINE_LINE, UPLOAD_COPY } from "./stateCopy";

/**
 * Turns whatever a failed call handed back (a Supabase PostgrestError, a
 * StorageError, a thrown Error, a string) into one plain sentence for a
 * person to read. Raw database text never reaches the screen: anything
 * this doesn't recognise becomes the one shared error line. The original
 * error should still go to console.warn at the call site for debugging.
 */
export function friendlyError(err: unknown, fallback: string = ERROR_LINE): string {
  const text = errorText(err).toLowerCase();
  const status = errorStatus(err);

  if (typeof navigator !== "undefined" && navigator.onLine === false) return OFFLINE_LINE;
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/.test(text)) {
    return OFFLINE_LINE;
  }
  if (status === 413 || /payload too large|maximum allowed size|exceeded the maximum/.test(text)) {
    return UPLOAD_COPY.tooBig();
  }
  if (status === 415 || /mime type|invalid_mime|not supported/.test(text)) {
    return UPLOAD_COPY.wrongType;
  }
  return fallback;
}

function errorText(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const e = err as { message?: unknown; error?: unknown; details?: unknown };
    return [e.message, e.error, e.details].filter((x) => typeof x === "string").join(" ");
  }
  return String(err);
}

function errorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as { status?: unknown; statusCode?: unknown };
  const raw = e.status ?? e.statusCode;
  const n = typeof raw === "string" ? Number(raw) : raw;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}
