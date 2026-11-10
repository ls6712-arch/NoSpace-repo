/**
 * Corner worlds: the part with no 3D in it. Which real Moments become which
 * pieces, where they sit, and which pairs get a thread. Everything here is
 * plain data so it can be tested without a canvas.
 *
 * Only real Moments come through here. The animated characters are built by
 * the scene itself and never enter these lists, so they cannot be counted,
 * shown on a wall, or joined by a thread.
 */

/** A small seeded random number generator (mulberry32): the same seed always gives the same run. */
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const POT_SHAPES = ["bowl", "vase", "jar", "cup", "bottle"] as const;
export type PotShape = (typeof POT_SHAPES)[number];

/** Glaze colours a finished piece can take. */
export const GLAZES = [0x8fb8a8, 0x2f4f86, 0x3b2418, 0xe9d2b5, 0xb8b29b, 0x7d3b24, 0xefe6d6, 0x5d7f6c, 0xc98a64, 0x1f3b4d, 0xd9c27a] as const;

export interface PieceSpec {
  shape: PotShape;
  /** Glaze colour. Used only when the piece is finished. */
  glaze: number;
  /** 0.85 to 1.1. */
  scale: number;
  /** Turn on the shelf, radians. */
  turn: number;
  /** Seed for the glaze drip line. */
  seed: number;
}

/** The look of a Moment's piece. It depends on the Moment's id only, so the same Moment always looks the same. */
export function pieceSpec(postId: number): PieceSpec {
  const r = rng(Math.imul(postId | 0, 2654435761) ^ 0x9e3779b9);
  return {
    shape: POT_SHAPES[Math.floor(r() * POT_SHAPES.length)],
    glaze: GLAZES[Math.floor(r() * GLAZES.length)],
    scale: 0.85 + r() * 0.25,
    turn: r() * Math.PI * 2,
    seed: Math.floor(r() * 1e9),
  };
}

/** How many pieces each part of the room holds. The panel lists every Moment; the room shows the newest. */
export const ROOM_LIMITS = { rack: 8, shelf: 10, yours: 5 } as const;

export type Spot = "rack" | "shelf" | "yours";

/** What the room needs to know about one Moment. */
export interface RoomMoment {
  postId: number;
  pursuitId?: string;
  mine: boolean;
  /** The Moment this one's Pursuit started because of, when the viewer may see it. */
  inspiredByPostId?: number;
}

export interface Placement {
  postId: number;
  spot: Spot;
  /** Index within the spot, 0 first. */
  slot: number;
  /** Finished pieces are glazed, pieces in progress are bare clay. */
  glazed: boolean;
}

export interface RoomPlan {
  placements: Placement[];
  /** Pairs of Moment ids joined by a thread: [source, the one it started]. Both are always in `placements`. */
  threads: [number, number][];
}

/**
 * Lays the room out.
 *   making: the Still making wall, newest first. Goes on the drying rack.
 *   made: the Made it wall, newest first. Goes on the shelves.
 *   mine: the viewer's own Moments in the Corner (any audience), newest first, one per Pursuit.
 *     A finished one sits on Your shelf; one in progress dries on the rack with everyone else's.
 *   chains: Passed along, each a list of Pursuit ids from the source on.
 * A thread joins two pieces only when both are in the room, so a source the viewer cannot see never gets one.
 */
export function planRoom(input: {
  making: readonly RoomMoment[];
  made: readonly RoomMoment[];
  mine: readonly (RoomMoment & { finished: boolean })[];
  chains?: readonly (readonly string[])[];
}): RoomPlan {
  const placements: Placement[] = [];
  const placed = new Map<number, RoomMoment>();
  const put = (m: RoomMoment, spot: Spot, glazed: boolean) => {
    if (placed.has(m.postId)) return;
    const slot = placements.filter((p) => p.spot === spot).length;
    if (slot >= ROOM_LIMITS[spot]) return;
    placements.push({ postId: m.postId, spot, slot, glazed });
    placed.set(m.postId, m);
  };

  // The viewer's own first, so a private piece of theirs is never crowded out.
  const minePursuits = new Set<string>();
  for (const m of input.mine) {
    if (m.pursuitId) minePursuits.add(m.pursuitId);
    if (m.finished) put(m, "yours", true);
    else put(m, "rack", false);
  }
  const notMineAgain = (m: RoomMoment) => !(m.mine && ((m.pursuitId && minePursuits.has(m.pursuitId)) || placed.has(m.postId)));
  for (const m of input.making) if (notMineAgain(m)) put(m, "rack", false);
  for (const m of input.made) if (notMineAgain(m)) put(m, m.mine ? "yours" : "shelf", true);

  const byPursuit = new Map<string, number>();
  for (const m of placed.values()) if (m.pursuitId && !byPursuit.has(m.pursuitId)) byPursuit.set(m.pursuitId, m.postId);

  const threads: [number, number][] = [];
  const seen = new Set<string>();
  const join = (from: number | undefined, to: number | undefined) => {
    if (from == null || to == null || from === to) return;
    if (!placed.has(from) || !placed.has(to)) return;
    const key = `${from}>${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    threads.push([from, to]);
  };
  for (const m of placed.values()) join(m.inspiredByPostId, m.postId);
  for (const chain of input.chains ?? []) {
    for (let i = 1; i < chain.length; i++) join(byPursuit.get(chain[i - 1]), byPursuit.get(chain[i]));
  }
  return { placements, threads };
}

/** Which mood "My clock" means at this hour of the viewer's day. */
export function moodForHour(hour: number): "morning" | "golden" | "night" {
  if (hour >= 6 && hour < 16) return "morning";
  if (hour >= 16 && hour < 20) return "golden";
  return "night";
}
