import { supabase } from "../../lib/supabase";
import { ProfileLink } from "./profileLinks";

/**
 * Same shape as pursuitsRemote.ts: the local copy (lib/profileLinks.ts) is
 * the source of truth for the owner's own view and works with or without an
 * account. This file exists for the one thing local storage can't do — let
 * a visitor, on their own device, see the links someone else added.
 * Best-effort throughout; a signed-out visitor, an unconfigured Supabase
 * project, or an unmigrated table all degrade to "no links to show."
 */

export async function mirrorProfileLinks(userId: string, links: ProfileLink[]) {
  if (!supabase) return;
  try {
    // Replace-all is simpler and safe here: link lists are short (a handful
    // of entries) and reordering/removal both need the same "what's current"
    // truth, so upserting a stale row that was since deleted would leave a
    // ghost link behind.
    await supabase.from("profile_links").delete().eq("user_id", userId);
    if (links.length === 0) return;
    await supabase.from("profile_links").insert(
      links.map((l, i) => ({
        id: l.id,
        user_id: userId,
        label: l.label,
        url: l.url,
        position: i,
        created_at: new Date(l.createdAt).toISOString(),
      })),
    );
  } catch {
    // Best effort — the owner's own local copy is unaffected.
  }
}

export async function fetchProfileLinks(userId: string): Promise<ProfileLink[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("profile_links")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true });
    if (error || !data) return [];
    return data.map((row: any) => ({
      id: row.id,
      label: row.label,
      url: row.url,
      createdAt: new Date(row.created_at).getTime(),
    }));
  } catch {
    return [];
  }
}
