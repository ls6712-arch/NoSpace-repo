/**
 * Pure helpers over profile_settings.notification_preferences (jsonb) —
 * kept framework- and Supabase-free so the "other keys survive a write"
 * property is directly testable (see notificationPreferences.test.ts)
 * rather than only exercisable through SettingsContext's own network
 * calls. Every writer here returns a NEW full object built by spreading
 * the one passed in — the caller (SettingsContext) always upserts the
 * whole thing back, since a plain jsonb upsert replaces the column
 * wholesale rather than merging it.
 */

export type NotificationPreferences = Record<string, unknown>;

/** Reads the muted-category array, tolerating anything a client didn't
 * write (missing key, wrong type, non-string entries) rather than
 * throwing — same "absence means default" rule the database's own
 * private.notification_kind_muted() uses for a missing settings row. */
export function mutedCategories(prefs: NotificationPreferences): string[] {
  const raw = prefs.muted;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

export function isCategoryMuted(prefs: NotificationPreferences, category: string): boolean {
  return mutedCategories(prefs).includes(category);
}

/** Adds or removes exactly one category from `muted`, leaving every other
 * key (the email keys — weekly_digest, product_news, replies_to_my_moments)
 * untouched. */
export function withMutedCategory(
  prefs: NotificationPreferences,
  category: string,
  muted: boolean,
): NotificationPreferences {
  const current = mutedCategories(prefs);
  const next = muted ? [...new Set([...current, category])] : current.filter((c) => c !== category);
  return { ...prefs, muted: next };
}
