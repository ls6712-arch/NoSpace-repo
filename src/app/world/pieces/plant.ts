import * as T from "three";
import { rng, type PieceSpec } from "../layout";
import { PI, at, cyl, mat, sph } from "../core/kit";

/**
 * Plants. One in progress is a seedling: a small pot with a few sprouts. A finished one is a bigger pot, full
 * of leaves and in flower.
 */
const TERRACOTTA = 0xb5643f;
const SOIL = 0x4a3426;
export const LEAF_A = 0x3f6b3a;
export const LEAF_B = 0x5c8a4a;
export const FLOWERS = [0xe07a8a, 0xf0c040, 0xffffff, 0xc0453a, 0xb98ae0] as const;

/** A ring of leaves round a point, used by plants and by the garden's beds and baskets. */
export function addLeaves(g: T.Group, n: number, rad: number, h: number, r: () => number, leafA: T.Material, leafB: T.Material) {
  for (let i = 0; i < n; i++) {
    const l = sph(0.05, i % 2 ? leafA : leafB, 12, 8);
    l.scale.set(0.8, 1.6, 0.35);
    const a = (i / n) * PI * 2 + r() * 0.4;
    l.position.set(Math.cos(a) * rad * (0.5 + r() * 0.5), h + r() * 0.06, Math.sin(a) * rad * (0.5 + r() * 0.5));
    l.rotation.set(Math.sin(a) * 0.8, -a, Math.cos(a) * -0.8);
    g.add(l);
  }
}

export function plant(seed: number, finished: boolean, flower: number): T.Group {
  const r = rng(seed);
  const g = new T.Group();
  const pot = mat(TERRACOTTA, 0.85);
  const soil = mat(SOIL, 0.98);
  const leafA = mat(LEAF_A, 0.7);
  const leafB = mat(LEAF_B, 0.7);
  if (!finished) {
    g.add(at(cyl(0.075, 0.06, 0.09, pot, 18), 0, 0.045, 0), at(cyl(0.068, 0.068, 0.01, soil, 18), 0, 0.088, 0));
    const n = 2 + (seed % 3);
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * 0.06;
      const z = (r() - 0.5) * 0.06;
      g.add(at(cyl(0.004, 0.004, 0.06, leafB, 5), x, 0.12, z));
      const leaf = sph(0.018, leafB, 8, 6);
      leaf.scale.set(1.4, 0.5, 0.9);
      leaf.rotation.y = r() * PI;
      g.add(at(leaf, x, 0.15, z));
    }
    return g;
  }
  g.add(at(cyl(0.11, 0.085, 0.14, pot, 22), 0, 0.07, 0), at(cyl(0.1, 0.1, 0.01, soil, 22), 0, 0.138, 0));
  addLeaves(g, 12, 0.13, 0.22, r, leafA, leafB);
  const petal = mat(flower, 0.6);
  for (let i = 0; i < 5; i++) {
    const a = r() * PI * 2;
    g.add(at(sph(0.025, petal, 10, 8), Math.cos(a) * 0.08, 0.26 + r() * 0.08, Math.sin(a) * 0.08));
  }
  return g;
}

export const plantMaker = {
  make: (spec: PieceSpec, finished: boolean) => {
    const g = plant(spec.seed, finished, FLOWERS[spec.seed % FLOWERS.length]);
    g.rotation.y = spec.turn;
    return g;
  },
  height: (_spec: PieceSpec, finished: boolean) => (finished ? 0.38 : 0.17),
};
