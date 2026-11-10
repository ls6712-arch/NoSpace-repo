import * as T from "three";
import { rng, GLAZES, POT_SHAPES, type Spot } from "./layout";
import { PI, at, box, canvasTex, css, cyl, glow, mat, mesh, sph, tagTexture } from "./kit";
import { PROFILES, glazedPot, potGeometry } from "./pots";
import { buildCat, buildPerson } from "./characters";
import type { MoodState } from "./moods";
import type { Room } from "./room";

/**
 * The pottery studio: everything that makes the shared room a place where
 * clay is thrown. Shelves, the drying rack, the wheel, a workbench, a glaze
 * table, the kiln, plants, lamps, three potters and a cat.
 *
 * It also says where a Corner's real pieces go (`slots`) and where each
 * part's sign floats (`signs`). Another Corner would write a file like this
 * one with its own objects and characters; see docs/corner-worlds.md.
 */

/** What the potters say. Each line is shown with a "Character" tag. */
export const STUDIO_LINES: Record<string, string[]> = {
  Meera: ["Centre first. Everything else follows.", "Slow hands, fast wheel.", "Wet your hands again. Trust me."],
  Arjun: ["Wedge out the air bubbles first.", "Mine looked like a potato too. Keep going.", "You showed up. That’s the hard part."],
  Lena: ["Nobody’s first bowl is round.", "Glaze day is the best day.", "Dip, count to three, lift."],
  Biscuit: ["(Biscuit the cat is asleep. Purring.)"],
};
export const STUDIO_WELCOME = { who: "Meera", text: "Oh hi! Grab a stool, the wheel’s warm." };
const COLLAPSE_LINE = "Ha. Collapsed. Again! Third time today.";

export interface SettingHooks {
  say(who: string, text: string): void;
  squish(pan: number, volume: number): void;
  thud(): void;
}

export interface Setting {
  /** Where the base of each piece sits, by part of the room, in slot order. */
  slots: Record<Spot, T.Vector3[]>;
  /** The tallest a piece may stand in each part. */
  headroom: Record<Spot, number>;
  /** Where each part's sign floats. */
  signs: Record<Spot, T.Vector3>;
  /** Centre and size of the soft glow shown when a part is pointed at: x, y, z, width. */
  areas: Record<Spot, [number, number, number, number]>;
  /** The characters, each with the point its speech bubble hangs from. */
  characters: { name: string; anchor: T.Object3D; lift: number }[];
  /** Characters who speak on their own every so often, in turn. */
  talkers: string[];
  lines: Record<string, string[]>;
  /** What one of them says when the viewer walks in. */
  welcome: { who: string; text: string };
  applyMood(cur: MoodState): void;
  update(t: number, dt: number, k: number, state: { entered: boolean; reducedMotion: boolean }, hooks: SettingHooks): void;
}

const damp = (a: number, b: number, k: number) => a + (b - a) * k;

export function buildStudio(scene: T.Scene, room: Room, labels: Record<Spot, string>): Setting {
  const wood = room.wood;
  const trim = room.trim;
  const R = rng(42);
  const tag = (text: string, spot: Spot, bg: number, fg: number) => {
    const m = mesh(new T.BoxGeometry(0.62, 0.155, 0.02), [trim, trim, trim, trim, new T.MeshStandardMaterial({ map: tagTexture(text, bg, fg), roughness: 0.75 }), trim]);
    m.userData.spot = spot;
    return m;
  };

  // Shelves along the back wall. The top shelf and the left of the bottom one hold the studio's own stock, which is
  // set dressing. The middle shelf is the Made it wall and the right of the bottom one is Your shelf: those stay
  // empty until a real Moment puts a piece there.
  const SHELVES = [1.2, 1.9, 2.6];
  for (const y of SHELVES) {
    scene.add(at(box(6.2, 0.05, 0.42, wood), -0.55, y, -3.98));
    for (const x of [-3.5, -1.6, 0.4, 2.4]) scene.add(at(box(0.04, 0.18, 0.3, trim), x, y - 0.11, -4.05));
  }
  const stock = (y: number, from: number, to: number) => {
    let x = from;
    for (;;) {
      const shape = POT_SHAPES[Math.floor(R() * POT_SHAPES.length)];
      const sc = 0.8 + R() * 0.38;
      const w = PROFILES[shape].r * sc * 2 + 0.05;
      if (x + w > to) break;
      const p = glazedPot(shape, GLAZES[Math.floor(R() * GLAZES.length)], Math.floor(R() * 1e9));
      p.scale.setScalar(sc);
      p.rotation.y = R() * PI * 2;
      scene.add(at(p, x + w / 2, y + 0.025, -3.95));
      x += w + R() * 0.05;
    }
  };
  stock(2.6, -3.5, 2.45);
  stock(1.2, -3.5, -1.15);

  const madeTag = tag(labels.shelf, "shelf", 0xd3e6d6, 0x234a33);
  scene.add(at(madeTag, -2.9, 1.8, -3.76));
  const yoursTag = tag(labels.yours, "yours", 0xf3d79b, 0x5a3b10);
  scene.add(at(yoursTag, 1.7, 1.1, -3.76));
  scene.add(at(new T.Mesh(new T.BoxGeometry(1.4, 0.015, 0.03), new T.MeshBasicMaterial({ color: 0xffd9a0 })), 1.68, 1.872, -3.82));
  const yourGlow = glow(0xffcf8a, 1, 0.22);
  yourGlow.scale.set(1.9, 0.75, 1);
  scene.add(at(yourGlow, 1.68, 1.45, -3.86));

  // The drying rack: the Still making wall.
  const rack = new T.Group();
  for (const [x, z] of [[-0.95, -3.95], [1.35, -3.95], [-0.95, -3.62], [1.35, -3.62]]) rack.add(at(box(0.04, 0.95, 0.04, trim), x, 0.475, z));
  for (const y of [0.25, 0.55, 0.85]) for (let i = 0; i < 5; i++) rack.add(at(box(2.34, 0.02, 0.05, wood), 0.2, y, -3.93 + i * 0.075));
  rack.traverse((n) => {
    n.userData.spot = "rack";
  });
  scene.add(rack);
  scene.add(at(tag(labels.rack, "rack", 0xf2cfc4, 0x6b2e22), -0.95, 0.72, -3.59));

  // Workbench, where clay is wedged.
  const bench = new T.Group();
  bench.add(at(box(2.2, 0.1, 1, wood), 0, 0.9, 0));
  for (const [x, z] of [[-1, -0.42], [1, -0.42], [-1, 0.42], [1, 0.42]]) bench.add(at(box(0.09, 0.9, 0.09, trim), x, 0.45, z));
  bench.add(at(box(1.1, 0.012, 0.7, mat(0xd9cfbf, 0.95)), -0.1, 0.956, 0.05));
  bench.add(at(box(2, 0.06, 0.85, trim), 0, 0.2, 0));
  scene.add(at(bench, -1.6, 0, 0.4));
  const wedgeClay = box(0.36, 0.24, 0.3, new T.MeshStandardMaterial({ color: 0x9c6b4c, roughness: 0.4 }));
  scene.add(at(wedgeClay, -1.6, 0.96 + 0.12, 0.25));
  const bucket = new T.Group();
  const water = new T.Mesh(new T.CircleGeometry(0.17, 28), new T.MeshPhysicalMaterial({ color: 0x6d5a4b, roughness: 0.05, clearcoat: 1 }));
  water.rotation.x = -PI / 2;
  bucket.add(cyl(0.18, 0.14, 0.32, mat(0x7f97a8, 0.35, 0.4), 28, true), at(water, 0, 0.1, 0));
  scene.add(at(bucket, -0.7, 1.11, 0.6));
  for (let i = 0; i < 4; i++) {
    const tool = cyl(0.012, 0.012, 0.32, mat(i % 2 ? 0xb08a5a : 0x8a8f95, 0.5, i % 2 ? 0 : 0.6), 8);
    tool.rotation.z = PI / 2;
    tool.rotation.y = 0.2 * i - 0.3;
    scene.add(at(tool, -2.35, 0.97, 0.3 + i * 0.09));
  }
  scene.add(at(box(0.16, 0.06, 0.1, mat(0xe9c94b, 0.95)), -0.95, 0.98, 0.15));
  for (let i = 0; i < 4; i++) {
    const bag = box(0.6, 0.26, 0.4, mat(i % 2 ? 0x8a7f73 : 0x7c7266, 0.38));
    bag.rotation.y = R() * 0.4 - 0.2;
    scene.add(at(bag, -3.6 + (i % 2) * 0.15, 0.13 + i * 0.26, -3.45));
  }

  // The wheel.
  const wheel = new T.Group();
  wheel.add(at(box(0.7, 0.42, 0.7, mat(0x6f8592, 0.45, 0.35)), 0, 0.21, 0));
  wheel.add(at(cyl(0.44, 0.4, 0.14, mat(0xd7d1c7, 0.5), 40, true), 0, 0.49, 0));
  wheel.add(at(cyl(0.4, 0.4, 0.02, mat(0xcfc8bd, 0.6), 40), 0, 0.43, 0));
  const wheelHead = new T.Group();
  wheelHead.add(cyl(0.26, 0.26, 0.04, mat(0x9aa3aa, 0.28, 0.7), 40));
  for (let i = 0; i < 5; i++) {
    const smear = box(0.09, 0.006, 0.02, mat(0x8e5e40, 0.4));
    smear.rotation.y = i * 1.3;
    smear.position.set(Math.cos(i * 1.3) * 0.16, 0.022, Math.sin(i * 1.3) * 0.16);
    wheelHead.add(smear);
  }
  wheel.add(at(wheelHead, 0, 0.56, 0));
  wheel.add(at(box(0.24, 0.06, 0.32, mat(0x2e353b, 0.5, 0.3)), 0.55, 0.03, -0.2));
  scene.add(at(wheel, 1.3, 0, 0.9));
  const clayStreak = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = css(0xa9714d);
    g.fillRect(0, 0, w, h);
    const r = rng(3);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = r() < 0.5 ? css(0xdcaa82, 0.15 + r() * 0.25) : css(0x5a321e, 0.15 + r() * 0.25);
      g.fillRect(r() * w, 0, 1 + r() * 5, h);
    }
    for (let y = 0; y < h; y += 6) {
      g.fillStyle = css(0x462819, 0.12);
      g.fillRect(0, y, w, 1);
    }
  });
  const wheelPot = mesh(potGeometry(PROFILES.lump), new T.MeshPhysicalMaterial({ map: clayStreak, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.35, side: T.DoubleSide }));
  scene.add(at(wheelPot, 1.3, 0.58, 0.9));
  const rugTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = css(0xb5643f);
    g.fillRect(0, 0, w, h);
    const cols = [0xe9d9bf, 0x2f4f6e, 0x7d3b24, 0xd9a441];
    for (let i = 0; i < 14; i++) {
      g.fillStyle = css(cols[i % 4]);
      g.fillRect(0, i * 37, w, i % 3 ? 6 : 14);
    }
    for (let y = 18; y < h; y += 74)
      for (let x = 0; x < w; x += 64) {
        g.fillStyle = css(cols[(x / 64 + y) % 4 | 0]);
        g.beginPath();
        g.moveTo(x + 32, y - 14);
        g.lineTo(x + 52, y + 4);
        g.lineTo(x + 32, y + 22);
        g.lineTo(x + 12, y + 4);
        g.fill();
      }
  });
  const rug = new T.Mesh(new T.CircleGeometry(1.5, 48), new T.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
  rug.rotation.x = -PI / 2;
  rug.scale.set(1.3, 1, 1);
  rug.receiveShadow = true;
  scene.add(at(rug, 1.0, 0.006, 0.9));
  const stool = (x: number, z: number) => {
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
  };
  stool(1.3, 0.2);
  stool(2.95, -1.6);

  // Glaze table.
  scene.add(at(cyl(0.45, 0.45, 0.05, wood, 36), 2.35, 0.7, -1.6), at(cyl(0.05, 0.08, 0.7, trim, 12), 2.35, 0.35, -1.6));
  for (const [c, dz] of [[0x2f4f86, -0.25], [0x8fb8a8, 0], [0xd9c27a, 0.25]]) {
    scene.add(at(cyl(0.08, 0.07, 0.12, mat(0xefe6d6, 0.5), 20), 2.05, 0.79, -1.6 + dz));
    const top = new T.Mesh(new T.CircleGeometry(0.07, 20), new T.MeshPhysicalMaterial({ color: c, roughness: 0.1, clearcoat: 1 }));
    top.rotation.x = -PI / 2;
    scene.add(at(top, 2.05, 0.845, -1.6 + dz));
  }
  const glazingPot = glazedPot("jar", 0x2f4f86, 9);
  scene.add(at(glazingPot, 2.45, 0.725, -1.6));

  // Kiln.
  const kiln = new T.Group();
  kiln.add(at(cyl(0.62, 0.62, 1.2, mat(0x8d9196, 0.45, 0.35), 10), 0, 0.6, 0), at(cyl(0.64, 0.64, 0.06, mat(0x5b6066, 0.5, 0.4), 10), 0, 1.22, 0));
  for (const y of [0.3, 0.9]) kiln.add(at(cyl(0.635, 0.635, 0.04, mat(0x4c5156, 0.5, 0.5), 10), 0, y, 0));
  const peep = new T.Mesh(new T.CircleGeometry(0.05, 16), new T.MeshBasicMaterial({ color: 0xff8a3c }));
  peep.position.set(0, 0.75, 0.62);
  kiln.add(peep);
  kiln.add(at(box(0.25, 0.32, 0.12, mat(0x3a3f45, 0.5, 0.3)), 0.5, 0.7, 0.42));
  const kilnGlow = glow(0xff7a2e, 0.9, 0.6);
  kilnGlow.position.set(0, 0.75, 0.7);
  kiln.add(kilnGlow);
  kiln.rotation.y = -0.6;
  scene.add(at(kiln, 3.7, 0, -3.35));

  // Plants.
  const plant = (x: number, y: number, z: number, s: number, pot: number) => {
    const g = new T.Group();
    g.add(at(cyl(0.3, 0.22, 0.5, mat(pot, 0.85), 28), 0, 0.25, 0));
    const leafA = mat(0x3f6b3a, 0.7);
    const leafB = mat(0x4f7d44, 0.7);
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
  };
  plant(-3.9, 0, 2.3, 1.15, 0xb5643f);
  plant(-4.35, 1.24, -1.25, 0.35, 0xe9d9bf);
  plant(-4.35, 1.24, 0.25, 0.3, 0x2f4f86);

  // Pendant lamps.
  const lamps: { arm: T.Group; bulb: T.Mesh<T.SphereGeometry, T.MeshBasicMaterial>; halo: T.Sprite; light: T.PointLight }[] = [];
  const bulbWarm = new T.Color(0xffd8a0);
  for (const [x, y, z] of [[-1.6, 2.85, 0.4], [1.3, 3.0, 0.9], [2.5, 2.8, -1.6]]) {
    const g = new T.Group();
    g.add(at(cyl(0.008, 0.008, 5.6 - y, mat(0x222222, 0.6), 6), 0, (5.6 - y) / 2, 0));
    g.add(at(cyl(0.05, 0.3, 0.26, mat(0x2f4a3e, 0.4, 0.4), 32, true), 0, -0.1, 0));
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

  // A corkboard with blank cards. It says nothing until the Corner's starter activities are approved.
  const boardTex = canvasTex(640, 440, (g, w, h) => {
    g.fillStyle = css(0x5a3b26);
    g.fillRect(0, 0, w, h);
    g.fillStyle = css(0xc79a63);
    g.fillRect(18, 18, w - 36, h - 36);
    const r = rng(5);
    for (let i = 0; i < 6000; i++) {
      g.fillStyle = r() < 0.5 ? css(0x5a371e, r() * 0.3) : css(0xf0cda0, r() * 0.3);
      g.fillRect(18 + r() * (w - 36), 18 + r() * (h - 36), 2, 2);
    }
    const pos = [[40, 40, -0.05], [335, 52, 0.05], [60, 232, 0.03], [345, 226, -0.04]];
    const paper = [0xfff8ec, 0xf3e6c8, 0xe8f0ea, 0xf6e1dc];
    const pins = [0xd04a3a, 0x2f4f86, 0x3f8f6b, 0xe7a83b];
    pos.forEach(([x, y, rot], i) => {
      g.save();
      g.translate(x + 118, y + 80);
      g.rotate(rot);
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
      g.restore();
    });
  });
  scene.add(at(mesh(new T.BoxGeometry(1.4, 0.96, 0.04), [trim, trim, trim, trim, new T.MeshStandardMaterial({ map: boardTex, roughness: 0.9 }), trim]), 3.35, 2.35, -4.17));

  // A mug of tea, steaming on the bench.
  const mugM = mat(0x2f4f86, 0.3);
  const mug = new T.Group();
  mug.add(cyl(0.06, 0.055, 0.11, mugM, 22), at(mesh(new T.TorusGeometry(0.035, 0.011, 8, 18), mugM), 0.066, 0, 0));
  const tea = new T.Mesh(new T.CircleGeometry(0.053, 22), mat(0x6b3f1f, 0.15));
  tea.rotation.x = -PI / 2;
  tea.position.y = 0.048;
  mug.add(tea);
  scene.add(at(mug, -2.35, 1.008, 0.75));
  const steam: { sp: T.Sprite; o: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const sp = glow(0xffffff, 0.1, 0);
    scene.add(sp);
    steam.push({ sp, o: i / 8 });
  }

  // The characters.
  const meera = buildPerson("Meera", { seated: true, skin: 0x8d5a3b, shirt: 0xd9a441, pants: 0x3a3a44, apron: 0x3c5a7a, hair: 0x211612, bun: true });
  const arjun = buildPerson("Arjun", { seated: false, skin: 0xc08a63, shirt: 0x6b7a3f, pants: 0x4a3b30, apron: 0xc9b79a, hair: 0x1c1310 });
  const lena = buildPerson("Lena", { seated: true, skin: 0xe0b89a, shirt: 0xd98f8f, pants: 0x2f3a4a, apron: 0x4a4a4a, hair: 0x7a3b22, bun: true });
  scene.add(at(meera.root, 1.3, 0, 0.2), at(arjun.root, -1.6, 0, -0.3));
  at(lena.root, 2.95, 0, -1.6);
  lena.root.rotation.y = -PI / 2;
  scene.add(lena.root);
  const brush = new T.Group();
  brush.add(at(cyl(0.01, 0.012, 0.22, mat(0xb08a5a, 0.5), 8), 0, -0.08, 0), at(cyl(0.016, 0.004, 0.05, mat(0x2f4f86, 0.6), 8), 0, -0.21, 0));
  brush.position.y = -0.3;
  brush.rotation.x = 0.6;
  brush.traverse((n) => {
    n.userData.character = "Lena";
  });
  lena.arms.R.el.add(brush);
  const cat = buildCat("Biscuit");
  cat.root.rotation.y = -0.6;
  scene.add(at(cat.root, -0.2, 0, 2.0));

  let meeraCycle = -1;
  let saidCollapse = false;
  let lastPush = 0;
  let lastSquish = 0;
  let mood: MoodState | null = null;

  // Made it fills the middle shelf from the middle outwards.
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
    characters: [
      { name: "Meera", anchor: meera.head, lift: 0.42 },
      { name: "Arjun", anchor: arjun.head, lift: 0.42 },
      { name: "Lena", anchor: lena.head, lift: 0.42 },
      { name: "Biscuit", anchor: cat.head, lift: 0.25 },
    ],
    talkers: ["Arjun", "Meera", "Lena"],
    lines: STUDIO_LINES,
    welcome: STUDIO_WELCOME,
    applyMood(cur) {
      mood = cur;
      lamps.forEach((l, i) => {
        l.light.intensity = cur.lamp * (i === 1 ? 1.1 : 1) * PI;
        l.halo.material.opacity = 0.12 + cur.lamp * 0.32;
        l.bulb.material.color.copy(bulbWarm).multiplyScalar(0.35 + cur.lamp * 0.45);
      });
    },
    update(t, dt, k, state, hooks) {
      // The wheel, and Meera throwing on it. Every third pot collapses.
      wheelHead.rotation.y += dt * 9;
      wheelPot.rotation.y += dt * 9;
      const cyc = Math.floor(t / 14);
      const u = t % 14;
      const collapse = cyc % 3 === 2;
      if (cyc !== meeraCycle) {
        meeraCycle = cyc;
        wheelPot.rotation.z = 0;
      }
      let sy: number;
      let sx: number;
      let lean = 0.32;
      let reach = 1.05;
      let inward = 0.32;
      let laugh = false;
      if (u < 3) {
        sy = 0.55;
        sx = 1.28 + 0.04 * Math.sin(u * 6);
      } else if (u < 10) {
        const q = (u - 3) / 7;
        const e = q * q * (3 - 2 * q);
        sy = 0.55 + 0.85 * e;
        sx = 1.28 - 0.42 * e;
        reach = 1.05 + 0.28 * e;
      } else {
        sy = 1.4;
        sx = 0.86;
        reach = 1.3;
        if (collapse && u > 10.4) {
          sy = 0.42;
          sx = 1.5;
          lean = -0.08;
          reach = 0.55;
          inward = 0.1;
          laugh = true;
          wheelPot.rotation.z = damp(wheelPot.rotation.z, 0.35, k);
        } else {
          reach = 0.85;
          lean = 0.1;
        }
      }
      if (collapse && u > 10.4 && !saidCollapse) {
        saidCollapse = true;
        if (state.entered) {
          hooks.thud();
          hooks.say("Meera", COLLAPSE_LINE);
        }
      }
      if (u < 1) saidCollapse = false;
      wheelPot.scale.x = damp(wheelPot.scale.x, sx, k * 0.8);
      wheelPot.scale.z = wheelPot.scale.x;
      wheelPot.scale.y = damp(wheelPot.scale.y, sy, k * 0.8);
      const press = u < 10 ? Math.sin(t * 4.4) * 0.06 : 0;
      meera.spine.rotation.x = damp(meera.spine.rotation.x, lean + press * 0.4, k);
      (["L", "R"] as const).forEach((s, i) => {
        const a = meera.arms[s];
        const sg = i ? -1 : 1;
        a.sh.rotation.x = damp(a.sh.rotation.x, -(reach + press), k);
        a.sh.rotation.z = damp(a.sh.rotation.z, sg * inward, k);
        a.el.rotation.x = damp(a.el.rotation.x, laugh ? -1.2 : -0.55, k);
      });
      meera.head.rotation.x = damp(meera.head.rotation.x, laugh ? -0.25 : 0.25, k);
      meera.head.rotation.z = laugh ? Math.sin(t * 16) * 0.08 : damp(meera.head.rotation.z, 0, k);
      if (u < 10 && t - lastSquish > 1.4 + Math.random() * 0.6 && state.entered) {
        lastSquish = t;
        hooks.squish(0.35, 0.12);
      }

      // Arjun wedging clay, with a rest every 12 seconds.
      const resting = t % 12 > 9;
      const p = (Math.sin((t * 2 * PI) / 1.5) + 1) / 2;
      arjun.spine.rotation.x = damp(arjun.spine.rotation.x, resting ? 0.04 : 0.22 + 0.3 * p, k);
      (["L", "R"] as const).forEach((s, i) => {
        const a = arjun.arms[s];
        const sg = i ? -1 : 1;
        a.sh.rotation.x = damp(a.sh.rotation.x, resting ? -0.15 : -(0.75 + 0.5 * p), k);
        a.sh.rotation.z = damp(a.sh.rotation.z, resting ? sg * 0.08 : sg * 0.28, k);
        a.el.rotation.x = damp(a.el.rotation.x, resting ? -0.3 : -0.35 - 0.25 * (1 - p), k);
      });
      arjun.head.rotation.y = damp(arjun.head.rotation.y, resting ? 0.55 : 0, k * 0.6);
      arjun.head.rotation.x = damp(arjun.head.rotation.x, resting ? 0 : 0.35, k);
      wedgeClay.scale.y = damp(wedgeClay.scale.y, resting ? 1 : 1 - 0.2 * p, k);
      wedgeClay.scale.z = damp(wedgeClay.scale.z, resting ? 1 : 1 + 0.14 * p, k);
      if (!resting && p > 0.97 && t - lastPush > 1 && state.entered) {
        lastPush = t;
        hooks.squish(-0.4, 0.16);
      }

      // Lena glazing a jar.
      lena.spine.rotation.x = damp(lena.spine.rotation.x, 0.28, k);
      lena.arms.R.sh.rotation.x = -1.05 + Math.sin(t * 2.6) * 0.08;
      lena.arms.R.sh.rotation.z = -0.15 + Math.sin(t * 1.3) * 0.12;
      lena.arms.R.el.rotation.x = -0.75;
      lena.arms.L.sh.rotation.x = -0.85;
      lena.arms.L.sh.rotation.z = 0.32;
      lena.arms.L.el.rotation.x = -0.35;
      lena.head.rotation.z = Math.sin(t * 0.5) * 0.1;
      lena.head.rotation.x = 0.3;
      glazingPot.rotation.y += dt * 0.25;

      // The cat breathes.
      cat.body.scale.y = 0.62 + Math.sin(t * 1.6) * 0.02;
      cat.tail.rotation.z = Math.sin(t * 0.7) * 0.15;
      cat.head.rotation.z = -0.2 + (Math.sin(t * 0.3) > 0.97 ? Math.sin(t * 30) * 0.05 : 0);

      lamps.forEach((l, i) => {
        l.arm.rotation.z = state.reducedMotion ? 0 : Math.sin(t * 0.6 + i) * 0.012;
      });
      const kilnHeat = mood ? mood.kiln : 0.7;
      kilnGlow.material.opacity = kilnHeat * (0.5 + Math.sin(t * 3.1) * 0.05 + Math.sin(t * 7.3) * 0.04);
      const night = mood ? mood.rain > 0.3 : false;
      for (const st of steam) {
        const ph = (t * 0.22 + st.o) % 1;
        st.sp.position.set(-2.35 + Math.sin(ph * 6 + st.o * 9) * 0.035, 1.07 + ph * 0.5, 0.75);
        st.sp.scale.setScalar(0.07 + ph * 0.2);
        st.sp.material.opacity = Math.sin(ph * PI) * 0.16 * (night ? 0.6 : 1);
      }
    },
  };
}
