import * as T from "three";
import type { CornerWorldConfig } from "../config";
import { pieceSpec, moodForHour, type RoomPlan, type Spot } from "../layout";
import { buildCast } from "../characters/index";
import { makePiece, pieceHeight } from "../pieces";
import { SETTINGS } from "../settings";
import type { Setting } from "../settings/types";
import { createSound, type Sound } from "../sound";
import { PI, disposeTree, dropRadialTex, glow, radialTex } from "./kit";
import { START_POSES } from "./poses";
import { buildRoom } from "./room";
import { THEMES } from "./themes";
import { easeMood, moodState, type MoodChoice, type MoodName } from "./moods";

/**
 * The engine: one Corner's room on a canvas. It builds the shared room, the setting the Corner's config names,
 * the config's characters, the real pieces and the threads between them, the camera, and the frame loop.
 * Nothing in here is about any one Corner: everything that differs comes from `opts.config`.
 *
 * This file is loaded only when someone opens a world (it pulls in three.js),
 * so nothing here may be imported from a page that is not the world itself.
 * The page talks to it through `World` and gets screen positions back each
 * frame through `onFrame`, so signs and speech bubbles stay ordinary HTML.
 */

/** A point on the screen, in CSS pixels, and whether it is in view. */
export interface ScreenPoint {
  x: number;
  y: number;
  visible: boolean;
}

export interface Frame {
  signs: Record<Spot, ScreenPoint>;
  characters: Record<string, ScreenPoint>;
}

export interface WorldOptions {
  /** The Corner's room: its setting, its kind of piece, its characters and their words. */
  config: CornerWorldConfig;
  small: boolean;
  reducedMotion: boolean;
  /** The words on the three wooden tags in the room. */
  labels: Record<Spot, string>;
  mood: MoodChoice;
  sound: boolean;
  music: boolean;
  onFrame(frame: Frame): void;
  /** A character speaks. `who` is the character's name. */
  onSay(who: string, text: string): void;
  /** A part of the room was tapped. */
  onOpen(spot: Spot): void;
  /** The pointer is over a part of the room, or none. */
  onHover(spot: Spot | null): void;
  /** The canvas lost its graphics context and cannot draw any more. */
  onLost(): void;
}

export interface World {
  /** How long the scene took to build and draw its first frame, ms. */
  firstFrameMs: number;
  /** The welcome line and who says it. */
  welcome: { who: string; text: string };
  setPlan(plan: RoomPlan): void;
  setMood(mood: MoodChoice): void;
  /** Width of the side panel covering the right of the canvas, CSS px, so the room stays centred in what is left. */
  setInset(px: number): void;
  /** Brighten the threads while the walls are being read. */
  setThreadsBright(on: boolean): void;
  setHover(spot: Spot | null): void;
  /** The person tapped "Enter": the camera moves in, characters start talking, sound may start. */
  enter(): void;
  setPaused(paused: boolean): void;
  sound: Sound;
  dispose(): void;
}

const damp = (a: number, b: number, k: number) => a + (b - a) * k;
const resolveMood = (m: MoodChoice): MoodName => (m === "clock" ? moodForHour(new Date().getHours()) : m);

export function createWorld(container: HTMLElement, opts: WorldOptions): World {
  const started = performance.now();
  const { small, reducedMotion, config } = opts;
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
  canvas.setAttribute("aria-hidden", "true");
  container.appendChild(canvas);

  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(38, 1, 0.1, 80);
  const room = buildRoom(scene, { small, reducedMotion, anisotropy: renderer.capabilities.getMaxAnisotropy(), theme: THEMES[config.setting] });
  const setting: Setting = SETTINGS[config.setting](scene, room, opts.labels, config.pieceKind);
  const cast = buildCast(scene, config, setting.props, reducedMotion);

  // Things in the room that answer a tap: a part of the room, or a character.
  const pickables: T.Object3D[] = [];
  scene.traverse((n) => {
    if ((n as T.Mesh).isMesh && (n.userData.spot || n.userData.character)) pickables.push(n);
  });

  // Real pieces and the threads between them.
  const pieces = new Map<number, { mesh: T.Object3D; spot: Spot; glazed: boolean; top: T.Vector3; scale: number; born: number }>();
  const threads: { mesh: T.Mesh<T.TubeGeometry, T.MeshBasicMaterial>; curve: T.CatmullRomCurve3; spark: T.Sprite; o: number }[] = [];
  const sparks: { points: T.Points<T.BufferGeometry, T.PointsMaterial>; vel: T.Vector3[]; born: number }[] = [];
  let firstPlan = true;
  let threadsBright = false;

  // A piece may be one mesh (a pot) or several (a plant): every mesh of it answers a tap.
  const removeObject = (o: T.Object3D) => {
    scene.remove(o);
    o.traverse((n) => {
      const i = pickables.indexOf(n);
      if (i >= 0) pickables.splice(i, 1);
    });
    disposeTree(o);
  };
  const burst = (p: T.Vector3) => {
    const n = 46;
    const g = new T.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const vel: T.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      pos.set([p.x, p.y, p.z], i * 3);
      vel.push(new T.Vector3((Math.random() - 0.5) * 1.4, Math.random() * 1.6 + 0.4, (Math.random() - 0.2) * 1.2));
    }
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    const points = new T.Points(g, new T.PointsMaterial({ map: radialTex(), color: 0xffd27a, size: 0.07, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    scene.add(points);
    sparks.push({ points, vel, born: performance.now() });
  };

  function setPlan(plan: RoomPlan) {
    const want = new Map(plan.placements.map((p) => [p.postId, p]));
    for (const [id, piece] of pieces) {
      const p = want.get(id);
      // Gone, moved, or finished since: take it out and let it be made again below.
      if (!p || p.spot !== piece.spot || p.glazed !== piece.glazed || !setting.slots[p.spot][p.slot]?.equals(piece.mesh.position)) {
        removeObject(piece.mesh);
        pieces.delete(id);
      }
    }
    for (const p of plan.placements) {
      if (pieces.has(p.postId)) continue;
      const base = setting.slots[p.spot][p.slot];
      if (!base) continue;
      const spec = pieceSpec(p.postId);
      const m = makePiece(config.pieceKind, spec, p.glazed);
      const height = pieceHeight(config.pieceKind, spec, p.glazed);
      const scale = Math.min(spec.scale, setting.headroom[p.spot] / height);
      m.position.copy(base);
      m.traverse((n) => {
        if (!(n as T.Mesh).isMesh) return;
        n.userData.spot = p.spot;
        pickables.push(n);
      });
      // The first load is simply there. A piece that arrives later pops in.
      const born = firstPlan ? 0 : performance.now();
      m.scale.setScalar(born ? 0.0001 : scale);
      scene.add(m);
      const top = base.clone();
      top.y += height * scale + 0.03;
      top.z += 0.04;
      pieces.set(p.postId, { mesh: m, spot: p.spot, glazed: p.glazed, top, scale, born });
      if (born && !reducedMotion) burst(top);
    }
    firstPlan = false;

    for (const th of threads) {
      scene.remove(th.mesh, th.spark);
      th.mesh.geometry.dispose();
      th.mesh.material.dispose();
      th.spark.material.dispose();
    }
    threads.length = 0;
    for (const [from, to] of plan.threads) {
      const a = pieces.get(from)?.top;
      const b = pieces.get(to)?.top;
      if (!a || !b) continue;
      const mid = a.clone().lerp(b, 0.5);
      mid.z += 0.85;
      mid.y += 0.3;
      const curve = new T.CatmullRomCurve3([a.clone(), mid, b.clone()]);
      const material = new T.MeshBasicMaterial({ color: 0xf0b955, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false });
      const tube = new T.Mesh(new T.TubeGeometry(curve, 48, 0.007, 6, false), material);
      const spark = glow(0xffd27a, 0.2, 0);
      scene.add(tube, spark);
      threads.push({ mesh: tube, curve, spark, o: Math.random() });
    }
  }

  // Mood.
  let moodName = resolveMood(opts.mood);
  const cur = moodState(moodName);
  let target = moodState(moodName);
  const sound = createSound({ sound: opts.sound, music: opts.music, mood: moodName, beds: config.sounds.bed });
  room.applyMood(cur, renderer);
  setting.applyMood(cur);

  // Camera: drag to look, wheel to move in and out, tap to pick.
  // Where the camera starts is fixed per setting (./poses): posters and loops are framed from the same pose.
  const pose = START_POSES[config.setting];
  const look = new T.Vector3(...pose.look);
  let yaw = pose.yaw;
  let pitch = pose.pitch;
  let radius = small && window.innerWidth < window.innerHeight ? pose.radiusPhone : pose.radius;
  let camR = radius + 5.6;
  let dragging = false;
  let moved = 0;
  let lx = 0;
  let ly = 0;
  let lastHover = 0;
  let entered = false;
  let hover: Spot | null = null;
  const ray = new T.Raycaster();
  const ptr = new T.Vector2();
  const hitAt = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, cam);
    return ray.intersectObjects(pickables, false)[0]?.object.userData as { spot?: Spot; character?: string } | undefined;
  };
  const onDown = (e: PointerEvent) => {
    dragging = true;
    moved = 0;
    lx = e.clientX;
    ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) {
      const now = performance.now();
      if (e.pointerType === "mouse" && now - lastHover > 70) {
        lastHover = now;
        const hit = hitAt(e);
        canvas.style.cursor = hit ? "pointer" : "grab";
        const spot = hit?.spot ?? null;
        if (spot !== hover) opts.onHover(spot);
      }
      return;
    }
    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    moved += Math.abs(dx) + Math.abs(dy);
    yaw = Math.max(-0.35, Math.min(1.15, yaw - dx * 0.004));
    pitch = Math.max(0.1, Math.min(0.62, pitch + dy * 0.003));
    lx = e.clientX;
    ly = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    dragging = false;
    canvas.style.cursor = "grab";
    if (moved >= 6 || !entered) return;
    const hit = hitAt(e);
    if (!hit) return;
    if (hit.spot) return opts.onOpen(hit.spot);
    if (hit.character) {
      const lines = cast.lines[hit.character] ?? [];
      if (lines.length) opts.onSay(hit.character, lines[(Math.random() * lines.length) | 0]);
      if (hit.character === cast.pet) sound.purr();
    }
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    radius = Math.max(4.6, Math.min(11, radius + e.deltaY * 0.004));
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    opts.onLost();
  };
  canvas.style.cursor = "grab";
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("webglcontextlost", onLost);

  let width = 1;
  let height = 1;
  const resize = () => {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    cam.aspect = width / height;
    cam.fov = width < height ? 52 : 38;
    cam.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const hoverGlow = glow(0xffd9a0, 1, 0);
  scene.add(hoverGlow);

  // Frame loop.
  const clock = new T.Clock();
  let last = 0;
  let raf = 0;
  let paused = false;
  let disposed = false;
  let inset = 0;
  let off = 0;
  let lineIdx = 0;
  let nextAuto = Infinity;
  const v = new T.Vector3();
  const project = (p: T.Vector3): ScreenPoint => {
    v.copy(p).project(cam);
    return { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  };
  const hooks = { say: opts.onSay, squish: sound.squish, thud: sound.thud, dig: sound.dig, page: sound.page, dice: sound.dice, clack: sound.clack, pour: sound.pour };

  function draw() {
    const t = clock.getElapsedTime();
    const dt = Math.min(t - last, 0.05);
    last = t;
    const k = 1 - Math.exp(-dt * 7);
    easeMood(cur, target, 1 - Math.exp(-dt * 1.6));
    room.applyMood(cur, renderer);
    setting.applyMood(cur);

    camR = damp(camR, entered ? radius : radius + 4, 1 - Math.exp(-dt * (entered ? 0.9 : 2)));
    const drift = reducedMotion ? 0 : Math.sin(t * 0.09) * 0.05;
    const nod = reducedMotion ? 0 : Math.sin(t * 0.13) * 0.02;
    const Y = yaw + drift;
    const P = pitch + nod;
    cam.position.set(look.x + Math.sin(Y) * Math.cos(P) * camR, look.y + Math.sin(P) * camR, look.z + Math.cos(Y) * Math.cos(P) * camR);
    cam.lookAt(look);

    room.update(t, dt, cur);
    setting.update(t, dt, k, { entered, reducedMotion });
    cast.update(t, dt, k, { entered, reducedMotion }, hooks);

    const now = performance.now();
    for (const piece of pieces.values()) {
      if (!piece.born) continue;
      const e = Math.min(1, (now - piece.born) / 700);
      const bounce = reducedMotion ? 1 : 1 + Math.sin(e * PI) * 0.25;
      piece.mesh.scale.setScalar(Math.max(0.0001, e * piece.scale * bounce));
      if (e >= 1) piece.born = 0;
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i];
      const age = (now - sp.born) / 1000;
      const arr = sp.points.geometry.attributes.position.array as Float32Array;
      sp.vel.forEach((vel, j) => {
        vel.y -= dt * 2.2;
        arr[j * 3] += vel.x * dt;
        arr[j * 3 + 1] += vel.y * dt;
        arr[j * 3 + 2] += vel.z * dt;
      });
      sp.points.geometry.attributes.position.needsUpdate = true;
      sp.points.material.opacity = Math.max(0, 1 - age / 1.4);
      if (age > 1.4) {
        scene.remove(sp.points);
        sp.points.geometry.dispose();
        sp.points.material.dispose();
        sparks.splice(i, 1);
      }
    }
    const threadA = threadsBright ? 0.62 : 0.3;
    for (const th of threads) {
      th.mesh.material.opacity = damp(th.mesh.material.opacity, threadA, k);
      const u = reducedMotion ? 0.5 : (t * 0.2 + th.o) % 1;
      th.spark.position.copy(th.curve.getPoint(u));
      th.spark.material.opacity = threadA * 1.5 * Math.sin(u * PI);
    }
    if (hover) {
      const a = setting.areas[hover];
      hoverGlow.position.set(a[0], a[1], a[2]);
      hoverGlow.scale.set(a[3], Math.min(a[3] * 0.62, 1.7), 1);
    }
    hoverGlow.material.opacity = damp(hoverGlow.material.opacity, hover ? 0.32 : 0, k);

    // Characters speak in turn, now and then.
    if (entered && now > nextAuto) {
      const who = cast.talkers[lineIdx % cast.talkers.length];
      const lines = cast.lines[who] ?? [];
      if (lines.length) opts.onSay(who, lines[Math.floor(lineIdx / cast.talkers.length) % lines.length]);
      lineIdx++;
      nextAuto = now + 7500;
    }

    // Keep the room centred in the part of the canvas the side panel leaves free.
    off = damp(off, inset, 1 - Math.exp(-dt * 5));
    if (off > 0.5) cam.setViewOffset(width + off, height, off, 0, width, height);
    else if (cam.view && cam.view.enabled) {
      cam.clearViewOffset();
      cam.aspect = width / height;
      cam.updateProjectionMatrix();
    }
    renderer.render(scene, cam);

    const signs = {} as Record<Spot, ScreenPoint>;
    for (const spot of ["rack", "shelf", "yours"] as const) signs[spot] = project(setting.signs[spot]);
    const characters: Record<string, ScreenPoint> = {};
    for (const c of cast.characters) {
      c.anchor.getWorldPosition(v);
      v.y += c.lift;
      characters[c.name] = project(v);
    }
    opts.onFrame({ signs, characters });
  }
  const loop = () => {
    if (disposed || paused) return;
    draw();
    raf = requestAnimationFrame(loop);
  };
  draw();
  const firstFrameMs = performance.now() - started;
  raf = requestAnimationFrame(loop);

  return {
    firstFrameMs,
    welcome: cast.welcome,
    setPlan,
    setMood(m) {
      moodName = resolveMood(m);
      target = moodState(moodName);
      sound.setMood(moodName);
    },
    setInset(px) {
      inset = px;
    },
    setThreadsBright(on) {
      threadsBright = on;
    },
    setHover(spot) {
      hover = spot;
    },
    enter() {
      entered = true;
      nextAuto = performance.now() + 8000;
      sound.start();
    },
    setPaused(p) {
      if (p === paused) return;
      paused = p;
      sound.suspend(p);
      if (!p) {
        // Skip the time spent away so nothing jumps.
        clock.getDelta();
        last = clock.getElapsedTime();
        raf = requestAnimationFrame(loop);
      } else cancelAnimationFrame(raf);
    },
    sound,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("webglcontextlost", onLost);
      sound.dispose();
      disposeTree(scene);
      dropRadialTex();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
