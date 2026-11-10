import * as T from "three";
import { PI, at, box, canvasTex, css, cyl, disposeTree, glow, mat, mesh, sph } from "./kit";
import { HAIR_TONES, SKIN_TONES, WARDROBE, loadCast, type Body, type Cast, type Character, type Look, type Plant } from "./townCast";
import { easeMood, moodState, type MoodName, type MoodState } from "./moods";
import { rng } from "./layout";
import { TOWN_CAMERAS, type TownCamera, type TownMotion, type TownView } from "./townViews";

/**
 * The town behind every page: a small park where characters picnic, run a
 * first 5k, paint, play chess, stretch, play guitar and meet up at the
 * fountain. It is atmosphere, not content: nothing here is real people, and
 * nothing is counted, tapped or read by a screen reader.
 *
 * Built to stay out of the way. It caps itself at 30 frames a second, stops
 * when the tab is hidden, draws a single still frame under reduced motion, and
 * drops shadows and resolution on small screens. Loaded only on demand, so
 * three.js never reaches the first download.
 */

export interface TownOptions {
  small: boolean;
  motion: TownMotion;
  view: TownView;
  /** "light" uses morning light, "dark" golden hour. */
  theme: "light" | "dark";
  /** Where the character models live (public/world/town). */
  assetBase: string;
  onLost(): void;
}

export interface Town {
  setView(view: TownView): void;
  setTheme(theme: "light" | "dark"): void;
  setMotion(motion: TownMotion): void;
  dispose(): void;
}

/** Every animated part of the town is a function of time, so a still frame is just `tick(t)` once. */
type Tick = (t: number, dt: number) => void;

/** Light pages get morning light; dark pages get golden hour, which keeps the park readable (full night is too dark to see). */
const moodFor = (theme: "light" | "dark"): MoodName => (theme === "dark" ? "golden" : "morning");

export function createTown(container: HTMLElement, opts: TownOptions): Town {
  const { small } = opts;
  let motion = opts.motion;
  const renderer = new T.WebGLRenderer({ antialias: !small, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1 : 1.5));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = !small;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  container.appendChild(canvas);

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.5, 200);
  const r = rng(7);
  const pick = <V>(a: readonly V[]) => a[Math.floor(r() * a.length)];
  const ticks: Tick[] = [];

  // Sky and light, eased between morning and evening when the theme changes.
  const mood: MoodState = moodState(moodFor(opts.theme));
  let moodTarget: MoodState = moodState(moodFor(opts.theme));
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 4;
  skyCanvas.height = 256;
  const skyTex = new T.CanvasTexture(skyCanvas);
  skyTex.colorSpace = T.SRGBColorSpace;
  scene.background = skyTex;
  scene.fog = new T.Fog(0xffffff, 42, 100);
  const hemi = new T.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new T.DirectionalLight(0xffffff, 1);
  sun.position.set(10, 18, 8);
  if (!small) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
  }
  scene.add(hemi, sun);
  const lampGlows: T.Sprite[] = [];

  function paintMood() {
    const g = skyCanvas.getContext("2d");
    if (g) {
      const grad = g.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, "#" + mood.skyTop.getHexString());
      grad.addColorStop(1, "#" + mood.skyBottom.getHexString());
      g.fillStyle = grad;
      g.fillRect(0, 0, 4, 256);
      skyTex.needsUpdate = true;
    }
    (scene.fog as T.Fog).color.copy(mood.skyBottom);
    hemi.color.copy(mood.hemiSky);
    hemi.groundColor.copy(mood.hemiGround);
    hemi.intensity = mood.hemiI * 2.2;
    sun.color.copy(mood.sun);
    sun.intensity = mood.sunI * 0.9;
    renderer.toneMappingExposure = mood.exposure;
    for (const s of lampGlows) s.material.opacity = Math.min(1, mood.lamp * 0.5);
  }

  // ---- The park ----
  const grass = mat(0x8fb27a, 0.95);
  const pave = mat(0xddd0ba, 0.9);
  const path = mat(0xcdae84, 0.95);
  const wood = mat(0x8a5e3c, 0.8);
  const leaves = [mat(0x5e8f5a, 0.9), mat(0x7fa96a, 0.9)];
  const ground = new T.Group();
  scene.add(ground);
  ground.add(at(cyl(15, 14, 1.2, grass, 48), 0, -0.6, 0));
  ground.add(at(cyl(5.6, 5.6, 0.06, pave, 48), 0, 0.03, 0));
  const ring = mesh(new T.RingGeometry(8.6, 9.8, 64), path);
  ring.rotation.x = -PI / 2;
  ground.add(at(ring, 0, 0.035, 0));
  // Simple trees stand in until the real ones arrive with the characters.
  const simpleTrees = new T.Group();
  ground.add(simpleTrees);
  const trees: [number, number][] = [[-12.5, -5], [-10, -9], [-5.5, -12.5], [-1, -13.5], [3.5, -13], [7.5, -11.5], [12.5, -3.5], [10.6, -9.6], [-7.8, -11.4], [-13, 2], [-12, 8.5]];
  trees.forEach(([x, z], i) => {
    simpleTrees.add(at(cyl(0.16, 0.22, 1.4, wood, 6), x, 0.7, z));
    const crown = mesh(new T.IcosahedronGeometry(1 + (i % 3) * 0.25, 0), leaves[i % 2]);
    simpleTrees.add(at(crown, x, 2.1 + (i % 3) * 0.2, z));
  });
  for (const [x, z] of [[4, 4.6], [-4.4, -4.2], [6.4, -3], [-6.6, 1]] as const) {
    ground.add(at(cyl(0.05, 0.07, 2.4, mat(0x2b3550, 0.6), 8), x, 1.2, z));
    ground.add(at(sph(0.16, mat(0xfff2cc, 0.4), 12, 10), x, 2.45, z));
    const g = glow(0xffd58a, 2.2, 0);
    ground.add(at(g, x, 2.45, z));
    lampGlows.push(g);
  }
  ground.add(at(cyl(1.4, 1.5, 0.5, pave, 24), 0, 0.25, 0));
  ground.add(at(cyl(1.2, 1.2, 0.05, mat(0x7fb6d6, 0.2), 24), 0, 0.48, 0));
  ground.add(at(cyl(0.14, 0.2, 1.1, pave, 10), 0, 0.8, 0));

  // ---- Props: built at once, so the park looks finished before anyone arrives ----
  // Picnic table with a gingham cloth.
  const pic = { x: -6.2, z: 3.4 };
  const gingham = canvasTex(64, 64, (g) => {
    g.fillStyle = css(0xfff8ec);
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = css(WARDROBE.red, 0.55);
    for (let i = 0; i < 8; i += 2) {
      g.fillRect(i * 8, 0, 8, 64);
      g.fillRect(0, i * 8, 64, 8);
    }
  });
  gingham.colorSpace = T.SRGBColorSpace;
  ground.add(at(mesh(new T.BoxGeometry(2.4, 0.06, 1.1), new T.MeshStandardMaterial({ map: gingham, roughness: 0.95 })), pic.x, 0.76, pic.z));
  for (const dx of [-1, 1]) ground.add(at(box(0.08, 0.74, 0.9, wood), pic.x + dx * 1, 0.37, pic.z));
  for (const dz of [-1, 1]) {
    ground.add(at(box(2.4, 0.07, 0.34, wood), pic.x, 0.45, pic.z + dz * 0.8));
    for (const dx of [-1, 1]) ground.add(at(box(0.07, 0.42, 0.07, wood), pic.x + dx * 1, 0.21, pic.z + dz * 0.8));
  }
  // Lunch: a basket, plates, fruit, bread, lemonade, and a game of cards mid-hand.
  const top = 0.79;
  ground.add(at(box(0.4, 0.26, 0.28, mat(0xb98a4e)), pic.x + 0.9, top + 0.13, pic.z));
  const plate = mat(0xf7f2e8, 0.6);
  for (const [dx, dz] of [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]] as const) ground.add(at(cyl(0.13, 0.11, 0.02, plate, 16), pic.x + dx, top + 0.01, pic.z + dz));
  ground.add(at(cyl(0.16, 0.1, 0.08, mat(0x8a5e3c, 0.7), 16), pic.x - 0.05, top + 0.04, pic.z));
  ([[0xc8332b, -0.08, 0.02], [0xf2b42a, 0.03, -0.04], [0x7fa96a, 0.05, 0.05], [0xd9773a, -0.02, -0.06]] as const).forEach(([c, dx, dz]) => ground.add(at(sph(0.05, mat(c, 0.5), 10, 8), pic.x - 0.05 + dx, top + 0.11, pic.z + dz)));
  const loaf = sph(0.12, mat(0xc99a55, 0.8), 14, 10);
  loaf.scale.set(1.6, 0.6, 0.8);
  ground.add(at(loaf, pic.x + 0.35, top + 0.05, pic.z + 0.02));
  ground.add(at(cyl(0.05, 0.06, 0.26, mat(0xf2d27a, 0.2), 12), pic.x - 0.35, top + 0.13, pic.z - 0.05));
  for (const [dx, dz] of [[-0.3, -0.22], [0.25, 0.24]] as const) ground.add(at(cyl(0.035, 0.03, 0.09, mat(0xffffff, 0.3), 10), pic.x + dx, top + 0.045, pic.z + dz));
  const cardMat = mat(0xfff8ec, 0.7);
  for (let i = 0; i < 5; i++) {
    const card = box(0.07, 0.004, 0.1, cardMat);
    card.rotation.y = (i - 2) * 0.35;
    ground.add(at(card, pic.x + 0.2 + i * 0.03, top + 0.003 + i * 0.002, pic.z - 0.05));
  }

  // Chess table and stools.
  const ch = { x: 5.6, z: 4.2 };
  ground.add(at(cyl(0.55, 0.55, 0.06, wood, 16), ch.x, 0.75, ch.z));
  ground.add(at(cyl(0.08, 0.12, 0.75, wood, 8), ch.x, 0.37, ch.z));
  const board = canvasTex(64, 64, (g) => {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      g.fillStyle = css((i + j) % 2 ? 0x3b2a20 : 0xefe6d6);
      g.fillRect(i * 8, j * 8, 8, 8);
    }
  });
  ground.add(at(mesh(new T.BoxGeometry(0.6, 0.02, 0.6), new T.MeshStandardMaterial({ map: board, roughness: 0.8 })), ch.x, 0.79, ch.z));
  for (const sd of [-1, 1]) ground.add(at(cyl(0.22, 0.22, 0.45, wood, 10), ch.x + sd * 0.95, 0.22, ch.z));

  // Easel.
  const pa = { x: -3.8, z: -6.6 };
  const easel = new T.Group();
  easel.position.set(pa.x, 0, pa.z);
  easel.rotation.y = 0.5;
  easel.add(at(box(0.06, 1.8, 0.06, wood), -0.3, 0.9, 0), at(box(0.06, 1.8, 0.06, wood), 0.3, 0.9, 0));
  const art = canvasTex(64, 80, (g) => {
    g.fillStyle = css(0xfff8ec);
    g.fillRect(0, 0, 64, 80);
    for (const [c, x, y, rad] of [[0x6fa3c9, 20, 25, 22], [0xf2b42a, 44, 30, 14], [0x5e8f5a, 30, 60, 24]] as const) {
      g.globalAlpha = 0.75;
      g.fillStyle = css(c);
      g.beginPath();
      g.arc(x, y, rad, 0, 7);
      g.fill();
    }
  });
  easel.add(at(mesh(new T.BoxGeometry(0.9, 1.1, 0.05), new T.MeshStandardMaterial({ map: art, roughness: 0.9 })), 0, 1.4, 0.05));
  ground.add(easel);

  // Finish arch on the running loop.
  const R = 9.2;
  const arch = new T.Group();
  arch.position.set(R, 0, 0);
  arch.add(at(box(0.18, 2.8, 0.18, wood), 0, 1.4, -0.75), at(box(0.18, 2.8, 0.18, wood), 0, 1.4, 0.75), at(box(0.2, 0.45, 1.8, mat(WARDROBE.yellow)), 0, 2.75, 0));
  ground.add(arch);

  // Yoga mat.
  const yo = { x: 6.4, z: -5.6 };
  ground.add(at(box(0.8, 0.03, 1.9, mat(0x6fa3c9, 0.95)), yo.x, 0.02, yo.z));

  // Guitar bench.
  const bench = new T.Group();
  bench.position.set(-9, 0, -2.8);
  bench.rotation.y = 1.2;
  bench.add(at(box(2.2, 0.1, 0.6, wood), 0, 0.45, 0), at(box(0.1, 0.45, 0.5, wood), -0.95, 0.22, 0), at(box(0.1, 0.45, 0.5, wood), 0.95, 0.22, 0));
  ground.add(bench);

  // ---- Characters, once their models arrive ----
  const actors: { update(dt: number): void }[] = [];
  let disposed = false;
  const W = WARDROBE;
  const tops = [W.red, W.yellow, W.navy, W.sage, W.cream, W.denim, W.plum];
  const bottoms = [W.navy, W.charcoal, W.denim, W.cream, W.sage];
  const dress = (body: Body, o: Partial<Look> = {}): Look => ({ body, skin: pick(SKIN_TONES), top: pick(tops), bottom: pick(bottoms), hair: pick(HAIR_TONES), accent: pick([W.navy, W.charcoal, W.sage]), ...o });

  function populate(cast: Cast) {
    const add = <A extends { root: T.Group; update(dt: number): void }>(a: A): A => {
      scene.add(a.root);
      actors.push(a);
      return a;
    };
    const facing = (o: T.Object3D, x: number, z: number) => {
      o.rotation.y = Math.atan2(x - o.position.x, z - o.position.z);
    };
    /** Seats a character so their hips rest on a surface `seatY` high. */
    const seat = (c: Character, x: number, z: number, seatY: number) => {
      c.sit();
      c.root.position.set(x, 0, z);
      c.root.updateMatrixWorld(true);
      const hips = c.bone("Hips");
      const hy = hips ? hips.getWorldPosition(new T.Vector3()).y : 0.5;
      c.root.position.y = seatY - hy + 0.12;
    };
    /** A laugh every few seconds: head back, a little shake. Applied on top of the move. */
    const laugh = (c: Character, t: number, phase: number) => {
      const head = c.bone("Head");
      if (!head) return;
      const k = Math.pow(Math.max(0, Math.sin(t * 0.9 + phase)), 6);
      head.rotation.x -= 0.3 * k + Math.sin(t * 9) * 0.04 * k;
    };

    // Picnic: four friends at the table, lunch and a game of cards.
    const diners = [
      seatAt(dress("casual-female", { stub: true }), -0.55, -1),
      seatAt(dress("casual2-male"), 0.55, -1),
      seatAt(dress("oldclassy-female"), -0.55, 1),
      seatAt(dress("casual3-male", { stub: true }), 0.55, 1),
    ];
    function seatAt(l: Look, dx: number, side: number) {
      const c = add(cast.person(l));
      seat(c, pic.x + dx, pic.z + side * 0.8, 0.49);
      c.root.rotation.y = side > 0 ? PI : 0;
      return c;
    }
    ticks.push((t) => diners.forEach((c, i) => laugh(c, t, i * 1.7)));

    // Chess.
    const players = [-1, 1].map((sd, i) => {
      const c = add(cast.person(dress(i ? "oldclassy-male" : "casual3-female")));
      seat(c, ch.x + sd * 0.95, ch.z, 0.45);
      facing(c.root, ch.x, ch.z);
      return c;
    });
    ticks.push((t) => laugh(players[1], t, 2));

    const handPos = (c: Character, out: T.Vector3) => {
      const fist = c.bone("Fist.R");
      return fist ? fist.getWorldPosition(out) : out.copy(c.root.position).setY(1.1);
    };
    const tmpA = new T.Vector3();
    const tmpB = new T.Vector3();

    // Fetch: someone throws a ball, the Shiba races out, brings it back, and they go again.
    const thrower = add(cast.person(dress("casual-male", { top: W.yellow, stub: true })));
    const fetchHome = new T.Vector3(-9.6, 0, 6.8);
    const fetchTarget = new T.Vector3(-4.8, 0, 9.8);
    thrower.root.position.copy(fetchHome);
    facing(thrower.root, fetchTarget.x, fetchTarget.z);
    const shiba = add(cast.dog("shiba", { bandana: W.red }));
    const dogHome = fetchHome.clone().add(new T.Vector3(0.9, 0, 0.5));
    const ball = sph(0.07, mat(W.yellow, 0.5), 12, 10);
    scene.add(ball);
    const ballRest = dogHome.clone().add(new T.Vector3(-0.4, 0.07, 0.1));
    const toward = (from: T.Vector3, to: T.Vector3) => Math.atan2(to.x - from.x, to.z - from.z);
    ticks.push((t) => {
      const k = t % 10;
      // The person.
      if (k < 0.7) thrower.play("Punch", { fromStart: true, fade: 0.15, speed: 1.2 });
      else if (k > 5.6 && k < 6.9) thrower.play("PickUp", { fromStart: true, fade: 0.25 });
      else thrower.play("Idle", { fade: 0.3 });
      // The dog.
      const out = (a: number, b: number) => Math.min(1, Math.max(0, (k - a) / (b - a)));
      if (k < 0.6 || k >= 5.3) {
        shiba.play("Idle_2_HeadLow", { fade: 0.4 });
        shiba.root.position.copy(dogHome);
        shiba.root.rotation.y = toward(dogHome, fetchTarget);
      } else if (k < 2.6) {
        shiba.play("Gallop", { fade: 0.25 });
        shiba.root.position.lerpVectors(dogHome, fetchTarget, out(0.6, 2.6));
        shiba.root.rotation.y = toward(dogHome, fetchTarget);
      } else if (k < 3.3) {
        shiba.play("Eating", { fade: 0.2 });
        shiba.root.position.copy(fetchTarget);
      } else {
        shiba.play("Gallop", { fade: 0.25 });
        shiba.root.position.lerpVectors(fetchTarget, dogHome, out(3.3, 5.3));
        shiba.root.rotation.y = toward(fetchTarget, dogHome);
      }
      // The ball.
      if (k < 0.45 || k > 6.4) ball.position.copy(handPos(thrower, tmpA));
      else if (k < 1.45) {
        const f = out(0.45, 1.45);
        handPos(thrower, tmpA);
        ball.position.lerpVectors(tmpA, tmpB.copy(fetchTarget).setY(0.07), f);
        ball.position.y += Math.sin(f * PI) * 2.4;
      } else if (k < 2.9) ball.position.copy(fetchTarget).setY(0.07);
      else if (k < 5.3) {
        const fwd = new T.Vector3(Math.sin(shiba.root.rotation.y), 0, Math.cos(shiba.root.rotation.y));
        ball.position.copy(shiba.root.position).addScaledVector(fwd, 0.48).setY(0.32);
      } else ball.position.copy(ballRest);
    });

    // Frisbee on the lawn.
    const flyers = [add(cast.person(dress("casual2-female", { top: W.denim }))), add(cast.person(dress("casual3-male", { top: W.red })))];
    flyers[0].root.position.set(-1.6, 0, 11.6);
    flyers[1].root.position.set(4.6, 0, 11);
    facing(flyers[0].root, 4.6, 11);
    facing(flyers[1].root, -1.6, 11.6);
    const disc = cyl(0.15, 0.15, 0.025, mat(W.yellow, 0.4), 20);
    scene.add(disc);
    const HALF = 2.8;
    ticks.push((t) => {
      const u = t % (HALF * 2);
      const from = flyers[u < HALF ? 0 : 1];
      const to = flyers[u < HALF ? 1 : 0];
      const k = u % HALF;
      from.play(k < 0.6 ? "Punch" : "Idle", { fromStart: k < 0.6, fade: 0.15, speed: 1.2 });
      to.play(k > 1.35 && k < 2.1 ? "Victory" : "Idle", { fromStart: k > 1.35 && k < 2.1, fade: 0.2, speed: 1.4 });
      if (k < 0.35) disc.position.copy(handPos(from, tmpA));
      else if (k < 1.6) {
        const f = (k - 0.35) / 1.25;
        handPos(from, tmpA);
        handPos(to, tmpB);
        disc.position.lerpVectors(tmpA, tmpB, f);
        disc.position.y = 1.3 + Math.sin(f * PI) * 1.3;
        disc.rotation.y += 0.5;
      } else disc.position.copy(handPos(to, tmpA));
    });

    // Two painters: one at the easel by the path, one seated out on the grass.
    const brush = () => {
      const g = new T.Group();
      g.add(at(cyl(0.012, 0.012, 0.24, mat(0x8a5e3c, 0.6), 6), 0, 0.06, 0));
      g.add(at(cyl(0.016, 0.006, 0.05, mat(W.red, 0.6), 6), 0, 0.2, 0));
      return g;
    };
    const palette = () => {
      const g = new T.Group();
      const board = cyl(0.13, 0.13, 0.012, mat(0xd9b58a, 0.7), 18);
      board.scale.z = 0.75;
      g.add(board);
      ([[W.red, -0.06, 0.02], [W.yellow, 0, -0.04], [0x6fa3c9, 0.06, 0.02], [0x7fa96a, 0.02, 0.05]] as const).forEach(([c, x, z]) => g.add(at(sph(0.022, mat(c, 0.4), 8, 6), x, 0.012, z)));
      g.rotation.x = PI / 2;
      return g;
    };
    const painter = add(cast.person(dress("casual2-female", { top: W.cream, stub: true })));
    painter.root.position.set(pa.x - 0.55, 0, pa.z + 1.1);
    facing(painter.root, pa.x, pa.z);
    painter.hold("Fist.R", brush());
    painter.hold("Fist.L", palette());
    const easel2 = easel.clone();
    easel2.position.set(10.6, 0, -6.4);
    easel2.rotation.y = -2.4;
    scene.add(easel2);
    const stool = cyl(0.2, 0.2, 0.45, wood, 10);
    scene.add(at(stool, 11.3, 0.22, -5.6));
    const painter2 = add(cast.person(dress("oldclassy-male", { top: W.sage })));
    seat(painter2, 11.3, -5.6, 0.45);
    facing(painter2.root, easel2.position.x, easel2.position.z);
    painter2.hold("Fist.R", brush());
    ticks.push((t) => {
      for (const [p, ph] of [[painter, 0], [painter2, 2]] as const) {
        const arm = p.bone("UpperArm.R");
        if (arm) arm.rotation.z += Math.sin(t * 1.6 + ph) * 0.18;
      }
    });

    // The real trees, bushes and flowers replace the stand-ins.
    simpleTrees.removeFromParent();
    const kinds: Plant[] = ["roundTree", "pine", "birch", "tallTree", "pine", "roundTree", "birch", "tallTree", "roundTree", "birch", "pine"];
    trees.forEach(([x, z], i) => {
      const p = cast.plant(kinds[i % kinds.length]);
      p.position.set(x, 0, z);
      p.rotation.y = r() * PI * 2;
      p.scale.setScalar(0.85 + r() * 0.3);
      scene.add(p);
    });
    const shrubs: [Plant, number, number][] = [
      ["flowerBush", 7.5, 12], ["bush", -6.8, 12.6], ["bush", 9.8, 9.6], ["flowerBush", 12.6, 5.2], ["flowerBush", 13.4, 1.2], ["flowerBush", -13.6, -1.8], ["bush", 5.5, -10.6], ["bush", -8.2, -10.8], ["flowerBush", 11.2, 8.2],
    ];
    for (const [kind, x, z] of shrubs) {
      const p = cast.plant(kind);
      p.position.set(x, 0, z);
      p.rotation.y = r() * PI * 2;
      scene.add(p);
    }
    // Flowers round the plaza and tufts of grass across the lawns. Fewer on small screens.
    const tufts = small ? 18 : 40;
    for (let i = 0; i < tufts; i++) {
      const a = r() * PI * 2;
      const rad = r() < 0.5 ? 6 + r() * 2.3 : 10.3 + r() * 4;
      const kind: Plant = i % 3 === 0 ? (i % 2 ? "flowersPink" : "flowersYellow") : "grass";
      const p = cast.plant(kind);
      p.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
      p.rotation.y = r() * PI * 2;
      scene.add(p);
    }

    // Runners on the loop and a friend cheering at the finish.
    const runners = [add(cast.person(dress("casual-male", { top: W.navy }))), add(cast.person(dress("casual3-female", { top: W.red })))];
    runners.forEach((r) => r.play("Run"));
    const fan = add(cast.person(dress("casual2-male", { top: W.sage, stub: true })));
    fan.root.position.set(R + 1.8, 0, 1.6);
    facing(fan.root, R, 0);
    let lastCheer = -99;
    let fanCheering = false;
    ticks.push((t) => {
      runners.forEach((r, i) => {
        const ang = t * 0.16 + i * 0.35;
        const rr = R + (i ? 0.45 : -0.45);
        r.root.position.set(Math.cos(ang) * rr, 0, Math.sin(ang) * rr);
        r.root.rotation.y = Math.atan2(-Math.sin(ang), Math.cos(ang));
        if (Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) < 0.15) lastCheer = t;
      });
      const cheering = t - lastCheer < 2.6;
      if (cheering !== fanCheering) {
        fan.play(cheering ? "Victory" : "Idle", { fade: 0.3 });
        fanCheering = cheering;
      }
    });

    // Meeting up at the fountain: a friend walks their husky round, comes back, and they all celebrate.
    const ga = -2.2;
    const GR = 2.9;
    const friends = [add(cast.person(dress("casual-female"))), add(cast.person(dress("oldclassy-male")))];
    friends.forEach((c, i) => {
      const a = ga + (i ? 0.42 : -0.42);
      c.root.position.set(Math.cos(a) * (GR + 0.4), 0, Math.sin(a) * (GR + 0.4));
      facing(c.root, Math.cos(ga) * GR, Math.sin(ga) * GR);
    });
    const walker = add(cast.person(dress("casual3-male", { top: W.plum, stub: true })));
    const husky = add(cast.dog("husky", { bandana: W.yellow }));
    let met = false;
    ticks.push((t) => {
      const u = (t % 20) / 20;
      const walking = u < 0.68;
      const ang = walking ? ga + 0.5 + (u / 0.68) * (PI * 2 - 1) : ga - 0.5 + PI * 2;
      walker.root.position.set(Math.cos(ang) * GR, 0, Math.sin(ang) * GR);
      const dogAng = walking ? ang - 0.28 : ang - 0.35;
      husky.root.position.set(Math.cos(dogAng) * (GR + 0.7), 0, Math.sin(dogAng) * (GR + 0.7));
      if (walking) {
        const heading = Math.atan2(-Math.sin(ang), Math.cos(ang));
        walker.root.rotation.y = heading;
        husky.root.rotation.y = heading;
      } else {
        facing(walker.root, friends[0].root.position.x, friends[0].root.position.z);
        facing(husky.root, friends[1].root.position.x, friends[1].root.position.z);
      }
      if (walking === met) {
        met = !walking;
        walker.play(met ? "Victory" : "Walk", { fade: 0.4, speed: met ? 0.8 : 1 });
        husky.play(met ? "Idle" : "Walk", { fade: 0.4 });
        friends.forEach((c) => c.play(met ? "Victory" : "Idle", { fade: 0.4, speed: 0.8 }));
      }
      if (!met) friends.forEach((c, i) => laugh(c, t, i));
    });

    // Yoga: a slow arms-up stretch.
    const yogi = add(cast.person(dress("casual-female", { top: W.yellow, bottom: W.charcoal })));
    yogi.root.position.set(yo.x, 0.03, yo.z);
    yogi.root.rotation.y = -0.6;
    yogi.play("Victory", { speed: 0.3 });

    // Guitar on a bench, a friend listening.
    const along = new T.Vector3(1, 0, 0).applyAxisAngle(new T.Vector3(0, 1, 0), bench.rotation.y);
    const duo = [-0.5, 0.5].map((d, i) => {
      const c = add(cast.person(dress(i ? "oldclassy-female" : "casual2-male")));
      seat(c, bench.position.x + along.x * d, bench.position.z + along.z * d, 0.5);
      c.root.rotation.y = bench.rotation.y;
      return c;
    });
    const guitar = new T.Group();
    const body = cyl(0.2, 0.2, 0.09, mat(0xb98a4e), 16);
    body.rotation.x = PI / 2;
    guitar.add(body, at(box(0.06, 0.04, 0.6, mat(0x5a3a24)), 0.36, 0.02, 0));
    guitar.position.set(0.05, 0.98, 0.3);
    guitar.rotation.set(0, 0, 0.35);
    duo[0].root.add(guitar);
    ticks.push((t) => laugh(duo[1], t, 4));
  }

  loadCast(opts.assetBase)
    .then((cast) => {
      if (disposed) return;
      populate(cast);
      // A still frame shows everyone mid-move, not frozen at the first frame.
      if (motion === "still") for (const a of actors) a.update(stillT);
      draw(undefined, 0);
    })
    .catch(() => {
      // The park still stands without its people.
    });

  // ---- Camera ----
  const cam: TownCamera = structuredClone(TOWN_CAMERAS[opts.view]);
  let goal: TownCamera = TOWN_CAMERAS[opts.view];
  const look = new T.Vector3();
  function placeCamera(t: number) {
    const drift = motion === "calm" ? Math.sin(t * 0.05) * 0.12 : 0;
    const a = cam.angle + drift;
    const narrow = container.clientWidth < 640 ? 1.35 : 1;
    look.set(...cam.target);
    camera.position.set(look.x + Math.sin(a) * cam.dist * narrow, look.y + cam.height * narrow, look.z + Math.cos(a) * cam.dist * narrow);
    camera.lookAt(look);
  }
  function easeCamera(k: number) {
    for (let i = 0; i < 3; i++) cam.target[i] += (goal.target[i] - cam.target[i]) * k;
    cam.dist += (goal.dist - cam.dist) * k;
    cam.height += (goal.height - cam.height) * k;
    cam.angle += (goal.angle - cam.angle) * k;
  }

  // ---- Loop ----
  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    draw();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const start = performance.now();
  let last = 0;
  let raf = 0;
  let stillT = 6; // the moment a still frame shows: everyone mid-activity
  function draw(t = motion === "still" ? stillT : (performance.now() - start) / 1000, dt = 0) {
    for (const a of actors) a.update(dt);
    for (const f of ticks) f(t, dt);
    placeCamera(t);
    renderer.render(scene, camera);
  }
  function frame(now: number) {
    raf = 0;
    if (document.hidden || motion === "still") return;
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / 30) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    easeCamera(1 - Math.exp(-dt * 1.6));
    easeMood(mood, moodTarget, 1 - Math.exp(-dt * 2));
    paintMood();
    draw(undefined, dt);
  }
  function run() {
    if (!raf && motion === "calm" && !document.hidden) raf = requestAnimationFrame(frame);
  }
  /** Under "still" there is no loop, so changes land at once. */
  function settle() {
    Object.assign(cam, structuredClone(goal));
    easeMood(mood, moodTarget, 1);
    paintMood();
    draw();
  }
  const onVisibility = () => run();
  document.addEventListener("visibilitychange", onVisibility);
  const onLost = (e: Event) => {
    e.preventDefault();
    opts.onLost();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  paintMood();
  resize();
  run();

  return {
    setView(view) {
      goal = TOWN_CAMERAS[view];
      if (motion === "still") settle();
    },
    setTheme(theme) {
      moodTarget = moodState(moodFor(theme));
      if (motion === "still") settle();
    },
    setMotion(m) {
      motion = m;
      if (m === "still") {
        stillT = (performance.now() - start) / 1000;
        settle();
      } else run();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      disposeTree(scene);
      skyTex.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
