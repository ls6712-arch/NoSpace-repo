import * as T from "three";
import { PI, at, box, canvasTex, css, cyl, disposeTree, glow, mat, mesh, sph } from "./kit";
import { HAIR_TONES, SKIN_TONES, WARDROBE, loadCast, type Body, type Cast, type Character, type Look } from "./townCast";
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
  const trees: [number, number][] = [[-12, -6], [-11, 4], [-9, 9], [-3, 12.5], [4, 12.5], [11, 7], [12.5, -3], [10, -9], [3, -12.5], [-5, -12], [-12.8, -1], [0, -13.5]];
  trees.forEach(([x, z], i) => {
    ground.add(at(cyl(0.16, 0.22, 1.4, wood, 6), x, 0.7, z));
    const crown = mesh(new T.IcosahedronGeometry(1 + (i % 3) * 0.25, 0), leaves[i % 2]);
    ground.add(at(crown, x, 2.1 + (i % 3) * 0.2, z));
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
  ground.add(at(box(0.4, 0.26, 0.28, mat(0xb98a4e)), pic.x + 0.6, 0.92, pic.z));

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

    // Picnic: four friends at the table, a Shiba doing laps around them.
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
    const shiba = add(cast.dog("shiba", { bandana: W.red }));
    const shibaHome = { x: pic.x + 2.2, z: pic.z + 1.6 };
    let shibaMode = "";
    ticks.push((t) => {
      diners.forEach((c, i) => laugh(c, t, i * 1.7));
      const u = t % 22;
      let mode: "Idle_2_HeadLow" | "Gallop" | "Eating";
      if (u < 7) mode = "Idle_2_HeadLow";
      else if (u < 13) mode = "Gallop";
      else mode = "Eating";
      if (mode !== shibaMode) {
        shiba.play(mode, { fade: 0.5 });
        shibaMode = mode;
      }
      if (mode === "Gallop") {
        const a = ((u - 7) / 6) * PI * 2;
        shiba.root.position.set(shibaHome.x - 1.8 + Math.cos(a) * 1.8, 0, shibaHome.z + Math.sin(a) * 1.8);
        shiba.root.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a));
      } else {
        shiba.root.position.set(shibaHome.x, 0, shibaHome.z);
        shiba.root.rotation.y = -0.6;
      }
    });

    // Chess.
    const players = [-1, 1].map((sd, i) => {
      const c = add(cast.person(dress(i ? "oldclassy-male" : "casual3-female")));
      seat(c, ch.x + sd * 0.95, ch.z, 0.45);
      facing(c.root, ch.x, ch.z);
      return c;
    });
    ticks.push((t) => laugh(players[1], t, 2));

    // The painter.
    const painter = add(cast.person(dress("casual2-female", { top: W.cream, stub: true })));
    painter.root.position.set(pa.x - 0.55, 0, pa.z + 1.1);
    facing(painter.root, pa.x, pa.z);
    ticks.push((t) => {
      const arm = painter.bone("UpperArm.R");
      if (arm) arm.rotation.z += Math.sin(t * 1.6) * 0.12;
    });

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
