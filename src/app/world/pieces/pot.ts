import * as T from "three";
import { rng, type PieceSpec, type PotShape } from "../layout";
import { PI, mesh } from "../core/kit";

/**
 * Pottery pieces. A piece is a profile spun round its axis. A finished one is
 * glazed down to an uneven drip line with bare clay under it; one in progress
 * is bare clay all over.
 */

interface Profile {
  h: number;
  r: number;
  foot: number;
  belly: number;
  neck: number;
  lip: number;
}

export const PROFILES: Record<PotShape | "lump", Profile> = {
  bowl: { h: 0.13, r: 0.2, foot: 0.07, belly: 0.55, neck: 0.21, lip: 0.008 },
  vase: { h: 0.42, r: 0.14, foot: 0.08, belly: 0.45, neck: 0.055, lip: 0.025 },
  jar: { h: 0.28, r: 0.15, foot: 0.09, belly: 0.55, neck: 0.09, lip: 0.015 },
  cup: { h: 0.15, r: 0.075, foot: 0.055, belly: 0.3, neck: 0.08, lip: 0.004 },
  bottle: { h: 0.36, r: 0.12, foot: 0.075, belly: 0.4, neck: 0.035, lip: 0.01 },
  lump: { h: 0.3, r: 0.16, foot: 0.14, belly: 0.55, neck: 0.12, lip: 0.006 },
};

export function potGeometry(p: Profile): T.LatheGeometry {
  const pts = [new T.Vector2(0, 0), new T.Vector2(p.foot, 0)];
  const N = 26;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    let r: number;
    if (t < p.belly) r = p.foot + (p.r - p.foot) * Math.sin(((t / p.belly) * PI) / 2);
    else {
      const k = (t - p.belly) / (1 - p.belly);
      r = p.r + ((p.neck - p.r) * (1 - Math.cos(k * PI))) / 2;
    }
    pts.push(new T.Vector2(r, t * p.h));
  }
  const top = pts[pts.length - 1];
  pts.push(new T.Vector2(top.x + p.lip, p.h + 0.006));
  pts.push(new T.Vector2(top.x - 0.012, p.h + 0.002));
  pts.push(new T.Vector2(Math.max(0.01, p.neck - 0.02), p.h - 0.05));
  pts.push(new T.Vector2(Math.max(0.005, p.foot * 0.7), 0.025));
  return new T.LatheGeometry(pts, 44);
}

const CLAY = [0xc49a74, 0xa87a5a];

export function glazedPot(shape: PotShape, glaze: number, seed: number): T.Mesh {
  const r = rng(seed);
  const p = PROFILES[shape];
  const geo = potGeometry(p);
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const g = new T.Color(glaze);
  const raw = new T.Color(CLAY[r() < 0.5 ? 0 : 1]);
  const dark = g.clone().multiplyScalar(0.72);
  const dip = p.h * (0.16 + r() * 0.22);
  const freq = 3 + Math.floor(r() * 6);
  const phase = r() * 6;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const a = Math.atan2(z, x);
    const line = dip - Math.max(0, Math.sin(a * freq + phase)) * p.h * 0.12;
    let c = y > line ? g : raw;
    if (y > line && y > p.h * 0.92) c = dark;
    if (y > line && y < line + p.h * 0.05) c = dark;
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new T.BufferAttribute(cols, 3));
  return mesh(geo, new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.18, side: T.DoubleSide }));
}

/** Unfired clay: pale and dry, or darker while it is still damp. */
export function rawPot(shape: PotShape, seed: number): T.Mesh {
  const damp = rng(seed)() < 0.35;
  return mesh(potGeometry(PROFILES[shape]), new T.MeshStandardMaterial({ color: damp ? 0x9c8068 : 0xb9a48e, roughness: damp ? 0.55 : 0.95, side: T.DoubleSide }));
}

/** The piece a Moment becomes. */
export function pieceMesh(spec: PieceSpec, glazed: boolean): T.Mesh {
  const m = glazed ? glazedPot(spec.shape, spec.glaze, spec.seed) : rawPot(spec.shape, spec.seed);
  m.rotation.y = spec.turn;
  return m;
}
