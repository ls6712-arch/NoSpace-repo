import type * as T from "three";
import { at } from "../core/kit";
import { petsOf, type CornerWorldConfig } from "../config";
import type { SettingProps } from "../settings/types";
import { ACTIONS, type ActionHooks, type ActionState, type ActionUpdate } from "./actions";
import { buildCat, buildDog, buildPerson } from "./rig";

/**
 * The characters of a room, built from the Corner's config. They are characters, not people: every mesh is
 * tagged `userData.character`, the page labels each one "Character", and nothing here ever reaches the lists
 * that hold Moments, so a character cannot be counted, shown on a wall, or appear in chat.
 */
export interface Cast {
  /** Each character with the point its speech bubble hangs from. */
  characters: { name: string; anchor: T.Object3D; lift: number }[];
  /** Characters who speak on their own every so often, in turn. */
  talkers: string[];
  lines: Record<string, readonly string[]>;
  welcome: { who: string; text: string };
  /** The pets that purr when tapped: the cats. */
  purrs: string[];
  update(t: number, dt: number, k: number, state: ActionState, hooks: ActionHooks): void;
}

export function buildCast(scene: T.Scene, config: CornerWorldConfig, props: SettingProps, reducedMotion: boolean): Cast {
  const characters: Cast["characters"] = [];
  const lines: Record<string, readonly string[]> = {};
  const updates: ActionUpdate[] = [];

  config.characters.forEach((c, i) => {
    const rig = buildPerson(c.name, {
      pose: c.pose,
      skin: c.look.skin,
      shirt: c.look.shirt,
      pants: c.look.pants,
      apron: c.look.apron,
      hair: c.look.hair,
      bun: c.look.bun,
      glasses: c.look.glasses,
    });
    at(rig.root, c.at[0], 0, c.at[1]);
    rig.root.rotation.y = c.rot;
    scene.add(rig.root);
    characters.push({ name: c.name, anchor: rig.head, lift: 0.42 });
    lines[c.name] = c.lines;
    // Each character runs its loop a little out of step with the others.
    updates.push(ACTIONS[c.action](rig, c, props, { scene, phase: i * 2.3, reducedMotion, cast: config.characters }));
  });

  const purrs: string[] = [];
  for (const pet of petsOf(config)) {
    lines[pet.name] = [pet.line];
    if (pet.kind === "dog") {
      const dog = buildDog(pet.name, pet.color, pet.dark);
      dog.root.rotation.y = pet.rot;
      scene.add(at(dog.root, pet.at[0], 0, pet.at[1]));
      characters.push({ name: pet.name, anchor: dog.head, lift: 0.3 });
      // Awake: it pants, wags, tilts its head now and then, and an ear twitches.
      updates.push((t, _dt, _k, state) => {
        dog.body.scale.y = 1.35 + Math.sin(t * 5.2) * 0.02;
        dog.tail.rotation.y = state.reducedMotion ? 0 : Math.sin(t * 9) * 0.55;
        const tilt = Math.sin(t * 0.37);
        dog.head.rotation.z = tilt > 0.6 ? (tilt - 0.6) * 0.9 : 0;
        dog.head.rotation.x = Math.sin(t * 0.9) * 0.04;
        dog.ears[0].rotation.x = Math.sin(t * 0.23) > 0.96 ? Math.sin(t * 28) * 0.25 : 0;
      });
      continue;
    }
    const cat = buildCat(pet.name, pet.color, pet.dark);
    cat.root.rotation.y = pet.rot;
    scene.add(at(cat.root, pet.at[0], 0, pet.at[1]));
    characters.push({ name: pet.name, anchor: cat.head, lift: 0.25 });
    purrs.push(pet.name);
    // Asleep: it breathes, its tail moves, and now and then an ear twitches.
    updates.push((t) => {
      cat.body.scale.y = 0.62 + Math.sin(t * 1.6) * 0.02;
      cat.tail.rotation.z = Math.sin(t * 0.7) * 0.15;
      cat.head.rotation.z = -0.2 + (Math.sin(t * 0.3) > 0.97 ? Math.sin(t * 30) * 0.05 : 0);
    });
  }

  return {
    characters,
    talkers: config.characters.map((c) => c.name),
    lines,
    welcome: { who: config.greeting[0], text: config.greeting[1] },
    purrs,
    update(t, dt, k, state, hooks) {
      for (const u of updates) u(t, dt, k, state, hooks);
    },
  };
}
