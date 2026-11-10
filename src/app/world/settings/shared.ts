import * as T from "three";
import type { PieceKind } from "../config";
import { rng, GLAZES, POT_SHAPES, type Spot } from "../layout";
import { PI, at, box, canvasTex, css, cyl, glow, mat, mesh, sph, tagTexture } from "../core/kit";
import type { MoodState } from "../core/moods";
import type { Room } from "../core/room";
import { BOOK_COLORS } from "../pieces/book";
import { GAME_COLORS } from "../pieces/game";
import { FLOWERS, LEAF_A, LEAF_B, plant } from "../pieces/plant";
import { PROFILES, glazedPot } from "../pieces/pot";
import type { Setting } from "./types";

/**
 * What the garden, the reading room and the café share: the back wall (shelves, the rack, the three tags,
 * the lamps, the board) and a small kit of furniture. Every setting keeps the same footprint, so pieces and
 * signs sit in the same places in every room.
 *
 * The studio builds its own back wall in studio.ts, with the same positions.
 */

type Rand = () => number;

/** Something standing on a shelf as decoration, and how much shelf it takes. Never a Moment. */
function stockItem(kind: PieceKind, r: Rand): { o: T.Object3D; w: number } {
  if (kind === "pot") {
    const shape = POT_SHAPES[Math.floor(r() * POT_SHAPES.length)];
    const sc = 0.8 + r() * 0.38;
    const p = glazedPot(shape, GLAZES[Math.floor(r() * GLAZES.length)], Math.floor(r() * 1e9));
    p.scale.setScalar(sc);
    p.rotation.y = r() * PI * 2;
    return { o: p, w: PROFILES[shape].r * sc * 2 + 0.05 };
  }
  if (kind === "plant") {
    const p = plant(Math.floor(r() * 1e6), r() >= 0.4, FLOWERS[Math.floor(r() * FLOWERS.length)]);
    const sc = 0.85 + r() * 0.4;
    p.scale.setScalar(sc);
    p.rotation.y = r() * PI * 2;
    return { o: p, w: 0.25 * sc + 0.04 };
  }
  if (kind === "book") {
    // Now and then a plant among the books.
    if (r() < 0.08) return stockItem("plant", r);
    const w = 0.035 + r() * 0.03;
    const h = 0.22 + r() * 0.1;
    const g = new T.Group();
    g.add(at(box(w, h, 0.19, mat(BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)], 0.75)), 0, h / 2, 0));
    if (r() < 0.5) g.add(at(box(w + 0.002, 0.012, 0.192, mat(0xd9b34a, 0.4, 0.3)), 0, h * 0.82, 0));
    if (r() < 0.1) g.rotation.z = (r() < 0.5 ? -1 : 1) * 0.18;
    return { o: g, w: w + 0.004 };
  }
  const g = new T.Group();
  if (r() < 0.25) {
    // A stack of three boxes lying flat.
    let y = 0;
    for (let i = 0; i < 3; i++) {
      const hh = 0.05 + r() * 0.03;
      g.add(at(box(0.3 - i * 0.02, hh, 0.26, mat(GAME_COLORS[Math.floor(r() * GAME_COLORS.length)], 0.6)), 0, y + hh / 2, 0));
      y += hh;
    }
    return { o: g, w: 0.32 };
  }
  const w = 0.08 + r() * 0.03;
  const h = 0.26 + r() * 0.1;
  g.add(at(box(w, h, 0.26, mat(GAME_COLORS[Math.floor(r() * GAME_COLORS.length)], 0.6)), 0, h / 2, 0), at(box(w + 0.002, h * 0.25, 0.262, mat(0xefe2c8, 0.7)), 0, h * 0.62, 0));
  return { o: g, w: w + 0.006 };
}

export interface BackWall {
  slots: Setting["slots"];
  headroom: Setting["headroom"];
  signs: Setting["signs"];
  areas: Setting["areas"];
  /** Dims and warms the lamps with the light. */
  applyMood(cur: MoodState): void;
  /** Sways the lamps. */
  update(t: number, reducedMotion: boolean): void;
}

/**
 * The back wall and the lamps. The top shelves and the left of the bottom one hold the room's own stock, which
 * is decoration. The middle shelf (the finished wall), the right of the bottom one (Your shelf) and the rack
 * (the in-progress wall) stay empty until a real Moment puts a piece there.
 */
export function buildBackWall(scene: T.Scene, room: Room, labels: Record<Spot, string>, kind: PieceKind, R: Rand): BackWall {
  const { wood, trim, theme } = room;
  const tag = (text: string, spot: Spot, bg: number, fg: number) => {
    const m = mesh(new T.BoxGeometry(0.62, 0.155, 0.02), [trim, trim, trim, trim, new T.MeshStandardMaterial({ map: tagTexture(text, bg, fg), roughness: 0.75 }), trim]);
    m.userData.spot = spot;
    return m;
  };

  const shelves = theme.tall ? [1.2, 1.9, 2.6, 3.3] : [1.2, 1.9, 2.6];
  for (const y of shelves) {
    scene.add(at(box(6.2, 0.05, 0.42, wood), -0.55, y, -3.98));
    if (!theme.tall) for (const x of [-3.5, -1.6, 0.4, 2.4]) scene.add(at(box(0.04, 0.18, 0.3, trim), x, y - 0.11, -4.05));
  }
  if (theme.tall) {
    // A bookcase: two sides, two uprights and a top.
    for (const x of [-3.66, 2.56]) scene.add(at(box(0.06, 3.5, 0.44, wood), x, 1.75, -3.98));
    for (const x of [-1.6, 0.4]) scene.add(at(box(0.04, 2.15, 0.42, wood), x, 2.27, -3.98));
    scene.add(at(box(6.3, 0.08, 0.46, wood), -0.55, 3.52, -3.98));
  }
  const stock = (y: number, from: number, to: number) => {
    let x = from;
    for (;;) {
      const { o, w } = stockItem(kind, R);
      if (x + w > to) break;
      o.traverse((n) => {
        n.castShadow = false;
      });
      scene.add(at(o, x + w / 2, y + 0.025, -3.95));
      x += w + (kind === "book" ? 0.001 : R() * 0.05);
    }
  };
  for (const y of shelves.slice(2)) stock(y, -3.5, 2.45);
  stock(1.2, -3.5, -1.15);

  scene.add(at(tag(labels.shelf, "shelf", 0xd3e6d6, 0x234a33), -2.9, 1.8, -3.76));
  scene.add(at(tag(labels.yours, "yours", 0xf3d79b, 0x5a3b10), 1.7, 1.1, -3.76));
  scene.add(at(new T.Mesh(new T.BoxGeometry(1.4, 0.015, 0.03), new T.MeshBasicMaterial({ color: 0xffd9a0 })), 1.68, 1.872, -3.82));
  const yourGlow = glow(0xffcf8a, 1, 0.22);
  yourGlow.scale.set(1.9, 0.75, 1);
  scene.add(at(yourGlow, 1.68, 1.45, -3.86));

  // The rack: the in-progress wall.
  const rack = new T.Group();
  const rackWood = new T.MeshStandardMaterial({ map: room.woodMap, color: theme.rack, roughness: 0.55 });
  const rackPost = mat(theme.rackPost, 0.6);
  for (const [x, z] of [[-0.95, -3.95], [1.35, -3.95], [-0.95, -3.62], [1.35, -3.62]]) rack.add(at(box(0.04, 0.95, 0.04, rackPost), x, 0.475, z));
  for (const y of [0.25, 0.55, 0.85]) for (let i = 0; i < 5; i++) rack.add(at(box(2.34, 0.02, 0.05, rackWood), 0.2, y, -3.93 + i * 0.075));
  rack.traverse((n) => {
    n.userData.spot = "rack";
  });
  scene.add(rack);
  scene.add(at(tag(labels.rack, "rack", 0xf2cfc4, 0x6b2e22), -0.95, 0.72, -3.59));

  // Pendant lamps.
  const lamps: { arm: T.Group; bulb: T.Mesh<T.SphereGeometry, T.MeshBasicMaterial>; halo: T.Sprite; light: T.PointLight }[] = [];
  const bulbWarm = new T.Color(0xffd8a0);
  for (const [x, y, z] of theme.lamps) {
    const g = new T.Group();
    g.add(at(cyl(0.008, 0.008, 5.6 - y, mat(0x222222, 0.6), 6), 0, (5.6 - y) / 2, 0));
    g.add(at(cyl(0.05, 0.3, 0.26, mat(theme.shade, 0.4, 0.4), 32, true), 0, -0.1, 0));
    const bulb = new T.Mesh(new T.SphereGeometry(0.065, 16, 12), new T.MeshBasicMaterial({ color: 0xffd8a0 }));
    bulb.position.y = -0.2;
    g.add(bulb);
    const halo = glow(0xffb36b, 1.6, 0.3);
    halo.position.y = -0.25;
    g.add(halo);
    const light = new T.PointLight(0xffb36b, 0.4, 7, 2);
    light.position.y = -0.3;
    g.add(light);
    scene.add(at(g, x, y, z));
    lamps.push({ arm: g, bulb, halo, light });
  }

  // The board, with blank cards. It says nothing until the Corner's starter activities are approved.
  const [boardFrame, boardFace] = theme.board;
  const boardTex = canvasTex(640, 440, (g, w, h) => {
    g.fillStyle = css(boardFrame);
    g.fillRect(0, 0, w, h);
    g.fillStyle = css(boardFace);
    g.fillRect(18, 18, w - 36, h - 36);
    const r = rng(5);
    for (let i = 0; i < 6000; i++) {
      g.fillStyle = theme.chalk ? css(0xffffff, r() * 0.04) : r() < 0.5 ? css(0x5a371e, r() * 0.3) : css(0xf0cda0, r() * 0.3);
      g.fillRect(18 + r() * (w - 36), 18 + r() * (h - 36), 2, 2);
    }
    const pos = [[40, 40, -0.05], [335, 52, 0.05], [60, 232, 0.03], [345, 226, -0.04]];
    const paper = [0xfff8ec, 0xf3e6c8, 0xe8f0ea, 0xf6e1dc];
    const pins = [0xd04a3a, 0x2f4f86, 0x3f8f6b, 0xe7a83b];
    pos.forEach(([x, y, rot], i) => {
      g.save();
      g.translate(x + 118, y + 80);
      g.rotate(rot);
      if (theme.chalk) {
        // Four chalk outlines, nothing written in them.
        g.strokeStyle = css(0xffffff, 0.75);
        g.lineWidth = 3;
        g.setLineDash([8, 6]);
        g.strokeRect(-108, -68, 216, 136);
        g.setLineDash([]);
      } else {
        g.shadowColor = css(0, 0.35);
        g.shadowBlur = 12;
        g.shadowOffsetY = 5;
        g.fillStyle = css(paper[i]);
        g.fillRect(-112, -72, 224, 144);
        g.shadowColor = "transparent";
        g.fillStyle = css(0x7a6250, 0.25);
        for (const [ly, lw] of [[-10, 150], [14, 110], [38, 130]]) g.fillRect(-lw / 2, ly, lw, 5);
        g.fillStyle = css(pins[i]);
        g.beginPath();
        g.arc(0, -56, 9, 0, PI * 2);
        g.fill();
      }
      g.restore();
    });
  });
  scene.add(at(mesh(new T.BoxGeometry(1.4, 0.96, 0.04), [trim, trim, trim, trim, new T.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }), trim]), 3.35, 2.35, -4.17));

  const shelfX = [0.42, -0.2, 1.04, -0.82, 1.66, -1.44, 2.28, -2.06, -2.68, -3.3];
  const rackX = [-0.6, -0.05, 0.5, 1.05];
  return {
    slots: {
      rack: [0.85, 0.55].flatMap((y) => rackX.map((x) => new T.Vector3(x, y + 0.012, -3.74))),
      shelf: shelfX.map((x) => new T.Vector3(x, 1.925, -3.95)),
      yours: [1.12, 1.4, 1.68, 1.96, 2.24].map((x) => new T.Vector3(x, 1.225, -3.92)),
    },
    headroom: { rack: 0.27, shelf: 0.6, yours: 0.6 },
    signs: { rack: new T.Vector3(0.2, 1.09, -3.58), shelf: new T.Vector3(-0.5, 2.38, -3.8), yours: new T.Vector3(1.68, 1.68, -3.8) },
    areas: { rack: [0.2, 0.6, -3.45, 2.7], shelf: [-0.5, 2.02, -3.7, 5.6], yours: [1.68, 1.32, -3.7, 1.8] },
    applyMood(cur) {
      lamps.forEach((l, i) => {
        // Point lights carry a factor of PI, as in the studio: the scene was tuned before three.js moved to physical units.
        l.light.intensity = cur.lamp * (i === 1 ? 1.1 : 1) * PI;
        l.halo.material.opacity = 0.12 + cur.lamp * 0.32;
        l.bulb.material.color.copy(bulbWarm).multiplyScalar(0.35 + cur.lamp * 0.45);
      });
    },
    update(t, reducedMotion) {
      lamps.forEach((l, i) => {
        l.arm.rotation.z = reducedMotion ? 0 : Math.sin(t * 0.6 + i) * 0.012;
      });
    },
  };
}

/** A small kit of furniture, each piece added to the scene where asked. */
export function furniture(scene: T.Scene, room: Room, R: Rand) {
  const { wood, trim, theme } = room;
  const leafA = mat(LEAF_A, 0.7);
  const leafB = mat(LEAF_B, 0.7);
  return {
    leafA,
    leafB,
    workbench(x: number, z: number, cloth?: number) {
      const b = new T.Group();
      b.add(at(box(2.2, 0.1, 1, wood), 0, 0.9, 0));
      for (const [px, pz] of [[-1, -0.42], [1, -0.42], [-1, 0.42], [1, 0.42]]) b.add(at(box(0.09, 0.9, 0.09, trim), px, 0.45, pz));
      if (cloth !== undefined) b.add(at(box(1.1, 0.012, 0.7, mat(cloth, 0.95)), -0.1, 0.956, 0.05));
      b.add(at(box(2, 0.06, 0.85, trim), 0, 0.2, 0));
      scene.add(at(b, x, 0, z));
    },
    stool(x: number, z: number) {
      const s = new T.Group();
      s.add(at(cyl(0.2, 0.2, 0.06, wood, 24), 0, 0.5, 0));
      for (let i = 0; i < 3; i++) {
        const leg = cyl(0.025, 0.025, 0.52, trim, 8);
        leg.position.set(Math.cos(i * 2.1) * 0.13, 0.25, Math.sin(i * 2.1) * 0.13);
        leg.rotation.z = Math.cos(i * 2.1) * 0.12;
        leg.rotation.x = -Math.sin(i * 2.1) * 0.12;
        s.add(leg);
      }
      scene.add(at(s, x, 0, z));
    },
    chair(x: number, z: number, rot: number) {
      const g = new T.Group();
      const m = mat(theme.shelf, 0.6);
      g.add(at(box(0.46, 0.05, 0.46, m), 0, 0.47, 0), at(box(0.46, 0.55, 0.05, m), 0, 0.75, -0.21));
      for (const [a, b] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(at(box(0.04, 0.47, 0.04, m), a, 0.235, b));
      g.rotation.y = rot;
      scene.add(at(g, x, 0, z));
    },
    armchair(x: number, z: number, rot: number, color: number) {
      const g = new T.Group();
      const m = mat(color, 0.9);
      g.add(at(box(0.8, 0.32, 0.75, m), 0, 0.27, 0), at(box(0.8, 0.62, 0.18, m), 0, 0.62, -0.3), at(box(0.16, 0.3, 0.75, m), -0.36, 0.55, 0), at(box(0.16, 0.3, 0.75, m), 0.36, 0.55, 0), at(box(0.6, 0.1, 0.55, mat(color, 0.95)), 0, 0.48, 0.05));
      g.rotation.y = rot;
      scene.add(at(g, x, 0, z));
    },
    bigPlant(x: number, y: number, z: number, s: number, pot: number) {
      const g = new T.Group();
      g.add(at(cyl(0.3, 0.22, 0.5, mat(pot, 0.85), 28), 0, 0.25, 0));
      for (let i = 0; i < 11; i++) {
        const leaf = sph(0.22, i % 2 ? leafA : leafB, 16, 10);
        leaf.scale.set(0.32, 1.25, 0.08);
        const a = (i / 11) * PI * 2;
        leaf.position.set(Math.cos(a) * 0.22, 0.85 + R() * 0.25, Math.sin(a) * 0.22);
        leaf.rotation.set(Math.sin(a) * 0.7, -a, Math.cos(a) * -0.7);
        g.add(leaf);
      }
      g.scale.setScalar(s);
      scene.add(at(g, x, y, z));
    },
    /** Four sacks stacked in the back left corner. */
    bags(color: number) {
      const dark = new T.Color(color).multiplyScalar(0.9).getHex();
      for (let i = 0; i < 4; i++) {
        const bag = box(0.6, 0.26, 0.4, mat(i % 2 ? color : dark, 0.38));
        bag.rotation.y = R() * 0.4 - 0.2;
        scene.add(at(bag, -3.6 + (i % 2) * 0.15, 0.13 + i * 0.26, -3.45));
      }
    },
    /** A mug. Returns where its steam rises from. */
    mug(x: number, y: number, z: number, color: number): [number, number, number] {
      const mm = mat(color, 0.3);
      const g = new T.Group();
      g.add(cyl(0.06, 0.055, 0.11, mm, 22), at(mesh(new T.TorusGeometry(0.035, 0.011, 8, 18), mm), 0.066, 0, 0));
      const tea = new T.Mesh(new T.CircleGeometry(0.053, 22), mat(0x6b3f1f, 0.15));
      tea.rotation.x = -PI / 2;
      tea.position.y = 0.048;
      g.add(tea);
      scene.add(at(g, x, y, z));
      return [x, y + 0.06, z];
    },
    roundRug(x: number, z: number, sx: number, base: number, cols: readonly number[]) {
      const tex = canvasTex(512, 512, (g, w, h) => {
        g.fillStyle = css(base);
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 14; i++) {
          g.fillStyle = css(cols[i % 4]);
          g.fillRect(0, i * 37, w, i % 3 ? 6 : 14);
        }
        for (let y = 18; y < h; y += 74)
          for (let xx = 0; xx < w; xx += 64) {
            g.fillStyle = css(cols[(xx / 64 + y) % 4 | 0]);
            g.beginPath();
            g.moveTo(xx + 32, y - 14);
            g.lineTo(xx + 52, y + 4);
            g.lineTo(xx + 32, y + 22);
            g.lineTo(xx + 12, y + 4);
            g.fill();
          }
      });
      const rug = new T.Mesh(new T.CircleGeometry(1.5, 48), new T.MeshStandardMaterial({ map: tex, roughness: 1 }));
      rug.rotation.x = -PI / 2;
      rug.scale.set(sx, 1, 1);
      rug.receiveShadow = true;
      scene.add(at(rug, x, 0.006, z));
    },
  };
}

/** Steam rising from a mug. Fainter at night. */
export function buildSteam(scene: T.Scene, from: [number, number, number]) {
  const puffs: { sp: T.Sprite; o: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const sp = glow(0xffffff, 0.1, 0);
    scene.add(sp);
    puffs.push({ sp, o: i / 8 });
  }
  return (t: number, night: boolean) => {
    for (const st of puffs) {
      const ph = (t * 0.22 + st.o) % 1;
      st.sp.position.set(from[0] + Math.sin(ph * 6 + st.o * 9) * 0.035, from[1] + ph * 0.5, from[2]);
      st.sp.scale.setScalar(0.07 + ph * 0.2);
      st.sp.material.opacity = Math.sin(ph * PI) * 0.16 * (night ? 0.6 : 1);
    }
  };
}
