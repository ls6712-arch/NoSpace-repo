/**
 * Does this account have a password? Supabase does not say: an account made
 * with an emailed code has the same email identity as one made with a password.
 * So `has_password` is kept in the account's metadata: set when a password is
 * added (the sign-up offer, Settings), and filled in once for every account that
 * already had one by migration 20261104000000.
 */
export function hasPassword(user: { user_metadata?: Record<string, unknown> | null } | null | undefined): boolean {
  return user?.user_metadata?.has_password === true;
}
