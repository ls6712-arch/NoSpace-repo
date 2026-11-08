import { supabase } from "../../lib/supabase";
import { signMomentPaths } from "./momentMedia";
import type { Post } from "../data/posts";

/**
 * Corner walls (brief of Nov 7, 2026). The two read-only RPCs
 * (supabase/migrations/20261123000000_corner_walls.sql) and the small pure
 * helpers the page uses to turn their rows into lines of copy. No counts: the
 * RPCs return names, never numbers, and nothing here adds one.
 */

export type WallKind = "making" | "made";

/** Cards on a wall before "Show more". */
export const WALL_PAGE = 4;

export interface WallRow {
  wall: WallKind;
  post_id: number;
  author_id: string;
  author_first_name: string;
  author_avatar_url: string | null;
  is_mine: boolean;
  pursuit_id: string | null;
  pursuit_title: string | null;
  media_type: string | null;
  media_url: string | null;
  media_urls: string[] | null;
  media_paths: string[] | null;
  caption: string | null;
  posted_at: string;
  finished_at: string | null;
  has_finisher_stub: boolean;
  inspired_by_post_id: number | null;
  inspired_by_first_name: string | null;
  started_because: string[] | null;
}

export interface WallCard {
  postId: number;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string;
  mine: boolean;
  pursuitId?: string;
  pursuitTitle?: string;
  mediaType: string;
  /** A photo the viewer may load (signed when the Moment lives in private storage), if the Moment has one. */
  photo?: string;
  caption: string;
  /** When the Moment was shared, ms. */
  postedAt: number;
  /** When the Pursuit was finished, ms. Set on Made it cards only. */
  finishedAt?: number;
  finisherStub: boolean;
  /** The Moment this card's Pursuit started because of, and its maker's first name. Both set or both absent. */
  inspiredByPostId?: number;
  inspiredByName?: string;
  /** First names of people who started a Pursuit because of this one, newest first, at most 3. */
  startedBecause: string[];
}

const nameOf = (n: string | null | undefined) => (n ?? "").trim() || "Someone";

/** The ms a wall pages on: when the Moment was shared (Still making) or the Pursuit was finished (Made it). */
export const sortAt = (c: WallCard): number => c.finishedAt ?? c.postedAt;

/** Turns RPC rows into cards. `signed` maps a private storage path to a URL the viewer may load. */
export function cardsFromRows(rows: readonly WallRow[], signed: ReadonlyMap<string, string> = new Map()): WallCard[] {
  return rows.map((r) => {
    const fromPath = (r.media_paths ?? []).map((p) => signed.get(p)).find(Boolean);
    const legacy = r.media_urls?.[0] || r.media_url || undefined;
    const showsPhoto = (r.media_type ?? "photo") === "photo";
    return {
      postId: r.post_id,
      authorId: r.author_id,
      authorName: nameOf(r.author_first_name),
      authorAvatarUrl: r.author_avatar_url ?? undefined,
      mine: r.is_mine,
      pursuitId: r.pursuit_id ?? undefined,
      pursuitTitle: r.pursuit_title?.trim() || undefined,
      mediaType: r.media_type ?? "photo",
      photo: showsPhoto ? fromPath || legacy : undefined,
      caption: (r.caption ?? "").trim(),
      postedAt: new Date(r.posted_at).getTime(),
      finishedAt: r.finished_at ? new Date(r.finished_at).getTime() : undefined,
      finisherStub: r.has_finisher_stub,
      inspiredByPostId: r.inspired_by_post_id ?? undefined,
      inspiredByName: r.inspired_by_post_id != null ? nameOf(r.inspired_by_first_name) : undefined,
      startedBecause: (r.started_because ?? []).map((n) => nameOf(n)).slice(0, 3),
    };
  });
}

/**
 * "A started because of this", "A and B started because of this",
 * "A, B and others started because of this". Never a number. Empty when
 * nobody did.
 */
export function startedBecauseLine(names: readonly string[]): string {
  const n = names.map((x) => x.slice(0, 60));
  if (n.length === 0) return "";
  if (n.length === 1) return `${n[0]} started because of this`;
  if (n.length === 2) return `${n[0]} and ${n[1]} started because of this`;
  return `${n[0]}, ${n[1]} and others started because of this`;
}

/** "Started because of Maya", or "" when the viewer may not see the source Moment. */
export function startedBecauseOfLine(card: Pick<WallCard, "inspiredByName">): string {
  return card.inspiredByName ? `Started because of ${card.inspiredByName.slice(0, 60)}` : "";
}

export async function fetchWall(corner: string, wall: WallKind, opts: { before?: number; limit?: number } = {}): Promise<WallCard[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("corner_wall", {
    p_corner: corner,
    p_wall: wall,
    p_before: opts.before != null ? new Date(opts.before).toISOString() : null,
    p_limit: opts.limit ?? WALL_PAGE + 1,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as WallRow[];
  const signed = await signMomentPaths(rows.flatMap((r) => r.media_paths ?? []));
  return cardsFromRows(rows, signed);
}

export interface PassedRow {
  chain_no: number;
  pos: number;
  author_id: string;
  author_first_name: string;
  pursuit_id: string;
  pursuit_title: string | null;
  last_post_id: number;
}

export interface Chain {
  /** The people in order: the source first. */
  links: { authorId: string; name: string; pursuitId: string; lastPostId: number }[];
  /** The chip texts, same order: "Maya’s Jacket", then first names. */
  chips: string[];
  /** The newest Moment in the chain, which "You?" starts from. */
  lastPostId: number;
  /** Whether the viewer is one of the people in it (then "You?" is not offered). */
  mine: boolean;
}

/**
 * A Pursuit title for the source chip: 24 characters at most, cut at a word boundary with "…", never
 * mid-word. The RPC already cuts at 24, so a title of 24 characters may be a longer one cut short; it is
 * treated as one. (A single word longer than the chip has to be cut where it is.)
 */
export function clipTitle(title: string, max = 24): string {
  const t = title.trim().replace(/\s+/g, " ");
  if (t.length < max) return t;
  const room = t.slice(0, max - 1);
  const cut = room.lastIndexOf(" ");
  const base = (cut > 0 ? room.slice(0, cut) : room).replace(/[\s,;:.\-]+$/, "");
  return `${base}…`;
}

/** Groups the RPC rows into chains, in chain_no and pos order, with the chips each shows. */
export function chainsFromRows(rows: readonly PassedRow[], meId?: string): Chain[] {
  const byChain = new Map<number, PassedRow[]>();
  for (const r of rows) byChain.set(r.chain_no, [...(byChain.get(r.chain_no) ?? []), r]);
  return [...byChain.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, list]) => {
      const sorted = [...list].sort((a, b) => a.pos - b.pos);
      if (sorted.length < 2) return [];
      const links = sorted.map((r) => ({ authorId: r.author_id, name: nameOf(r.author_first_name), pursuitId: r.pursuit_id, lastPostId: r.last_post_id }));
      const chips = sorted.map((r, i) => {
        const name = nameOf(r.author_first_name).slice(0, 60);
        const title = clipTitle(r.pursuit_title ?? "");
        return i === 0 ? (title ? `${name}’s ${title}` : name) : name;
      });
      return [{ links, chips, lastPostId: links[links.length - 1].lastPostId, mine: !!meId && links.some((l) => l.authorId === meId) }];
    });
}

export async function fetchPassedAlong(corner: string, meId?: string): Promise<Chain[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("corner_passed_along", { p_corner: corner, p_limit: 3 });
  if (error) throw new Error(error.message);
  return chainsFromRows((data ?? []) as PassedRow[], meId);
}

/**
 * The Moment "Make your version" starts from, built from a wall card: enough for
 * PursuitDialog to pre-fill the title (the first sentence of the caption) and
 * to record the Moment as the one the new Pursuit started because of.
 */
export function seedFromCard(card: WallCard, corner: { spaceSlug: string; slug: string }): Post {
  return {
    id: card.postId,
    hobbySlug: corner.spaceSlug,
    subHobby: corner.slug,
    corner: corner.slug,
    type: "written",
    media: card.photo ?? "",
    creator: card.authorName,
    caption: card.caption,
    likes: 0,
    createdAt: card.postedAt,
    visibility: "public",
    userId: card.authorId,
  };
}
