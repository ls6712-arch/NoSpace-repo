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
