import * as T from "three";
import { rng, type Spot } from "../layout";
import type { PieceKind } from "../config";
import { PI, at, box, canvasTex, css, cyl, mat, mesh, sph } from "../core/kit";
import type { MoodState } from "../core/moods";
import type { Room } from "../core/room";
import { checkerTexture } from "../pieces/game";
import { buildBackWall, buildSteam, furniture } from "./shared";
import type { Setting } from "./types";

/**
 * The café setting: a game café. A game table on a rug with a board, cards, two dice and pawns, three chairs
 * round it, and a card table with a hand of cards laid out.
 *
 * No characters and no words: those are in the Corner's config.
 */
export function buildCafe(scene: T.Scene, room: Room, labels: Record<Spot, string>, kind: PieceKind): Setting {
  const R = rng(42);
  const wall = buildBackWall(scene, room, labels, kind, R);
  const kit = furniture(scene, room, R);
  const { wood, trim } = room;

  kit.roundRug(0.95, 0.6, 1.15, 0x2f4a5e, [0xe9d9bf, 0xc9a24a, 0x7a3b3b, 0x3f5a4c]);

  // The game table.
  const table = new T.Group();
  table.add(at(box(1.3, 0.06, 1.3, wood), 0, 0.75, 0));
  for (const [a, b] of [[-0.58, -0.58], [0.58, -0.58], [-0.58, 0.58], [0.58, 0.58]]) table.add(at(box(0.07, 0.75, 0.07, trim), a, 0.375, b));
  const board = new T.Mesh(new T.PlaneGeometry(0.86, 0.86), new T.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.7 }));
  board.rotation.x = -PI / 2;
  board.receiveShadow = true;
  table.add(at(board, 0, 0.782, 0));
  for (let i = 0; i < 6; i++) {
    const card = box(0.07, 0.004, 0.1, mat(i % 2 ? 0xf3ece0 : 0xc0453a, 0.7));
    card.rotation.y = R() * PI;
    table.add(at(card, -0.52 + R() * 0.1, 0.785 + i * 0.004, 0.4 - R() * 0.2));
  }
  scene.add(at(table, 0.95, 0, 0.55));

  const diceTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = css(0xf6f1e6);
    g.fillRect(0, 0, w, h);
    g.fillStyle = css(0x2b1d14);
    for (const [a, b] of [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]]) {
      g.beginPath();
      g.arc(a, b, 11, 0, PI * 2);
      g.fill();
    }
  });
  const dice = [0, 1].map((i) => {
    const d = mesh(new T.BoxGeometry(0.06, 0.06, 0.06), new T.MeshStandardMaterial({ map: diceTex, roughness: 0.5 }));
    scene.add(at(d, 0.75 + i * 0.1, 0.81, 0.75));
    return d;
  });
  const pawnOf = (color: number) => {
    const m = mat(color, 0.4);
    const p = new T.Group();
    p.add(at(cyl(0.022, 0.03, 0.05, m, 12), 0, 0.025, 0), at(sph(0.022, m, 10, 8), 0, 0.07, 0));
    return p;
  };
  const pawn = pawnOf(0xc0453a);
  scene.add(at(pawn, 0.84, 0.785, 0.44));
  for (const [x, z] of [[1.06, 0.66], [1.17, 0.33]]) scene.add(at(pawnOf(0x2f6e8f), x, 0.785, z));

  kit.chair(0.95, -0.32, 0);
  kit.chair(0.02, 0.55, PI / 2);
  kit.chair(1.88, 0.55, -PI / 2);

  // The card table.
  kit.workbench(-1.6, 0.4);
  for (let i = 0; i < 5; i++) {
    const card = box(0.08, 0.004, 0.11, mat(0xf3ece0, 0.7));
    card.rotation.y = (i - 2) * 0.3;
    scene.add(at(card, -1.9 + i * 0.13, 0.958, 0.3));
  }
  const steam = buildSteam(scene, kit.mug(-2.35, 1.008, 0.75, 0xe9d2b5));
  kit.mug(-0.9, 1.008, 0.6, 0xc0453a);
  kit.bigPlant(-3.9, 0, 2.3, 1.1, 0x2f4a5e);
  kit.bigPlant(3.9, 0, 1.4, 0.9, 0xc97b5a);

  let mood: MoodState | null = null;
  return {
    slots: wall.slots,
    headroom: wall.headroom,
    signs: wall.signs,
    areas: wall.areas,
    props: { table: { dice, pawn, board: new T.Vector3(0.95, 0.785, 0.55) } },
    applyMood(cur) {
      mood = cur;
      wall.applyMood(cur);
    },
    update(t, _dt, _k, state) {
      wall.update(t, state.reducedMotion);
      steam(t, mood ? mood.rain > 0.3 : false);
    },
  };
}
