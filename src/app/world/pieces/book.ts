import * as T from "three";
import type { PieceSpec } from "../layout";
import { at, box, mat } from "../core/kit";

/**
 * Books. One in progress lies open, with a ribbon marking the page. A finished one stands closed, spine out,
 * with two gilt bands.
 */
export const BOOK_COLORS = [0x7a3b3b, 0x2f4f6e, 0x3f5a4c, 0xc9a24a, 0x5b3f6b, 0xb5643f, 0x2b2b33, 0x8a9a6a, 0xd8cdb6, 0x6b4a35] as const;
export const PAPER = 0xf3ece0;

export function book(finished: boolean, cover: number): T.Group {
  const g = new T.Group();
  const cm = mat(cover, 0.7);
  if (!finished) {
    const paper = mat(PAPER, 0.9);
    for (const s of [-1, 1]) {
      const half = new T.Group();
      half.add(at(box(0.15, 0.008, 0.22, cm), s * 0.075, 0, 0), at(box(0.14, 0.018, 0.21, paper), s * 0.075, 0.012, 0));
      half.rotation.z = s * -0.12;
      g.add(at(half, 0, 0.03, 0));
    }
    g.add(at(box(0.012, 0.002, 0.12, mat(0xc0453a, 0.6)), 0.01, 0.05, 0.06));
    return g;
  }
  const gilt = mat(0xd9b34a, 0.4, 0.3);
  g.add(at(box(0.055, 0.3, 0.21, cm), 0, 0.15, 0), at(box(0.057, 0.015, 0.212, gilt), 0, 0.24, 0), at(box(0.057, 0.015, 0.212, gilt), 0, 0.06, 0));
  return g;
}

export const bookMaker = {
  // A standing book keeps its spine to the room, so it is not turned. An open one lies at a slight angle.
  make: (spec: PieceSpec, finished: boolean) => {
    const g = book(finished, BOOK_COLORS[spec.seed % BOOK_COLORS.length]);
    if (!finished) g.rotation.y = (spec.turn / (Math.PI * 2) - 0.5) * 0.5;
    return g;
  },
  height: (_spec: PieceSpec, finished: boolean) => (finished ? 0.3 : 0.07),
};
