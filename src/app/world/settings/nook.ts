import * as T from "three";
import { rng, type Spot } from "../layout";
import type { PieceKind } from "../config";
import { PI, at, box, cyl, glow, mat, sph } from "../core/kit";
import type { MoodState } from "../core/moods";
import type { Room } from "../core/room";
import { BOOK_COLORS, PAPER } from "../pieces/book";
import { buildBackWall, buildSteam, furniture } from "./shared";
import type { Setting } from "./types";

/**
 * The nook setting: a reading room. A window seat with cushions, two armchairs on a rug, a side table with a
 * pile of books, a writing desk with a lamp, and a fireplace.
 *
 * No characters and no words: those are in the Corner's config.
 */
export function buildNook(scene: T.Scene, room: Room, labels: Record<Spot, string>, kind: PieceKind): Setting {
  const R = rng(42);
  const wall = buildBackWall(scene, room, labels, kind, R);
  const kit = furniture(scene, room, R);
  const { wood, trim, theme } = room;
  const [W0, W1] = room.win;
  const WZ = (W0 + W1) / 2;

  // Window seat.
  const seat = new T.Group();
  seat.add(at(box(0.75, 0.45, W1 - W0 + 0.3, wood), 0, 0.225, 0), at(box(0.7, 0.08, W1 - W0 + 0.2, mat(0x7a3b3b, 0.95)), 0, 0.49, 0));
  for (const dz of [-0.6, 0.6]) {
    const cushion = sph(0.16, mat(0xc9a24a, 0.95), 14, 10);
    cushion.scale.set(0.5, 1, 1.1);
    seat.add(at(cushion, -0.25, 0.64, dz));
  }
  scene.add(at(seat, -4.22, 0, WZ));

  kit.roundRug(0.7, 0.95, 1.25, 0x7a3b3b, [0xe9d9bf, 0x2f3a4e, 0xc99a4a, 0x4a5d52]);
  kit.armchair(1.35, 0.85, 0.55, 0x3f5a4c);
  kit.armchair(-0.35, 1.55, 1.25, 0xa8643f);
  const throwBlanket = box(0.5, 0.04, 0.55, mat(0xc9a24a, 0.95));
  throwBlanket.rotation.z = 0.15;
  scene.add(at(throwBlanket, -0.3, 0.6, 1.6));

  // Side table with three books and a cup.
  scene.add(at(cyl(0.28, 0.28, 0.04, wood, 28), 0.55, 0.55, 1.85), at(cyl(0.04, 0.06, 0.55, trim, 10), 0.55, 0.275, 1.85));
  for (let i = 0; i < 3; i++) scene.add(at(box(0.24 - i * 0.02, 0.045, 0.18, mat(BOOK_COLORS[i + 3], 0.7)), 0.5, 0.595 + i * 0.045, 1.8));
  const steam = buildSteam(scene, kit.mug(0.66, 0.63, 1.95, 0xe9d2b5));

  // Writing desk: an open notebook on a blotter, a lamp, a stool.
  kit.workbench(-1.6, 0.4);
  scene.add(at(box(0.34, 0.02, 0.26, mat(PAPER, 0.9)), -1.5, 0.96, 0.35), at(box(0.36, 0.012, 0.28, mat(0x3f5a4c, 0.7)), -1.5, 0.952, 0.35));
  const deskLamp = new T.Group();
  const metal = mat(0x2b2b33, 0.4, 0.5);
  deskLamp.add(at(cyl(0.08, 0.1, 0.03, metal, 16), 0, 0.015, 0), at(cyl(0.01, 0.01, 0.35, metal, 8), 0, 0.19, 0), at(cyl(0.04, 0.11, 0.12, mat(theme.shade, 0.5), 20, true), 0, 0.38, 0.03));
  deskLamp.add(at(glow(0xffc070, 0.7, 0.45), 0, 0.33, 0.05));
  scene.add(at(deskLamp, -2.4, 0.95, 0.1));
  kit.stool(-1.6, -0.15);

  // Fireplace.
  const fireplace = new T.Group();
  fireplace.add(at(box(1.7, 1.35, 0.5, mat(0x8a4a3a, 0.9)), 0, 0.675, 0), at(box(1.9, 0.08, 0.6, wood), 0, 1.39, 0.03), at(box(0.95, 0.72, 0.12, mat(0x140d0a, 1)), 0, 0.42, 0.2));
  for (const dx of [-0.15, 0.15]) {
    const log = cyl(0.06, 0.06, 0.6, mat(0x5a3b26, 0.9), 10);
    log.rotation.z = PI / 2;
    log.rotation.y = dx * 2;
    fireplace.add(at(log, dx * 0.3, 0.14, 0.23));
  }
  const flames: T.Mesh[] = [];
  for (const [c, r, h, x] of [[0xff7a2e, 0.16, 0.42, 0], [0xffb347, 0.11, 0.3, 0.12], [0xffd27a, 0.08, 0.24, -0.1]]) {
    const flame = new T.Mesh(new T.ConeGeometry(r, h, 10, 1, true), new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false }));
    fireplace.add(at(flame, x, 0.2 + h / 2, 0.24));
    flames.push(flame);
  }
  const fireGlow = glow(0xff8a3c, 1.8, 0.7);
  fireplace.add(at(fireGlow, 0, 0.4, 0.45));
  const fireLight = new T.PointLight(0xff8a3c, 1, 6, 2);
  fireplace.add(at(fireLight, 0, 0.6, 0.7));
  scene.add(at(fireplace, 3.6, 0, -3.82));

  kit.bigPlant(-3.95, 0, 2.4, 1.0, 0x3f5a4c);

  let mood: MoodState | null = null;
  return {
    slots: wall.slots,
    headroom: wall.headroom,
    signs: wall.signs,
    areas: wall.areas,
    props: {},
    applyMood(cur) {
      mood = cur;
      wall.applyMood(cur);
    },
    update(t, _dt, _k, state) {
      wall.update(t, state.reducedMotion);
      steam(t, mood ? mood.rain > 0.3 : false);
      // The fire burns brighter as the room gets darker (the same number the studio's kiln follows).
      const warm = mood ? mood.kiln : 0.7;
      flames.forEach((f, i) => {
        const s = state.reducedMotion ? 1 : 1 + Math.sin(t * (7 + i * 3) + i) * 0.12 + Math.sin(t * (13 + i)) * 0.06;
        f.scale.set(state.reducedMotion ? 1 : 1 + Math.sin(t * 5 + i) * 0.08, s, state.reducedMotion ? 1 : 1 + Math.sin(t * 6 + i) * 0.08);
      });
      const flicker = state.reducedMotion ? 1.1 : 1.1 + Math.sin(t * 9) * 0.12 + Math.sin(t * 23) * 0.08;
      // A point light, so it carries the same factor of PI as the lamps.
      fireLight.intensity = flicker * (0.6 + warm * 0.5) * PI;
      fireGlow.material.opacity = warm * theme.warmMul * 0.45 * (state.reducedMotion ? 0.9 : 0.9 + Math.sin(t * 3.1) * 0.06 + Math.sin(t * 7.3) * 0.05);
    },
  };
}
