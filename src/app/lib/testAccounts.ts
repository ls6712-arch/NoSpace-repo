import { supabase } from "../../lib/supabase";

/**
 * Which of these accounts are test accounts (profiles.is_test, migration
 * 20261106000000). Public lists leave them out; nothing is deleted. A person
 * always sees their own account, test or not.
 *
 * Fails open: if the column isn't in this database yet, or the read fails, the
 * set is empty and nothing is hidden, so a missing migration never empties a
 * feed.
 */
export async function testAccountIds(ids: readonly string[], viewerId?: string | null): Promise<Set<string>> {
  const out = new Set<string>();
  const unique = [...new Set(ids)].filter((id) => id && id !== viewerId);
  if (!supabase || unique.length === 0) return out;
  try {
    const { data, error } = await supabase.from("profiles").select("id").eq("is_test", true).in("id", unique);
    if (error || !data) return out;
    for (const row of data as { id: string }[]) out.add(row.id);
  } catch {
    // Offline: show everything rather than nothing.
  }
  return out;
}

/** `items` without the ones whose account is a test account. */
export async function withoutTestAccounts<T>(
  items: readonly T[],
  accountId: (item: T) => string,
  viewerId?: string | null,
): Promise<T[]> {
  const hidden = await testAccountIds(items.map(accountId), viewerId);
  return hidden.size === 0 ? [...items] : items.filter((item) => !hidden.has(accountId(item)));
}
