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

/** Was an email send refused for asking too many times? */
export function isRateLimited(error: { status?: number; code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.status === 429 ||
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit" ||
    /rate limit|too many requests|only request this after/i.test(error.message ?? "")
  );
}

/**
 * How many seconds until the next code can be asked for, when Supabase says
 * ("…only request this after 52 seconds"). Null when it is not a limit, or when
 * it is one with no stated wait (the hourly cap): no time is ever guessed.
 */
export function retryAfterSeconds(error: { status?: number; code?: string; message?: string } | null | undefined): number | null {
  if (!isRateLimited(error)) return null;
  const given = AFTER_SECONDS.exec(error?.message ?? "")?.[1];
  return given ? Number(given) : null;
}
