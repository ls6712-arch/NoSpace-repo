import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import { cornerGuide } from "../data/cornerGuides";
import { CORNER_PREP } from "../data/cornerPrep";
import { hobbyPhoto } from "../data/hobbyPhotos";
import { cleanPicks, pickKey } from "./tasteRemote";
import { cornerName, doableAtHome } from "./homeItems";
import { startPath } from "./startContent";

/**
 * Stay in, from what Soosh already has (hotfix, Nov 3, 2026). Until the stay-in PRs land, a Stay in
 * ask never goes to the web search, which drops every event and so can come back with nothing. It
 * is answered here instead, with no ask used, from two sources only:
 *
 *   1. the person's own Pursuits that are going, each with its next step: their own note for the
 *      next session (pursuit_plans), else the first step of the Pursuit's Corner guide;
 *   2. the Corners they picked that can be done at home (the Corner guide's step, cornerGuides.ts;
 *      what you'll need, cornerPrep.ts), never outdoors, with other people or adults only.
 *
 * Each card has its Corner's photo. Nothing found: the caller shows the honest empty state.
 */

type Client = SupabaseClient | null;

export interface StayInCard {
  /** "pursuit:{id}" or "corner:{key}". */
  id: string;
  kind: "pursuit" | "corner";
  title: string;
  /** The next step: the person's own note, or the Corner guide's first step. */
  step: string | null;
  /** At most 3, from the Corner's "What you'll need". */
  needs: string[];
  photo: string | null;
  /** Where the card opens: the Pursuit page, or the Corner's Start page. */
  to: string;
}

export interface StayInPursuit {
  id: string;
  title: string;
  /** The Pursuit's Corner, as hobby_slug and sub_hobby. */
  spaceSlug: string | null;
  cornerSlug: string | null;
  /** The person's own note for the next session, if they wrote one. */
  note: string | null;
}

/** Cards from the person's going Pursuits, then their picked Corners that work at home. Pure. */
export function stayInCards(input: { pursuits: readonly StayInPursuit[]; picks: readonly string[]; most?: number }): StayInCard[] {
  const most = input.most ?? 5;
  const out: StayInCard[] = [];
  const cornersUsed = new Set<string>();

  for (const p of input.pursuits) {
    const title = p.title.trim();
    if (!title) continue;
    const key = p.spaceSlug && p.cornerSlug ? pickKey(p.spaceSlug, p.cornerSlug) : null;
    const [space, slug] = key ? key.split("/") : [null, null];
    const guide = space && slug ? cornerGuide(space, slug) : undefined;
    const note = p.note?.trim() || null;
    if (key) cornersUsed.add(key);
    out.push({
      id: `pursuit:${p.id}`,
      kind: "pursuit",
      title: title.slice(0, 80),
      step: note ? note.slice(0, 140) : (guide?.step ?? null),
      needs: [],
      photo: slug ? (hobbyPhoto(slug, space ?? undefined) ?? null) : null,
      to: `/pursuit/${encodeURIComponent(p.id)}`,
    });
  }

  for (const raw of input.picks) {
    const [s, c] = raw.split("/");
    if (!s || !c) continue;
    const key = pickKey(s, c);
    if (cornersUsed.has(key) || !doableAtHome(key)) continue;
    cornersUsed.add(key);
    const [space, slug] = key.split("/") as [string, string];
    out.push({
      id: `corner:${key}`,
      kind: "corner",
      title: `${cornerName(key)} at home`,
      step: cornerGuide(space, slug)?.step ?? null,
      needs: (CORNER_PREP[key]?.needs ?? []).slice(0, 3),
      photo: hobbyPhoto(slug, space) ?? null,
      to: startPath(space, slug),
    });
  }
  return out.slice(0, most);
}

/** Typed words that mean staying in (the same words the function reads, intent.ts STAY_IN). */
const STAY_IN = /\b(stay in|staying in|stay home|at home|from home|night in|indoors|on the couch|on the sofa)\b/i;
const HEAD_OUT = /\b(head out|heading out|go out|going out|get out|out of the house|out and about|outdoors|outside|night out|out (tonight|today|tomorrow|this weekend))\b/i;

/** The ask without its stay-in words, for heading out instead (the function would read them as stay in). */
export function withoutStayIn(text: string): string {
  return text.replace(new RegExp(STAY_IN.source, "gi"), " ").replace(/\s+/g, " ").replace(/^[\s,.]+|[\s,.]+$/g, "");
}

/** True when the ask itself says stay in (and doesn't also say head out). */
export function saysStayIn(text: string): boolean {
  return STAY_IN.test(text) && !HEAD_OUT.test(text);
}

/**
 * Reads the person's own going Pursuits, their plans and their picked Corners, as them (each table
 * keeps it to their own rows), and builds the cards. Best effort: a failed read is an empty list,
 * never an error, so the empty state shows.
 */
export async function fetchStayIn(userId: string | null | undefined, client: Client = supabase): Promise<StayInCard[]> {
  if (!client || !userId) return [];
  try {
    const [pursuits, plans, priv] = await Promise.all([
      client
        .from("pursuits")
        .select("id, title, hobby_slug, sub_hobby")
        .eq("user_id", userId)
        .is("finished_at", null)
        .is("paused_at", null)
        .is("let_go_at", null)
        .is("archived_at", null)
        .eq("is_plan", false)
        .order("updated_at", { ascending: false })
        .limit(10),
      client.from("pursuit_plans").select("pursuit_id, next_session_note").eq("user_id", userId).limit(50),
      client.from("profile_private").select("picks").eq("user_id", userId).maybeSingle(),
    ]);
    const notes = new Map<string, string>();
    for (const r of (plans.data ?? []) as { pursuit_id: string; next_session_note: string | null }[]) {
      if (r.next_session_note) notes.set(r.pursuit_id, r.next_session_note);
    }
    const rows = (pursuits.error ? [] : (pursuits.data ?? [])) as { id: string; title: string; hobby_slug: string | null; sub_hobby: string | null }[];
    return stayInCards({
      pursuits: rows.map((r) => ({ id: r.id, title: r.title ?? "", spaceSlug: r.hobby_slug, cornerSlug: r.sub_hobby, note: notes.get(r.id) ?? null })),
      picks: priv.error ? [] : cleanPicks((priv.data as { picks?: unknown } | null)?.picks),
    });
  } catch {
    return [];
  }
}
