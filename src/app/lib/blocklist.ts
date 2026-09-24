/**
 * Word-token match against app_config's trademark_blocklist, mirroring
 * public.is_blocklisted_name() (20260924098000_spaces_rework_app_config.sql)
 * exactly — same rule, same reason: substring matching false-positived on
 * "leg of lamb" (-> "legoflamb"), "allegory", "legolas", and "bootleg
 * orchestra" all containing "lego" as a run of letters. A term matches only
 * when some token of the candidate equals it exactly, or its simple plural
 * (term + "s") — never when the term merely appears inside a longer word.
 *
 * Client-side only for UX (CornerTagField, Onboarding's MomentCard show a
 * friendly message before ever attempting a write the database would
 * reject anyway) — the CHECK constraint calling is_blocklisted_name() is
 * the actual enforcement boundary, reachable by any direct API call
 * regardless of what this function says.
 */
export function isBlocklistedName(candidate: string, blocklist: string[]): boolean {
  const fold = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const tokens = candidate
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return blocklist.some((rawTerm) => {
    const term = fold(rawTerm);
    if (!term) return false;
    return tokens.includes(term) || tokens.includes(term + "s");
  });
}
