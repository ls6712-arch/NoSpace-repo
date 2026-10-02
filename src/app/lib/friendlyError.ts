import { ERROR_LINE, OFFLINE_LINE, UPLOAD_COPY } from "./stateCopy";

/**
 * Turns whatever a failed call handed back (a Supabase PostgrestError, a
 * StorageError, a thrown Error, a string) into one plain sentence for a
 * person to read. Raw database text never reaches the screen: anything
 * this doesn't recognise becomes the one shared error line. The original
 * error should still go to console.warn at the call site for debugging.
 *
 * The one exception: messages our own SQL functions raise on purpose
 * (`raise exception 'This Space is full.'`, sqlstate P0001) are already
 * written for people, so they pass through, unless they read as
 * technical (an identifier, a placeholder, brackets).
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
  const authored = authoredMessage(err);
  if (authored) return authored;
  // Kept for whoever's debugging: the person sees the plain line, the
  // console keeps the real error.
  if (err && import.meta.env?.MODE !== "test") console.warn("[friendlyError] hid:", err);
  return fallback;
}

function authoredMessage(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code !== "P0001" || typeof e.message !== "string") return null;
  const msg = e.message.trim();
  if (!msg || msg.length > 160) return null;
  if (/[_%(){}[\]<>]|\b(null|uuid|sqlstate|function|relation|column)\b/i.test(msg)) return null;
  return msg;
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
