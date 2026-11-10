import * as T from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * The cast of the town: people and dogs from Quaternius' CC0 packs, made our
 * own. Everyone wears the Soosh wardrobe (ticket red, Stub yellow, navy, sage,
 * cream), skin tones span the world, a few wear a Stub on a lanyard, and the
 * dogs wear red bandanas. They are characters, not people: nothing here is
 * ever counted or listed with real members.
 *
 * Files live in public/world/town (see the README there). The eight people
 * share one set of moves (people-moves.glb), since they share a skeleton.
 */

export const PEOPLE_FILES = [
  "casual-female",
  "casual-male",
  "casual2-female",
  "casual2-male",
  "casual3-female",
  "casual3-male",
  "oldclassy-female",
  "oldclassy-male",
] as const;
export type Body = (typeof PEOPLE_FILES)[number];
/** "Punch" in the source pack; in the town it is a throw (a frisbee, a ball for the dog). */
export type Move = "Idle" | "Walk" | "Run" | "SitDown" | "Victory" | "Punch" | "PickUp";
export type DogMove = "Idle" | "Walk" | "Gallop" | "Idle_2_HeadLow" | "Eating";
export type DogKind = "shiba" | "husky";

/** Plants from Quaternius' Stylized Nature MegaKit (CC0), packed into nature.glb. */
export const PLANTS = {
  roundTree: { node: "CommonTree_3", height: 6 },
  tallTree: { node: "CommonTree_5", height: 6.8 },
  birch: { node: "Birch_2", height: 6.4 },
  pine: { node: "Pine_2", height: 7.2 },
  flowerBush: { node: "Bush_Common_Flowers", height: 1.1 },
  bush: { node: "Bush_Large", height: 1.4 },
  flowersYellow: { node: "Flower_3_Group", height: 0.45 },
  flowersPink: { node: "Flower_4_Group", height: 0.45 },
  grass: { node: "Grass_Common_Tall", height: 0.5 },
} as const;
export type Plant = keyof typeof PLANTS;

/** The Soosh wardrobe. Paint in a 3D scene, so numbers, like the rest of the world code. */
export const WARDROBE = {
  red: 0xc8332b,
  yellow: 0xf2b42a,
  navy: 0x2b3a67,
  sage: 0x7d9a78,
  cream: 0xeee3d0,
  denim: 0x4a6a96,
  plum: 0x8a4f6e,
  charcoal: 0x3a3a40,
} as const;
export const SKIN_TONES = [0x5e3a26, 0x7a4a2e, 0x8d5a3b, 0xa8704a, 0xc68a62, 0xd9a07a, 0xe8b994, 0xf1cba8] as const;
export const HAIR_TONES = [0x1b1714, 0x2a1d16, 0x4a2e1e, 0x6b4428, 0x8a5a2b, 0x9a9a9a] as const;

export interface Look {
  body: Body;
  skin: number;
  top: number;
  bottom: number;
  hair: number;
  /** Hat or trim on the bodies that have one. */
  accent?: number;
  /** A Stub badge on a lanyard. */
  stub?: boolean;
}

/**
 * The source pack draws people with big heads and short legs, which reads as
 * children. These bone scales give adult proportions: a smaller head, a little
 * more neck, longer and slimmer legs and arms. Bones point along their own y axis, so
 * [1, k, 1] lengthens a bone; a child under a lengthened bone gets the inverse
 * on y so it keeps its shape.
 */
const LIMB = 0.86; // slimmer arms and legs; hands and feet keep their size
const ADULT: Record<string, [number, number, number]> = {
  Head: [0.56, 0.56 / 1.35, 0.56],
  Neck: [1, 1.35, 1],
  "UpperLeg.L": [LIMB, 1.28, LIMB],
  "UpperLeg.R": [LIMB, 1.28, LIMB],
  "LowerLeg.L": [1, 1.18 / 1.28, 1],
  "LowerLeg.R": [1, 1.18 / 1.28, 1],
  "Foot.L": [1 / LIMB, 1 / 1.18, 1 / LIMB],
  "Foot.R": [1 / LIMB, 1 / 1.18, 1 / LIMB],
  "UpperArm.L": [LIMB, 1.18, LIMB],
  "UpperArm.R": [LIMB, 1.18, LIMB],
  "LowerArm.L": [1, 1.12 / 1.18, 1],
  "LowerArm.R": [1, 1.12 / 1.18, 1],
  "Fist.L": [1 / LIMB, 1 / 1.12, 1 / LIMB],
  "Fist.R": [1 / LIMB, 1 / 1.12, 1 / LIMB],
};

/** Height of every person in world units, whatever the model's own scale. */
const PERSON_HEIGHT = 1.75;
const DOG_LENGTH = 1.05;

export interface Character {
  root: T.Group;
  /** Crossfades to a move. Does nothing when it is already playing. */
  play(move: Move, opts?: { fade?: number; speed?: number; fromStart?: boolean }): void;
  /** Seated, frozen at the end of the sit-down move. Put `root` on the seat after calling this. */
  sit(): void;
  /** A bone by name, for small touches on top of a move (a laugh, a brush stroke). */
  bone(name: string): T.Bone | undefined;
  /** Puts an object in a hand (or on any bone) so it follows the move. */
  hold(boneName: string, obj: T.Object3D, offset?: T.Vector3): void;
  update(dt: number): void;
}

export interface Dog {
  root: T.Group;
  play(move: DogMove, opts?: { fade?: number; speed?: number; fromStart?: boolean }): void;
  update(dt: number): void;
}

export interface Cast {
  person(look: Look): Character;
  dog(kind: DogKind, opts?: { bandana?: number }): Dog;
  /** A new copy of a plant, sized to its natural height. Copies share geometry and textures. */
  plant(kind: Plant): T.Object3D;
}

/** Loads every model the town needs. Rejects if any file is missing, so the town can carry on without people. */
export async function loadCast(base: string): Promise<Cast> {
  const loader = new GLTFLoader();
  // Textures inside a .glb become blob: URLs. By default the loader reads them
  // with fetch(), which the site's CSP refuses (connect-src has no blob:). An
  // <img> may load blob: (img-src allows it), so use the image-element loader.
  loader.register((parser) => {
    parser.textureLoader = new T.TextureLoader(parser.options.manager);
    parser.textureLoader.setCrossOrigin(parser.options.crossOrigin);
    return { name: "soosh_image_textures" };
  });
  const url = (name: string) => base.replace(/\/?$/, "/") + name + ".glb";
  const [nature, moves, shiba, husky, ...bodies] = await Promise.all([
    loader.loadAsync(url("nature")),
    loader.loadAsync(url("people-moves")),
    loader.loadAsync(url("shiba")),
    loader.loadAsync(url("husky")),
    ...PEOPLE_FILES.map((f) => loader.loadAsync(url(f))),
  ]);
  const bodyByName = new Map<Body, GLTF>(PEOPLE_FILES.map((f, i) => [f, bodies[i]]));
  // The moves carry a scale key on every bone (always 1). Dropped, so the adult
  // proportions below stay put while the moves turn the joints.
  const humanClips = new Map(
    moves.animations.map((c) => {
      const clip = c.clone();
      clip.tracks = clip.tracks.filter((track) => !track.name.endsWith(".scale"));
      return [clip.name, clip] as const;
    }),
  );
  const dogs: Record<DogKind, GLTF> = { shiba, husky };
  const plantProtos = new Map<Plant, T.Object3D>();
  for (const [kind, spec] of Object.entries(PLANTS) as [Plant, (typeof PLANTS)[Plant]][]) {
    const src = nature.scene.getObjectByName(spec.node);
    if (!src) continue;
    const proto = new T.Group();
    const copy = src.clone();
    copy.position.set(0, 0, 0);
    proto.add(copy);
    const box = new T.Box3().setFromObject(proto);
    const h = box.max.y - box.min.y;
    if (h > 0) copy.scale.multiplyScalar(spec.height / h);
    const fitted = new T.Box3().setFromObject(proto);
    copy.position.y -= fitted.min.y;
    proto.traverse((n) => {
      const m = n as T.Mesh;
      if (!m.isMesh) return;
      m.castShadow = spec.height > 2;
      m.receiveShadow = true;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        const sm = mat as T.MeshStandardMaterial;
        sm.metalness = 0;
        sm.roughness = 0.9;
        if (sm.map && sm.transparent) {
          // Leaf cards: cut out cleanly instead of blending, so they sort and shadow right.
          sm.transparent = false;
          sm.alphaTest = 0.5;
        }
        sm.side = T.DoubleSide;
      }
    });
    plantProtos.set(kind, proto);
  }

  function fit(model: T.Object3D, size: number, axis: "y" | "z") {
    const box = new T.Box3().setFromObject(model);
    const extent = axis === "y" ? box.max.y - box.min.y : Math.max(box.max.z - box.min.z, box.max.x - box.min.x);
    if (extent > 0) model.scale.multiplyScalar(size / extent);
    const after = new T.Box3().setFromObject(model);
    model.position.y -= after.min.y;
  }

  function prepare(model: T.Object3D, paint: (name: string, m: T.MeshStandardMaterial) => void) {
    model.traverse((n) => {
      const mesh = n as T.SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((src) => {
        const m = (src as T.MeshStandardMaterial).clone();
        m.roughness = 0.85;
        m.metalness = 0;
        paint(src.name, m);
        return m;
      });
      mesh.material = mats.length === 1 ? mats[0] : mats;
    });
  }

  /** Parents `obj` to a bone so it follows the body, placed at a world offset from the bone in the rest pose. */
  function attach(model: T.Object3D, bone: T.Object3D | undefined, obj: T.Object3D, offset: T.Vector3) {
    if (!bone) return;
    model.updateMatrixWorld(true);
    const at = bone.getWorldPosition(new T.Vector3()).add(offset);
    const q = bone.getWorldQuaternion(new T.Quaternion()).invert();
    const s = bone.getWorldScale(new T.Vector3());
    bone.add(obj);
    obj.position.copy(bone.worldToLocal(at));
    obj.quaternion.copy(q);
    obj.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
  }

  function stubBadge(): T.Group {
    const g = new T.Group();
    const card = new T.Mesh(new T.BoxGeometry(0.07, 0.1, 0.008), new T.MeshStandardMaterial({ color: WARDROBE.yellow, roughness: 0.6 }));
    const band = new T.Mesh(new T.BoxGeometry(0.072, 0.022, 0.01), new T.MeshStandardMaterial({ color: WARDROBE.red, roughness: 0.6 }));
    band.position.y = 0.03;
    g.add(card, band);
    return g;
  }

  function moverFor(model: T.Object3D, clips: Map<string, T.AnimationClip>) {
    const mixer = new T.AnimationMixer(model);
    const actions = new Map<string, T.AnimationAction>();
    let current: T.AnimationAction | null = null;
    const action = (name: string) => {
      let a = actions.get(name);
      if (!a) {
        const clip = clips.get(name);
        if (!clip) return null;
        a = mixer.clipAction(clip);
        actions.set(name, a);
      }
      return a;
    };
    return {
      mixer,
      play(name: string, opts: { fade?: number; speed?: number; fromStart?: boolean } = {}) {
        const next = action(name);
        if (!next) return;
        next.timeScale = opts.speed ?? 1;
        if (next === current) return;
        next.reset().setLoop(T.LoopRepeat, Infinity);
        next.clampWhenFinished = false;
        next.paused = false;
        // Start each character at its own point in the loop, so a crowd never moves in step,
        // unless the move has a start that matters (a throw).
        next.time = opts.fromStart ? 0 : Math.random() * next.getClip().duration;
        next.play();
        if (current) current.crossFadeTo(next, opts.fade ?? 0.4, false);
        current = next;
      },
      freeze(name: string) {
        const a = action(name);
        if (!a) return;
        mixer.stopAllAction();
        a.reset().setLoop(T.LoopOnce, 1);
        a.clampWhenFinished = true;
        a.play();
        a.time = a.getClip().duration;
        a.paused = true;
        mixer.update(0);
        current = a;
      },
    };
  }

  return {
    person(look) {
      const src = bodyByName.get(look.body)!;
      const model = cloneSkinned(src.scene);
      prepare(model, (name, m) => {
        if (name === "Skin") m.color.setHex(look.skin);
        else if (name === "Shirt") m.color.setHex(look.top);
        else if (name === "Pants") m.color.setHex(look.bottom);
        else if (name === "Hair") m.color.setHex(look.hair);
        else if ((name === "Hat" || name === "Detail") && look.accent !== undefined) m.color.setHex(look.accent);
      });
      const bones = new Map<string, T.Bone>();
      model.traverse((n) => {
        if ((n as T.Bone).isBone) bones.set(n.name, n as T.Bone);
      });
      for (const [name, [x, y, z]] of Object.entries(ADULT)) bones.get(name)?.scale.set(x, y, z);
      model.updateMatrixWorld(true);
      fit(model, PERSON_HEIGHT, "y");
      if (look.stub) attach(model, bones.get("Torso"), stubBadge(), new T.Vector3(0.06, -0.1, 0.16));
      const root = new T.Group();
      root.add(model);
      const mover = moverFor(model, humanClips);
      mover.play("Idle");
      return {
        root,
        play: (m, o) => mover.play(m, o),
        sit: () => mover.freeze("SitDown"),
        bone: (name) => bones.get(name),
        hold: (boneName, obj, offset = new T.Vector3()) => attach(model, bones.get(boneName), obj, offset),
        update: (dt) => mover.mixer.update(dt),
      };
    },
    dog(kind, opts = {}) {
      const src = dogs[kind];
      const model = cloneSkinned(src.scene);
      prepare(model, () => {});
      fit(model, DOG_LENGTH, "z");
      let neck: T.Object3D | undefined;
      model.traverse((n) => {
        if (n.name === "Neck1") neck = n;
      });
      if (opts.bandana !== undefined) {
        const scarf = new T.Mesh(new T.ConeGeometry(0.11, 0.14, 3), new T.MeshStandardMaterial({ color: opts.bandana, roughness: 0.8 }));
        scarf.rotation.x = Math.PI;
        attach(model, neck, scarf, new T.Vector3(0, -0.06, 0.06));
      }
      const root = new T.Group();
      root.add(model);
      const mover = moverFor(model, new Map(src.animations.map((c) => [c.name, c])));
      mover.play("Idle");
      return { root, play: (m, o) => mover.play(m, o), update: (dt) => mover.mixer.update(dt) };
    },
    plant(kind) {
      const proto = plantProtos.get(kind)!;
      return proto.clone();
    },
  };
}
