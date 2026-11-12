import * as T from "three";
import { PI, at, box, cyl, mat, radialTex } from "../core/kit";
import type { ActionName, CharacterConfig } from "../config";
import type { SettingProps } from "../settings/types";
import type { PersonRig } from "./rig";

/**
 * What a character is doing. Each action is a small loop that moves one figure's joints and, where the
 * setting has it, the object they are working on. An action never knows which Corner it is in: the figure,
 * its lines and where it stands come from the Corner's config, the object from the setting's `props`.
 */

export interface ActionHooks {
  say(who: string, text: string): void;
  squish(pan: number, volume: number): void;
  thud(): void;
  dig(pan: number): void;
  page(pan: number): void;
  dice(pan: number): void;
  clack(pan: number): void;
  /** Water starts or stops pouring. */
  pour(on: boolean): void;
}

export interface ActionState {
  entered: boolean;
  reducedMotion: boolean;
}

export type ActionUpdate = (t: number, dt: number, k: number, state: ActionState, hooks: ActionHooks) => void;

/** What an action is given besides its figure: the scene (for anything it adds), and its place among the others. */
export interface ActionEnv {
  scene: T.Scene;
  /** Seconds this character's loop runs ahead of the clock, so no two move in step. */
  phase: number;
  reducedMotion: boolean;
  /** Everyone in the room, so one action can know whether another is there. */
  cast: readonly CharacterConfig[];
}
type Action = (rig: PersonRig, cfg: CharacterConfig, props: SettingProps, env: ActionEnv) => ActionUpdate;

const damp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Eases one arm towards a pose: shoulder forward, shoulder out, elbow. */
const arm = (rig: PersonRig, side: "L" | "R", x: number, z: number, el: number, k: number) => {
  const a = rig.arms[side];
  a.sh.rotation.x = damp(a.sh.rotation.x, x, k);
  a.sh.rotation.z = damp(a.sh.rotation.z, z, k);
  a.el.rotation.x = damp(a.el.rotation.x, el, k);
};
/** Where a sound sits between the speakers, from where its character stands. */
const panOf = (cfg: CharacterConfig) => Math.max(-0.8, Math.min(0.8, cfg.at[0] / 4));

/** Throwing on the wheel: centre, pull the walls up, and every third pot collapses. */
const wheel: Action = (rig, cfg, props) => {
  const pot = props.wheelPot;
  let cycle = -1;
  let saidCollapse = false;
  let lastSquish = 0;
  return (t, _dt, k, state, hooks) => {
    const cyc = Math.floor(t / 14);
    const u = t % 14;
    const collapse = cyc % 3 === 2;
    if (cyc !== cycle) {
      cycle = cyc;
      if (pot) pot.rotation.z = 0;
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
        if (pot) pot.rotation.z = damp(pot.rotation.z, 0.35, k);
      } else {
        reach = 0.85;
        lean = 0.1;
      }
    }
    if (collapse && u > 10.4 && !saidCollapse) {
      saidCollapse = true;
      if (state.entered) {
        hooks.thud();
        if (cfg.collapseLine) hooks.say(cfg.name, cfg.collapseLine);
      }
    }
    if (u < 1) saidCollapse = false;
    if (pot) {
      pot.scale.x = damp(pot.scale.x, sx, k * 0.8);
      pot.scale.z = pot.scale.x;
      pot.scale.y = damp(pot.scale.y, sy, k * 0.8);
    }
    const press = u < 10 ? Math.sin(t * 4.4) * 0.06 : 0;
    rig.spine.rotation.x = damp(rig.spine.rotation.x, lean + press * 0.4, k);
    (["L", "R"] as const).forEach((s, i) => {
      const a = rig.arms[s];
      const sg = i ? -1 : 1;
      a.sh.rotation.x = damp(a.sh.rotation.x, -(reach + press), k);
      a.sh.rotation.z = damp(a.sh.rotation.z, sg * inward, k);
      a.el.rotation.x = damp(a.el.rotation.x, laugh ? -1.2 : -0.55, k);
    });
    rig.head.rotation.x = damp(rig.head.rotation.x, laugh ? -0.25 : 0.25, k);
    rig.head.rotation.z = laugh ? Math.sin(t * 16) * 0.08 : damp(rig.head.rotation.z, 0, k);
    if (u < 10 && t - lastSquish > 1.4 + Math.random() * 0.6 && state.entered) {
      lastSquish = t;
      hooks.squish(0.35, 0.12);
    }
  };
};

/** Pressing down with both hands (wedging clay, firming soil), with a rest every 12 seconds. */
const press: Action = (rig, _cfg, props, env) => {
  const clay = props.wedgeClay;
  const base = clay ? clay.scale.clone() : null;
  let lastPush = 0;
  return (t, _dt, k, state, hooks) => {
    const tt = t + env.phase;
    const resting = tt % 12 > 9;
    const p = (Math.sin((tt * 2 * PI) / 1.5) + 1) / 2;
    rig.spine.rotation.x = damp(rig.spine.rotation.x, resting ? 0.04 : 0.22 + 0.3 * p, k);
    (["L", "R"] as const).forEach((s, i) => {
      const a = rig.arms[s];
      const sg = i ? -1 : 1;
      a.sh.rotation.x = damp(a.sh.rotation.x, resting ? -0.15 : -(0.75 + 0.5 * p), k);
      a.sh.rotation.z = damp(a.sh.rotation.z, resting ? sg * 0.08 : sg * 0.28, k);
      a.el.rotation.x = damp(a.el.rotation.x, resting ? -0.3 : -0.35 - 0.25 * (1 - p), k);
    });
    rig.head.rotation.y = damp(rig.head.rotation.y, resting ? 0.55 : 0, k * 0.6);
    rig.head.rotation.x = damp(rig.head.rotation.x, resting ? 0 : 0.35, k);
    if (clay && base) {
      clay.scale.y = damp(clay.scale.y, base.y * (resting ? 1 : 1 - 0.2 * p), k);
      clay.scale.z = damp(clay.scale.z, base.z * (resting ? 1 : 1 + 0.14 * p), k);
    }
    if (!resting && p > 0.97 && t - lastPush > 1 && state.entered) {
      lastPush = t;
      hooks.squish(-0.4, 0.16);
    }
  };
};

/** Brushing glaze onto a pot that slowly turns. The brush is in the right hand. */
const glaze: Action = (rig, cfg, props) => {
  const brush = new T.Group();
  brush.add(at(cyl(0.01, 0.012, 0.22, mat(0xb08a5a, 0.5), 8), 0, -0.08, 0), at(cyl(0.016, 0.004, 0.05, mat(0x2f4f86, 0.6), 8), 0, -0.21, 0));
  brush.position.y = -0.3;
  brush.rotation.x = 0.6;
  brush.traverse((n) => {
    n.userData.character = cfg.name;
  });
  rig.arms.R.el.add(brush);
  const pot = props.glazingPot;
  return (t, dt, k) => {
    rig.spine.rotation.x = damp(rig.spine.rotation.x, 0.28, k);
    rig.arms.R.sh.rotation.x = -1.05 + Math.sin(t * 2.6) * 0.08;
    rig.arms.R.sh.rotation.z = -0.15 + Math.sin(t * 1.3) * 0.12;
    rig.arms.R.el.rotation.x = -0.75;
    rig.arms.L.sh.rotation.x = -0.85;
    rig.arms.L.sh.rotation.z = 0.32;
    rig.arms.L.el.rotation.x = -0.35;
    rig.head.rotation.z = Math.sin(t * 0.5) * 0.1;
    rig.head.rotation.x = 0.3;
    if (pot) pot.rotation.y += dt * 0.25;
  };
};

/** Watering: lifts the can, tips it, and water falls from the spout. */
const water: Action = (rig, _cfg, _props, env) => {
  const can = new T.Group();
  const metal = mat(0x5f8a7a, 0.35, 0.5);
  can.add(at(cyl(0.09, 0.1, 0.17, metal, 20), 0, 0, 0));
  const spout = cyl(0.012, 0.02, 0.3, metal, 8);
  spout.rotation.x = 1.0;
  can.add(at(spout, 0, 0.05, 0.18));
  const handle = new T.Mesh(new T.TorusGeometry(0.07, 0.012, 6, 16, PI), metal);
  handle.castShadow = true;
  can.add(at(handle, 0, 0.09, -0.02));
  const tip = new T.Object3D();
  can.add(at(tip, 0, 0.14, 0.31));
  can.position.set(0, -0.4, 0.04);
  can.traverse((n) => {
    n.userData.character = _cfg.name;
  });
  rig.arms.R.el.add(can);

  // The drops: a small pool of points, reused.
  const N = 90;
  const pos = new Float32Array(N * 3);
  const vel: T.Vector3[] = [];
  const life = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3 + 1] = -10;
    vel.push(new T.Vector3());
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  env.scene.add(new T.Points(geo, new T.PointsMaterial({ map: radialTex(), color: 0xcfe6ff, size: 0.035, transparent: true, opacity: 0.85, depthWrite: false })));
  let next = 0;
  let pouring = false;
  const from = new T.Vector3();
  const dir = new T.Vector3();
  const q = new T.Quaternion();
  return (t, dt, k, state, hooks) => {
    const u = (t + env.phase) % 9;
    const pour = u > 5 && u < 8.4;
    rig.spine.rotation.x = damp(rig.spine.rotation.x, pour ? 0.18 : 0.05, k);
    arm(rig, "R", pour ? -1.05 : -0.35, -0.08, pour ? -0.25 : -0.45, k * 0.6);
    arm(rig, "L", -0.12, 0.1, -0.2, k);
    can.rotation.x = damp(can.rotation.x, pour ? 1.0 : 0.05, k * 0.5);
    rig.head.rotation.x = damp(rig.head.rotation.x, pour ? 0.4 : 0.1, k);
    rig.head.rotation.y = damp(rig.head.rotation.y, pour ? 0 : 0.35 * Math.sin(t * 0.3), k * 0.3);
    const flowing = pour && can.rotation.x > 0.6;
    if (flowing && !state.reducedMotion) {
      tip.getWorldPosition(from);
      dir.set(0, 0, 1).applyQuaternion(tip.getWorldQuaternion(q));
      for (let n = 0; n < 3; n++) {
        const i = next++ % N;
        pos.set([from.x, from.y, from.z], i * 3);
        vel[i].set(dir.x * 0.9 + (Math.random() - 0.5) * 0.25, dir.y * 0.9 - 0.2, dir.z * 0.9 + (Math.random() - 0.5) * 0.25);
        life[i] = 1;
      }
    }
    if (flowing !== pouring) {
      pouring = flowing;
      if (state.entered) hooks.pour(flowing);
    }
    let any = false;
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) continue;
      any = true;
      vel[i].y -= dt * 4;
      pos[i * 3] += vel[i].x * dt;
      pos[i * 3 + 1] += vel[i].y * dt;
      pos[i * 3 + 2] += vel[i].z * dt;
      life[i] -= dt * 1.4;
      if (pos[i * 3 + 1] < 0.05 || life[i] <= 0) {
        life[i] = 0;
        pos[i * 3 + 1] = -10;
      }
    }
    if (any) geo.attributes.position.needsUpdate = true;
  };
};

/** Digging with a trowel, kneeling, with a rest to look round. */
const dig: Action = (rig, cfg, _props, env) => {
  const trowel = new T.Group();
  trowel.add(at(cyl(0.015, 0.015, 0.1, mat(0x7a5236, 0.6), 8), 0, -0.05, 0), at(box(0.05, 0.09, 0.008, mat(0x9aa3aa, 0.3, 0.7)), 0, -0.14, 0));
  trowel.position.set(0, -0.3, 0.02);
  trowel.traverse((n) => {
    n.userData.character = cfg.name;
  });
  rig.arms.R.el.add(trowel);
  let last = -10;
  return (t, _dt, k, state, hooks) => {
    const tt = t + env.phase;
    const rest = tt % 10 > 7.5;
    const p = (Math.sin((tt * 2 * PI) / 1.3) + 1) / 2;
    rig.spine.rotation.x = damp(rig.spine.rotation.x, rest ? 0.12 : 0.5 + 0.08 * p, k);
    arm(rig, "R", rest ? -0.35 : -(0.6 + 0.45 * p), -0.12, rest ? -0.3 : -0.2 - 0.3 * (1 - p), k);
    arm(rig, "L", rest ? -0.25 : -0.75, 0.25, -0.5, k);
    rig.head.rotation.x = damp(rig.head.rotation.x, rest ? -0.05 : 0.45, k);
    rig.head.rotation.y = damp(rig.head.rotation.y, rest ? -0.5 : 0, k * 0.5);
    if (!rest && p > 0.97 && t - last > 1 && state.entered) {
      last = t;
      hooks.dig(panOf(cfg));
    }
  };
};

/** Reading a book held open in both hands, turning a page every few seconds. */
const read: Action = (rig, cfg, _props, env) => {
  const bookG = new T.Group();
  const cover = mat(cfg.bookColor ?? 0x7a3b3b, 0.7);
  const paper = mat(0xf3ece0, 0.9);
  for (const s of [-1, 1]) bookG.add(at(box(0.15, 0.008, 0.21, cover), s * 0.075, 0, 0), at(box(0.14, 0.016, 0.2, paper), s * 0.072, 0.011, 0));
  const page = new T.Group();
  page.add(at(box(0.14, 0.003, 0.2, paper), 0.07, 0, 0));
  bookG.add(at(page, 0, 0.02, 0));
  bookG.position.set(0, 0.33, 0.3);
  bookG.rotation.x = -1.05;
  bookG.traverse((n) => {
    n.userData.character = cfg.name;
  });
  rig.spine.add(bookG);
  let flipped = false;
  return (t, _dt, k, state, hooks) => {
    const u = (t + env.phase) % 7;
    const flip = u > 6.1;
    rig.spine.rotation.x = damp(rig.spine.rotation.x, 0.08, k);
    rig.head.rotation.x = damp(rig.head.rotation.x, 0.42 + Math.sin(t * 0.4 + env.phase) * 0.04, k);
    rig.head.rotation.z = Math.sin(t * 0.25 + env.phase) * 0.05;
    arm(rig, "L", -0.95, 0.45, -1.05, k);
    arm(rig, "R", flip ? -1.2 : -0.95, flip ? 0.05 : -0.45, -1.05, k);
    page.rotation.z = flip ? Math.min(PI, ((u - 6.1) / 0.75) * PI) : 0;
    if (flip && !flipped) {
      flipped = true;
      if (state.entered) hooks.page(panOf(cfg));
    }
    if (!flip) flipped = false;
  };
};

/** Writing at a desk, looking up now and then. */
const write: Action = (rig, cfg, _props, env) => {
  const pen = cyl(0.008, 0.006, 0.14, mat(0x2b2b33, 0.4), 8);
  pen.position.set(0, -0.33, 0.03);
  pen.rotation.x = 0.9;
  pen.userData.character = cfg.name;
  rig.arms.R.el.add(pen);
  return (t, _dt, k) => {
    const up = (t + env.phase) % 9 > 7.4;
    rig.spine.rotation.x = damp(rig.spine.rotation.x, up ? 0.1 : 0.35, k);
    rig.head.rotation.x = damp(rig.head.rotation.x, up ? 0 : 0.5, k);
    rig.head.rotation.y = damp(rig.head.rotation.y, up ? 0.45 : 0, k * 0.5);
    arm(rig, "R", -0.85 + (up ? 0 : Math.sin(t * 7) * 0.03), -0.2, -0.75, k);
    rig.arms.R.el.rotation.z = up ? 0 : Math.sin(t * 9) * 0.06;
    arm(rig, "L", -0.8, 0.35, -0.6, k);
  };
};

// The café table runs on one seven-second round that three actions share: the dice are shaken and thrown
// (dice), a pawn is moved (move), and now and then someone cheers (think). Each action works alone too.
const ROUND = 7;

/** Shaking and throwing the two dice on the table. Also moves the pawn after the throw. */
const dice: Action = (rig, _cfg, props) => {
  const table = props.table;
  let cycle = -1;
  let landed = false;
  let moved = false;
  let from: T.Vector3 | null = null;
  let land: T.Vector3[] = [];
  let rest: T.Euler[] = [];
  const hand = new T.Vector3();
  const pawnA = new T.Vector3(0.84, 0.785, 0.44);
  const pawnB = new T.Vector3(1.06, 0.785, 0.33);
  return (t, dt, k, state, hooks) => {
    const u = t % ROUND;
    const shake = u < 1.2;
    const thr = u >= 1.2 && u < 1.6;
    arm(rig, "R", shake ? -1.25 + Math.sin(t * 28) * 0.08 : thr ? -1.45 : -0.75, shake ? -0.1 : -0.25, shake ? -1.1 : thr ? -0.25 : -0.9, shake ? 0.5 : k);
    arm(rig, "L", -0.75, 0.3, -0.9, k);
    rig.spine.rotation.x = damp(rig.spine.rotation.x, 0.25, k);
    rig.head.rotation.x = damp(rig.head.rotation.x, 0.32, k);
    if (!table) return;

    const cyc = Math.floor(t / ROUND);
    if (cyc !== cycle) {
      cycle = cyc;
      landed = false;
      moved = false;
      land = table.dice.map((_, i) => new T.Vector3(table.board.x + 0.18 + i * 0.1 + (Math.random() - 0.5) * 0.08, 0.811, table.board.z + 0.22 + (Math.random() - 0.5) * 0.08));
      rest = table.dice.map(() => new T.Euler((Math.floor(Math.random() * 4) * PI) / 2, (Math.floor(Math.random() * 4) * PI) / 2, 0));
    }
    rig.arms.R.hand.getWorldPosition(hand);
    table.dice.forEach((d, i) => {
      if (u < 1.2) {
        d.position.set(hand.x + i * 0.03, hand.y - 0.02, hand.z + 0.02);
        d.rotation.x += dt * 12;
        d.rotation.y += dt * 9;
      } else if (u < 2.0) {
        const q = Math.min(1, (u - 1.2) / 0.8);
        if (!from) from = hand.clone();
        d.position.lerpVectors(from, land[i], q);
        d.position.y += Math.sin(q * PI) * 0.22;
        d.rotation.x += dt * 14 * (1 - q);
        d.rotation.z += dt * 10 * (1 - q);
      } else {
        d.position.copy(land[i]);
        d.rotation.copy(rest[i]);
      }
    });
    if (u >= 2.0 && !landed) {
      landed = true;
      from = null;
      if (state.entered) hooks.dice(0.1);
    }
    const a = cyc % 2 ? pawnB : pawnA;
    const b = cyc % 2 ? pawnA : pawnB;
    if (u < 3.3) table.pawn.position.copy(a);
    else if (u < 4.1) {
      const q = (u - 3.3) / 0.8;
      table.pawn.position.lerpVectors(a, b, q);
      table.pawn.position.y += Math.sin(q * PI) * 0.12;
    } else {
      table.pawn.position.copy(b);
      if (!moved) {
        moved = true;
        if (state.entered) hooks.clack(-0.1);
      }
    }
  };
};

/** Reaching across the table to move a piece. */
const move: Action = (rig) => (t, _dt, k) => {
  const u = t % ROUND;
  const reach = u > 3 && u < 4.4;
  arm(rig, "R", reach ? -1.3 : -0.75, reach ? -0.15 : -0.25, reach ? -0.35 : -0.9, k);
  arm(rig, "L", -0.75, 0.3, -0.9, k);
  rig.spine.rotation.x = damp(rig.spine.rotation.x, reach ? 0.38 : 0.22, k);
  rig.head.rotation.x = damp(rig.head.rotation.x, 0.35, k);
};

/** Chin in hand, thinking; throws both arms up when the dice land, and every third round says so. */
const think: Action = (rig, cfg) => {
  let cycle = -1;
  let cheered = false;
  return (t, _dt, k, state, hooks) => {
    const u = t % ROUND;
    const cheer = u > 2.05 && u < 2.9;
    arm(rig, "R", cheer ? -2.7 : -0.5, cheer ? -0.15 : -0.1, cheer ? -0.3 : -2.3, cheer ? 0.35 : k);
    arm(rig, "L", cheer ? -2.7 : -0.7, cheer ? 0.15 : 0.3, cheer ? -0.3 : -0.9, cheer ? 0.35 : k);
    rig.spine.rotation.x = damp(rig.spine.rotation.x, cheer ? -0.05 : 0.2, k);
    rig.head.rotation.z = damp(rig.head.rotation.z, cheer ? 0 : 0.15, k);
    rig.head.rotation.x = damp(rig.head.rotation.x, cheer ? -0.1 : 0.3, k);
    const cyc = Math.floor(t / ROUND);
    if (cyc !== cycle) {
      cycle = cyc;
      cheered = false;
    }
    if (u > 2.1 && !cheered) {
      cheered = true;
      if (state.entered && cyc % 3 === 1 && cfg.cheerLine) hooks.say(cfg.name, cfg.cheerLine);
    }
  };
};

/** One function per action name in ../config. */
export const ACTIONS: Record<ActionName, Action> = { wheel, press, glaze, water, dig, read, write, dice, move, think };
