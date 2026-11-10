import * as T from "three";
import { PI, at, cyl, mat } from "../core/kit";
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
}

export interface ActionState {
  entered: boolean;
  reducedMotion: boolean;
}

export type ActionUpdate = (t: number, dt: number, k: number, state: ActionState, hooks: ActionHooks) => void;
type Action = (rig: PersonRig, cfg: CharacterConfig, props: SettingProps) => ActionUpdate;

const damp = (a: number, b: number, k: number) => a + (b - a) * k;

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

/** Pressing down with both hands (wedging clay), with a rest every 12 seconds. */
const press: Action = (rig, _cfg, props) => {
  const clay = props.wedgeClay;
  let lastPush = 0;
  return (t, _dt, k, state, hooks) => {
    const resting = t % 12 > 9;
    const p = (Math.sin((t * 2 * PI) / 1.5) + 1) / 2;
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
    if (clay) {
      clay.scale.y = damp(clay.scale.y, resting ? 1 : 1 - 0.2 * p, k);
      clay.scale.z = damp(clay.scale.z, resting ? 1 : 1 + 0.14 * p, k);
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

/** One function per action name in ../config. */
export const ACTIONS: Record<ActionName, Action> = { wheel, press, glaze };
