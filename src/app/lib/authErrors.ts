/**
 * Did Supabase refuse a sign-in code because there is no account for that
 * email? Asked with `shouldCreateUser: false`, GoTrue answers an unknown
 * address with a 4xx "Signups not allowed for otp" (error_code `otp_disabled`
 * or `signup_disabled` depending on the version). Matched on both the code and
 * the message so a wording change on their side does not turn into a created account.
 */
export function isNoAccountError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code && ["otp_disabled", "signup_disabled", "user_not_found"].includes(error.code)) return true;
  return /signups? not allowed|user not found|no user (found|with)/i.test(error.message ?? "");
}

/** The wait Supabase's own message gives ("you can only request this after 52 seconds"), when it gives one. */
const AFTER_SECONDS = /after (\d+) seconds?/i;
/** When no wait is given (an hourly limit), the per-address interval is the best guess. */
export const DEFAULT_RETRY_SECONDS = 60;

/**
 * If an email send was refused for sending too many, how many seconds until it
 * can be asked for again; null when it was refused for any other reason.
 */
export function retryAfterSeconds(error: { status?: number; code?: string; message?: string } | null | undefined): number | null {
  if (!error) return null;
  const limited = error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit" || /rate limit|too many requests|only request this after/i.test(error.message ?? "");
  if (!limited) return null;
  const given = AFTER_SECONDS.exec(error.message ?? "")?.[1];
  return given ? Number(given) : DEFAULT_RETRY_SECONDS;
}
