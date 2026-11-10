import * as T from "three";
import { PI, at, box, canvasTex, css, cyl, disposeTree, glow, mat, mesh, sph } from "./kit";
import { buildPerson, type PersonRig } from "./characters";
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
  onLost(): void;
}

export interface Town {
  setView(view: TownView): void;
  setTheme(theme: "light" | "dark"): void;
  setMotion(motion: TownMotion): void;
  dispose(): void;
}

const SKIN = [0x8d5a3b, 0xc68a62, 0xe8b994, 0x5e3a26, 0xf1cba8, 0xa8704a];
const HAIR = [0x2a1d16, 0x4a2e1e, 0x1b1b22, 0x8a5a2b, 0x3b2a20];
const SHIRT = [0xc8332b, 0xf2b42a, 0x3b4c8a, 0x2e6e5e, 0xe6d8c3, 0xb85c8a, 0x6fa3c9, 0xd9773a];
const PANTS = [0x2b3550, 0x3e3a36, 0x5a6b7d, 0x7a6650];

interface Actor {
  rig: PersonRig;
  legs: [T.Object3D, T.Object3D];
}

/** Every animated part of the town is a function of time, so a still frame is just `tick(t)` once. */
type Tick = (t: number) => void;

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

  // ---- Characters ----
  function person(name: string, o: { seated?: boolean; shirt?: number } = {}): Actor {
    const shirt = o.shirt ?? pick(SHIRT);
    const rig = buildPerson(name, { seated: !!o.seated, skin: pick(SKIN), shirt, pants: pick(PANTS), apron: shirt, hair: pick(HAIR), bun: r() > 0.6 });
    const hips = rig.root.children[0];
    scene.add(rig.root);
    return { rig, legs: [hips.children[0], hips.children[1]] };
  }
  const place = (a: Actor, x: number, z: number, y = 0) => a.rig.root.position.set(x, y, z);
  const face = (a: Actor, x: number, z: number) => {
    const p = a.rig.root.position;
    a.rig.root.rotation.y = Math.atan2(x - p.x, z - p.z);
  };
  const walk = (a: Actor, t: number, speed: number) => {
    const s = Math.sin(t * speed) * 0.55;
    a.legs[0].rotation.x = s;
    a.legs[1].rotation.x = -s;
    a.rig.arms.L.sh.rotation.x = -s * 0.8;
    a.rig.arms.R.sh.rotation.x = s * 0.8;
    a.rig.spine.position.y = Math.abs(Math.cos(t * speed)) * 0.04;
  };
  const stand = (a: Actor) => {
    a.legs[0].rotation.x = 0;
    a.legs[1].rotation.x = 0;
    a.rig.spine.position.y = 0;
  };
  /** A laugh every few seconds: head back, a little shake. */
  const laugh = (a: Actor, t: number, phase: number) => {
    const k = Math.pow(Math.max(0, Math.sin(t * 0.9 + phase)), 6);
    a.rig.head.rotation.x = -0.35 * k + Math.sin(t * 9) * 0.04 * k;
    a.rig.spine.rotation.x = -0.08 * k;
  };

  // Picnic: three friends laughing on a blanket.
  const pic = { x: -6.2, z: 3.4 };
  ground.add(at(box(3, 0.04, 2.2, mat(0xc8332b, 0.95)), pic.x, 0.03, pic.z));
  ground.add(at(box(0.5, 0.35, 0.35, mat(0xb98a4e)), pic.x, 0.2, pic.z));
  ([[-0.95, -0.55], [0.95, -0.45], [0, 0.75]] as const).forEach(([dx, dz], i) => {
    const a = person("Picnic " + i, { seated: true });
    place(a, pic.x + dx, pic.z + dz, -0.44);
    face(a, pic.x, pic.z);
    ticks.push((t) => {
      laugh(a, t, i * 1.7);
      (i % 2 ? a.rig.arms.R : a.rig.arms.L).sh.rotation.x = -0.5 - 0.2 * Math.sin(t * 0.7 + i);
    });
  });

  // Chess at a small table.
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
  [-1, 1].forEach((sd, i) => {
    ground.add(at(cyl(0.22, 0.22, 0.45, wood, 10), ch.x + sd, 0.22, ch.z));
    const a = person("Chess " + i, { seated: true });
    place(a, ch.x + sd, ch.z, -0.1);
    face(a, ch.x, ch.z);
    ticks.push((t) => {
      const k = Math.max(0, Math.sin(t * 0.5 + i * PI));
      a.rig.arms.R.sh.rotation.x = -1.1 * k;
      a.rig.head.rotation.x = 0.25;
      if (i === 1) laugh(a, t, 2);
    });
  });

  // A painter at an easel.
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
  const painter = person("Painter", { shirt: 0xe6d8c3 });
  place(painter, pa.x - 0.55, pa.z + 1.1);
  face(painter, pa.x, pa.z);
  ticks.push((t) => {
    painter.rig.arms.R.sh.rotation.x = -1.25 + Math.sin(t * 1.6) * 0.15;
    painter.rig.arms.R.sh.rotation.z = Math.sin(t * 1.1) * 0.15;
    painter.rig.head.rotation.y = Math.sin(t * 0.3) * 0.2;
  });

  // Runners on the loop, a finish arch, and a friend who cheers them through.
  const R = 9.2;
  const arch = new T.Group();
  arch.position.set(R, 0, 0);
  arch.add(at(box(0.18, 2.8, 0.18, wood), 0, 1.4, -0.75), at(box(0.18, 2.8, 0.18, wood), 0, 1.4, 0.75), at(box(0.2, 0.45, 1.8, mat(0xf2b42a)), 0, 2.75, 0));
  ground.add(arch);
  const runners = [person("Runner 1", { shirt: 0x3b4c8a }), person("Runner 2", { shirt: 0xd9773a })];
  const fan = person("Friend at the finish", { shirt: 0x2e6e5e });
  place(fan, R + 1.8, 1.6);
  face(fan, R, 0);
  let lastCheer = -99;
  ticks.push((t) => {
    runners.forEach((a, i) => {
      const ang = t * 0.16 + i * 0.35;
      const rr = R + (i ? 0.45 : -0.45);
      place(a, Math.cos(ang) * rr, Math.sin(ang) * rr);
      a.rig.root.rotation.y = Math.atan2(-Math.sin(ang), Math.cos(ang));
      walk(a, t, 8.5);
      if (Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) < 0.18) {
        a.rig.arms.L.sh.rotation.x = -2.8;
        a.rig.arms.R.sh.rotation.x = -2.8;
        lastCheer = t;
      }
    });
    const k = Math.max(0, 1 - (t - lastCheer) / 2.5);
    fan.rig.arms.L.sh.rotation.x = -2.6 * k + (k > 0 ? Math.sin(t * 10) * 0.2 : 0);
    fan.rig.arms.R.sh.rotation.x = -2.6 * k + (k > 0 ? Math.sin(t * 10 + 1) * 0.2 : 0);
    fan.rig.spine.position.y = k * Math.abs(Math.sin(t * 6)) * 0.14;
  });

  // Meeting up at the fountain: a friend walks a lap, comes back, waves, everyone laughs.
  const ga = -2.2;
  const GR = 2.9;
  const group = [person("Friend 1"), person("Friend 2")];
  group.forEach((a, i) => {
    const ang = ga + (i ? 0.42 : -0.42);
    place(a, Math.cos(ang) * (GR + 0.4), Math.sin(ang) * (GR + 0.4));
    face(a, Math.cos(ga) * GR, Math.sin(ga) * GR);
  });
  const walker = person("Friend arriving", { shirt: 0xb85c8a });
  ticks.push((t) => {
    const u = (t % 18) / 18;
    const walking = u < 0.7;
    const ang = walking ? ga + 0.5 + (u / 0.7) * (PI * 2 - 1) : ga - 0.5 + PI * 2;
    place(walker, Math.cos(ang) * GR, Math.sin(ang) * GR);
    if (walking) {
      walker.rig.root.rotation.y = Math.atan2(-Math.sin(ang), Math.cos(ang));
      walk(walker, t, 6);
      walker.rig.arms.R.sh.rotation.z = 0;
    } else {
      const p = group[0].rig.root.position;
      face(walker, p.x, p.z);
      stand(walker);
      walker.rig.arms.L.sh.rotation.x = 0;
      walker.rig.arms.R.sh.rotation.x = -2.7;
      walker.rig.arms.R.sh.rotation.z = Math.sin(t * 7) * 0.3;
      laugh(walker, t * 2.5, 2);
    }
    group.forEach((a, i) => {
      const arm = i ? a.rig.arms.R : a.rig.arms.L;
      if (!walking) {
        laugh(a, t * 2.5, i);
        arm.sh.rotation.x = -0.6;
      } else {
        a.rig.head.rotation.x = 0;
        a.rig.spine.rotation.x = 0;
        arm.sh.rotation.x = -0.3 * Math.max(0, Math.sin(t * 0.8 + i));
      }
    });
  });

  // Yoga on a mat.
  ground.add(at(box(0.8, 0.03, 1.9, mat(0x6fa3c9, 0.95)), 6.4, 0.02, -5.6));
  const yogi = person("Yoga", { shirt: 0xf2b42a });
  place(yogi, 6.4, -5.6);
  yogi.rig.root.rotation.y = -0.6;
  ticks.push((t) => {
    const k = (Math.sin(t * 0.45) + 1) / 2;
    yogi.rig.arms.L.sh.rotation.z = 0.2 + k * 2.6;
    yogi.rig.arms.R.sh.rotation.z = -(0.2 + k * 2.6);
  });

  // Guitar on a bench, a friend listening.
  const bench = new T.Group();
  bench.position.set(-9, 0, -2.8);
  bench.rotation.y = 1.2;
  bench.add(at(box(2.2, 0.1, 0.6, wood), 0, 0.45, 0), at(box(0.1, 0.45, 0.5, wood), -0.95, 0.22, 0), at(box(0.1, 0.45, 0.5, wood), 0.95, 0.22, 0));
  ground.add(bench);
  const player = person("Guitar", { seated: true });
  const listener = person("Listener", { seated: true });
  [player, listener].forEach((a, i) => {
    const off = new T.Vector3(i ? 0.5 : -0.5, 0, 0.05).applyAxisAngle(new T.Vector3(0, 1, 0), 1.2);
    a.rig.root.position.copy(bench.position).add(off);
    a.rig.root.position.y = -0.06;
    a.rig.root.rotation.y = 1.2;
  });
  const guitar = new T.Group();
  const body = cyl(0.2, 0.2, 0.09, mat(0xb98a4e), 16);
  body.rotation.x = PI / 2;
  const neck = box(0.06, 0.04, 0.6, mat(0x5a3a24));
  guitar.add(body, at(neck, 0, 0, -0.38));
  guitar.position.set(0, 0.22, 0.24);
  guitar.rotation.y = 0.9;
  player.rig.spine.add(guitar);
  ticks.push((t) => {
    player.rig.arms.R.sh.rotation.x = -0.9 + Math.sin(t * 5) * 0.18;
    player.rig.arms.L.sh.rotation.x = -1.1;
    player.rig.head.rotation.z = Math.sin(t * 1.2) * 0.08;
    listener.rig.head.rotation.z = Math.sin(t * 1.2 + 0.8) * 0.12;
    laugh(listener, t, 4);
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
  function draw(t = motion === "still" ? stillT : (performance.now() - start) / 1000) {
    for (const f of ticks) f(t);
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
    draw();
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
