import * as T from "three";
import { rng, type Spot } from "../layout";
import type { PieceKind } from "../config";
import { PI, at, box, canvasTex, css, cyl, mat, sph } from "../core/kit";
import type { MoodState } from "../core/moods";
import type { Room } from "../core/room";
import { addLeaves } from "../pieces/plant";
import { buildBackWall, buildSteam, furniture } from "./shared";
import type { Setting } from "./types";

/**
 * The garden setting: a greenhouse with a potting bench, a raised bed, a big fern and hanging baskets. Its
 * room is open on the left (see ../core/themes), so it gives onto a garden: a pergola where the wall would be,
 * a stone path, a vegetable patch, sunflowers, a flower border, an apple tree, a fence and three butterflies.
 *
 * No characters and no words: those are in the Corner's config.
 */
const WX = -4.7;
const TERRACOTTA = 0xb5643f;
const SOIL = 0x4a3426;

export function buildGarden(scene: T.Scene, room: Room, labels: Record<Spot, string>, kind: PieceKind): Setting {
  const R = rng(42);
  const wall = buildBackWall(scene, room, labels, kind, R);
  const kit = furniture(scene, room, R);
  const { leafA, leafB } = kit;
  const terracotta = mat(TERRACOTTA, 0.85);
  const soil = mat(SOIL, 0.98);

  // Potting bench: a mound of soil, pots and seed packets.
  kit.workbench(-1.6, 0.4);
  const mound = sph(0.2, soil, 20, 14);
  mound.scale.set(1.5, 0.55, 1.2);
  scene.add(at(mound, -1.6, 1.0, 0.25));
  for (const [x, z] of [[-2.3, 0.15], [-2.05, 0.55], [-0.95, 0.6], [-1.0, 0.2]]) scene.add(at(cyl(0.07, 0.055, 0.1, terracotta, 18), x, 1.0, z));
  [0xe07a8a, 0xf0c040, 0x7fb0e0].forEach((c, i) => {
    const packet = box(0.08, 0.11, 0.01, mat(c, 0.7));
    packet.rotation.x = -0.3;
    scene.add(at(packet, -0.75 + i * 0.1, 1.0, 0));
  });

  // Raised bed.
  const bed = new T.Group();
  const bedWood = new T.MeshStandardMaterial({ map: room.woodMap, color: 0xa58a6a, roughness: 0.7 });
  bed.add(at(box(2.0, 0.4, 0.08, bedWood), 0, 0.2, -0.5), at(box(2.0, 0.4, 0.08, bedWood), 0, 0.2, 0.5), at(box(0.08, 0.4, 1.0, bedWood), -1, 0.2, 0), at(box(0.08, 0.4, 1.0, bedWood), 1, 0.2, 0), at(box(1.92, 0.05, 0.92, soil), 0, 0.36, 0));
  const tomato = mat(0xd0453a, 0.5);
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 3; j++) {
      const g = new T.Group();
      const r = rng(i * 7 + j);
      if (j === 1) addLeaves(g, 6, 0.06, 0, r, leafA, leafB);
      else
        for (let k = 0; k < 5; k++) {
          const l = sph(0.06, k % 2 ? leafA : leafB, 10, 8);
          l.scale.set(1, 0.55, 1);
          l.position.set((r() - 0.5) * 0.08, 0.04, (r() - 0.5) * 0.08);
          g.add(l);
        }
      if (j === 2 && i % 2) g.add(at(sph(0.03, tomato, 10, 8), 0.03, 0.08, 0));
      bed.add(at(g, -0.75 + i * 0.37, 0.38, -0.3 + j * 0.3));
    }
  scene.add(at(bed, 1.35, 0, 0.75));

  kit.bigPlant(2.0, 0, -1.55, 0.9, 0xb5643f);
  kit.bigPlant(-3.9, 0, 2.3, 1.15, 0xc97b5a);
  kit.bigPlant(3.9, 0, 1.6, 1.0, 0x8a9a8a);
  kit.bags(0xa18a6a);
  for (let i = 0; i < 3; i++) {
    const hang = new T.Group();
    hang.add(at(cyl(0.005, 0.005, 1.4, mat(0x6b5a4a, 0.8), 5), 0, 0.7, 0), at(cyl(0.16, 0.12, 0.16, terracotta, 18), 0, 0, 0));
    addLeaves(hang, 9, 0.14, 0.02, rng(i + 50), leafA, leafB);
    const vine = sph(0.09, leafA, 10, 8);
    vine.scale.set(1, 2.2, 1);
    hang.add(at(vine, 0.1, -0.18, 0));
    scene.add(at(hang, -3.6 + i * 1.1, 3.2, -0.4 - i * 0.6));
  }
  const steam = buildSteam(scene, kit.mug(-2.35, 1.008, 0.75, 0xc97b5a));

  // ── Outside ──
  const grass = canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = css(0x5d7f3e);
      g.fillRect(0, 0, w, h);
      const r = rng(4);
      for (let i = 0; i < 9000; i++) {
        g.fillStyle = `hsla(${80 + r() * 30},${35 + r() * 25}%,${25 + r() * 25}%,${0.3 + r() * 0.5})`;
        g.fillRect(r() * w, r() * h, 1.5, 3 + r() * 5);
      }
    },
    [6, 12],
  );
  room.ground.material = new T.MeshStandardMaterial({ map: grass, roughness: 0.95 });

  // A pergola where the wall would be, with a vine along it.
  const pergola = new T.MeshStandardMaterial({ map: room.woodMap, color: 0xc9b49a, roughness: 0.7 });
  for (const z of [-4.15, -1.4, 1.35, 4.1]) scene.add(at(box(0.14, 3.4, 0.14, pergola), WX, 1.7, z));
  scene.add(at(box(0.18, 0.16, 8.6, pergola), WX, 3.42, 0));
  for (let z = -4; z <= 4; z += 0.55) scene.add(at(box(1.6, 0.08, 0.08, pergola), WX - 0.4, 3.54, z));
  for (let i = 0; i < 10; i++) {
    const v = sph(0.12, i % 2 ? leafA : leafB, 10, 8);
    v.scale.set(0.8, 1.8, 0.8);
    scene.add(at(v, WX + (R() - 0.5) * 0.3, 3.1 - R() * 0.6, -4 + i * 0.85));
  }

  // A step down and a stone path.
  scene.add(at(box(0.3, 0.06, 8.6, mat(0xb9ad9a, 0.9)), -4.95, 0, 0));
  for (const [x, z] of [[-5.4, 0.25], [-6.0, 0.55], [-6.6, 0.3], [-7.2, 0.6]]) {
    const stone = cyl(0.26, 0.28, 0.04, mat(0xa9a294, 0.9), 9);
    stone.rotation.y = R();
    scene.add(at(stone, x, 0.01, z));
  }

  // The vegetable patch.
  scene.add(at(box(2.2, 0.06, 1.6, soil), -6.7, 0.03, 1.9));
  const carrot = mat(0xe07a2a, 0.6);
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 3; j++) {
      const g = new T.Group();
      const r = rng(90 + i * 5 + j);
      for (let k = 0; k < 6; k++) {
        const l = sph(0.07, k % 2 ? leafA : leafB, 10, 8);
        l.scale.set(1, 0.5, 1);
        l.position.set((r() - 0.5) * 0.1, 0.05, (r() - 0.5) * 0.1);
        g.add(l);
      }
      if (j === 0 && i % 2) g.add(at(sph(0.04, carrot, 10, 8), 0.04, 0.1, 0));
      scene.add(at(g, -7.5 + i * 0.4, 0.06, 1.4 + j * 0.5));
    }

  // Sunflowers.
  const petal = mat(0xf0c030, 0.7);
  const seedHead = mat(0x4a2a14, 0.9);
  [[-8.0, -0.3], [-8.3, 0.4], [-7.9, 1.0], [-8.5, 1.5]].forEach(([x, z], i) => {
    const g = new T.Group();
    const h = 1.4 + i * 0.15;
    g.add(at(cyl(0.025, 0.03, h, leafB, 8), 0, h / 2, 0));
    for (let k = 0; k < 3; k++) {
      const lf = sph(0.12, leafA, 10, 8);
      lf.scale.set(1, 0.2, 0.6);
      lf.rotation.y = k * 2;
      g.add(at(lf, Math.cos(k * 2) * 0.12, h * 0.4 + k * 0.25, Math.sin(k * 2) * 0.12));
    }
    const head = new T.Group();
    head.add(cyl(0.17, 0.17, 0.04, petal, 16), at(cyl(0.09, 0.09, 0.05, seedHead, 14), 0, 0.01, 0));
    head.rotation.z = PI / 2 - 0.3;
    head.rotation.y = PI * 0.8;
    g.add(at(head, 0, h, 0));
    scene.add(at(g, x, 0, z));
  });

  // A flower border along the step.
  const border = [0xe07a8a, 0xf0c040, 0xffffff, 0xb98ae0, 0xe05a3a].map((c) => mat(c, 0.6));
  for (let i = 0; i < 16; i++) {
    const fc = border[i % 5];
    const g = new T.Group();
    g.add(at(sph(0.09, leafB, 8, 6), 0, 0.07, 0), at(sph(0.04, fc, 8, 6), 0.03, 0.15, 0.02), at(sph(0.035, fc, 8, 6), -0.04, 0.13, -0.02));
    scene.add(at(g, -5.35 - (i % 2) * 0.25, 0, -3.6 + i * 0.48));
  }

  // The apple tree, a fence and a water butt.
  scene.add(at(cyl(0.12, 0.18, 1.6, mat(0x5a3b26, 0.9), 10), -7.2, 0.8, -2.6));
  for (const [dx, y, dz, r] of [[0, 2.0, 0, 0.9], [0.5, 1.8, 0.3, 0.6], [-0.4, 1.9, -0.3, 0.65]]) scene.add(at(sph(r, leafA, 16, 12), -7.2 + dx, y, -2.6 + dz));
  const apple = mat(0xc0302a, 0.5);
  // Apples on the outside of the crown, where they can be seen.
  for (let i = 0; i < 9; i++) {
    const a = R() * PI * 2;
    const up = -0.35 + R() * 0.7;
    const out = 0.9 * Math.cos(up);
    scene.add(at(sph(0.06, apple, 10, 8), -7.2 + Math.cos(a) * out, 2.0 + Math.sin(up) * 0.9, -2.6 + Math.sin(a) * out));
  }
  const fence = mat(0xece7da, 0.8);
  for (let z = -4.4; z <= 4.4; z += 0.28) scene.add(at(box(0.06, 0.75, 0.1, fence), -9.4, 0.375, z));
  for (const y of [0.25, 0.55]) scene.add(at(box(0.04, 0.06, 8.9, fence), -9.35, y, 0));
  scene.add(at(cyl(0.25, 0.2, 0.5, mat(0x5f8a7a, 0.4, 0.5), 18), -6.1, 0.25, -1.0));
  // A hedge along the back of the garden, where the room's back wall stops.
  const hedge = mat(0x3d5e35, 0.95);
  for (let i = 0; i < 9; i++) {
    const bush = sph(0.62, hedge, 14, 10);
    bush.scale.set(1, 0.95 + (i % 3) * 0.12, 0.7);
    bush.castShadow = false;
    scene.add(at(bush, -5.2 - i * 0.55, 0.55, -4.45));
  }

  // Butterflies over the patch.
  const butterflies = [0xf0c040, 0xffffff, 0xe07a8a].map((c, i) => {
    const g = new T.Group();
    const wing = new T.MeshBasicMaterial({ color: c, side: T.DoubleSide });
    const left = new T.Group();
    const right = new T.Group();
    left.add(at(new T.Mesh(new T.PlaneGeometry(0.07, 0.06), wing), -0.035, 0, 0));
    right.add(at(new T.Mesh(new T.PlaneGeometry(0.07, 0.06), wing), 0.035, 0, 0));
    g.add(left, right);
    scene.add(g);
    return { g, left, right, o: i * 2.1 };
  });

  let mood: MoodState | null = null;
  return {
    slots: wall.slots,
    headroom: wall.headroom,
    signs: wall.signs,
    areas: wall.areas,
    props: { wedgeClay: mound },
    applyMood(cur) {
      mood = cur;
      wall.applyMood(cur);
    },
    update(t, _dt, _k, state) {
      wall.update(t, state.reducedMotion);
      steam(t, mood ? mood.rain > 0.3 : false);
      for (const b of butterflies) {
        const tt = t * 0.35 + b.o;
        b.g.position.set(-6.8 + Math.sin(tt) * 1.4, 0.6 + Math.sin(tt * 2.3) * 0.35 + 0.4, 1.0 + Math.cos(tt * 0.8) * 1.6);
        b.g.rotation.y = -tt;
        const flap = state.reducedMotion ? 0.3 : Math.sin(t * 22 + b.o) * 0.9;
        b.left.rotation.y = flap;
        b.right.rotation.y = -flap;
      }
    },
  };
}
