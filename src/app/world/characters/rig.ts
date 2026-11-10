import * as T from "three";
import { PI, at, box, cyl, mat, mesh, sph } from "../core/kit";

/**
 * The animated figures that keep a Corner world alive. They are characters,
 * not people: each is tagged `userData.character` with its name, the page
 * labels every one of them "Character", and nothing here is ever counted or
 * listed with real people.
 */

export interface PersonLook {
  seated: boolean;
  skin: number;
  shirt: number;
  pants: number;
  apron: number;
  hair: number;
  bun?: boolean;
}

interface Arm {
  sh: T.Group;
  el: T.Group;
}

export interface PersonRig {
  root: T.Group;
  spine: T.Group;
  head: T.Group;
  arms: { L: Arm; R: Arm };
}

export function buildPerson(name: string, o: PersonLook): PersonRig {
  const m = (c: number) => mat(c, 0.82);
  const skin = m(o.skin);
  const shirt = m(o.shirt);
  const pants = m(o.pants);
  const apron = m(o.apron);
  const hair = m(o.hair);
  const shoe = m(0x2b211b);
  const root = new T.Group();
  const hips = new T.Group();
  hips.position.y = o.seated ? 0.56 : 0.95;
  root.add(hips);
  for (const s of [-1, 1]) {
    const th = new T.Group();
    th.position.set(s * 0.1, 0, 0);
    hips.add(th);
    th.add(at(cyl(0.078, 0.066, 0.45, pants, 14), 0, -0.225, 0));
    const kn = new T.Group();
    kn.position.y = -0.45;
    th.add(kn);
    kn.add(sph(0.068, pants, 12, 10));
    kn.add(at(cyl(0.063, 0.05, 0.45, pants, 14), 0, -0.225, 0));
    kn.add(at(box(0.11, 0.07, 0.22, shoe), 0, -0.47, 0.05));
    if (o.seated) {
      th.rotation.x = -PI / 2;
      kn.rotation.x = PI / 2;
    }
  }
  const seat = sph(0.19, pants, 20, 14);
  seat.scale.y = 0.6;
  hips.add(at(seat, 0, 0.03, 0));
  const spine = new T.Group();
  hips.add(spine);
  spine.add(at(cyl(0.17, 0.19, 0.55, shirt, 24), 0, 0.3, 0));
  spine.add(at(box(0.31, 0.52, 0.035, apron), 0, 0.24, 0.18));
  for (const s of [-1, 1]) spine.add(at(sph(0.095, shirt, 14, 10), s * 0.2, 0.55, 0));
  spine.add(at(cyl(0.05, 0.055, 0.1, skin, 12), 0, 0.64, 0));
  const head = new T.Group();
  head.position.y = 0.68;
  spine.add(head);
  const skull = sph(0.14, skin, 24, 18);
  skull.scale.set(1, 1.08, 1);
  skull.position.y = 0.15;
  head.add(skull);
  const cap = mesh(new T.SphereGeometry(0.152, 24, 16, 0, PI * 2, 0, PI * 0.55), hair);
  cap.position.set(0, 0.17, -0.012);
  cap.rotation.x = -0.38;
  head.add(cap);
  if (o.bun) head.add(at(sph(0.075, hair, 14, 10), 0, 0.27, -0.1));
  const eye = mat(0x1b1410, 0.4);
  for (const s of [-1, 1]) head.add(at(sph(0.016, eye, 8, 6), s * 0.048, 0.16, 0.128));
  head.add(at(sph(0.022, skin, 8, 6), 0, 0.13, 0.14));
  const cheek = new T.MeshStandardMaterial({ color: 0xe08a7a, roughness: 0.9, transparent: true, opacity: 0.35 });
  for (const s of [-1, 1]) head.add(at(new T.Mesh(new T.SphereGeometry(0.03, 10, 8), cheek), s * 0.08, 0.11, 0.11));
  const arm = (s: number): Arm => {
    const sh = new T.Group();
    sh.position.set(s * 0.22, 0.55, 0);
    spine.add(sh);
    sh.add(at(cyl(0.058, 0.05, 0.3, shirt, 12), 0, -0.15, 0));
    const el = new T.Group();
    el.position.y = -0.3;
    sh.add(el);
    el.add(sph(0.05, skin, 10, 8));
    el.add(at(cyl(0.05, 0.044, 0.27, skin, 12), 0, -0.135, 0));
    el.add(at(sph(0.056, skin, 12, 10), 0, -0.29, 0));
    return { sh, el };
  };
  const arms = { L: arm(-1), R: arm(1) };
  root.traverse((n) => {
    n.userData.character = name;
  });
  return { root, spine, head, arms };
}

export interface CatRig {
  root: T.Group;
  body: T.Mesh;
  head: T.Group;
  tail: T.Mesh;
}

export function buildCat(name: string, color: number, darkColor: number): CatRig {
  const root = new T.Group();
  const fur = mat(color, 0.85);
  const dark = mat(darkColor, 0.85);
  const body = sph(0.22, fur, 20, 14);
  body.scale.set(1.25, 0.62, 0.85);
  root.add(at(body, 0, 0.13, 0));
  const head = new T.Group();
  head.add(sph(0.12, fur, 18, 12));
  for (const s of [-1, 1]) {
    const ear = mesh(new T.ConeGeometry(0.045, 0.09, 10), dark);
    ear.position.set(s * 0.06, 0.1, 0);
    ear.rotation.z = -s * 0.25;
    head.add(ear);
  }
  head.position.set(0.24, 0.12, 0.08);
  head.rotation.y = 0.5;
  head.rotation.z = -0.2;
  root.add(head);
  const tail = mesh(new T.TorusGeometry(0.2, 0.035, 8, 24, PI * 1.1), dark);
  tail.rotation.x = PI / 2;
  tail.position.set(-0.05, 0.04, 0);
  root.add(tail);
  root.traverse((n) => {
    n.userData.character = name;
  });
  return { root, body, head, tail };
}
