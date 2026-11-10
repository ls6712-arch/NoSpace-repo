import * as T from "three";
import type { PieceSpec } from "../layout";
import { PI, at, box, canvasTex, css, cyl, mat, sph } from "../core/kit";

/**
 * Games. One in progress is an open box: the board out, three pawns on it, the lid propped behind. A finished
 * one is the box closed and standing on the shelf.
 */
export const GAME_COLORS = [0xc0453a, 0x2f6e8f, 0xe2b24a, 0x3f7a5a, 0x6b4a8a, 0xe07a4a, 0x2b3a5a, 0xd8c29a] as const;

/** A green and cream checkered board. */
export function checkerTexture(): T.CanvasTexture {
  return canvasTex(256, 256, (g, w, h) => {
    const n = 8;
    const s = w / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.fillStyle = css((i + j) % 2 ? 0x2f4a3e : 0xefe2c8);
        g.fillRect(i * s, j * s, s, s);
      }
    g.strokeStyle = css(0x3a2a22);
    g.lineWidth = 8;
    g.strokeRect(0, 0, w, h);
  });
}

export function game(finished: boolean, color: number): T.Group {
  const g = new T.Group();
  const cm = mat(color, 0.6);
  if (!finished) {
    g.add(at(box(0.3, 0.05, 0.3, cm), 0, 0.025, 0));
    const board = new T.Mesh(new T.PlaneGeometry(0.26, 0.26), new T.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.8 }));
    board.rotation.x = -PI / 2;
    board.receiveShadow = true;
    g.add(at(board, 0, 0.052, 0));
    for (const [c, x, z] of [[0xe2b24a, 0.06, 0.04], [0xc0453a, -0.05, -0.06], [0x2f6e8f, -0.02, 0.07]]) {
      const pm = mat(c, 0.5);
      g.add(at(cyl(0.012, 0.016, 0.03, pm, 10), x, 0.067, z), at(sph(0.012, pm, 8, 6), x, 0.088, z));
    }
    const lid = box(0.3, 0.3, 0.02, cm);
    lid.rotation.x = -0.25;
    g.add(at(lid, 0, 0.15, -0.17));
    return g;
  }
  g.add(at(box(0.1, 0.34, 0.3, cm), 0, 0.17, 0), at(box(0.102, 0.08, 0.302, mat(0xefe2c8, 0.7)), 0, 0.22, 0));
  return g;
}

export const gameMaker = {
  // Boxes face the room squarely, open or closed.
  make: (spec: PieceSpec, finished: boolean) => game(finished, GAME_COLORS[spec.seed % GAME_COLORS.length]),
  height: (_spec: PieceSpec, finished: boolean) => (finished ? 0.34 : 0.3),
};
