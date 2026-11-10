import type * as T from "three";
import { at } from "../core/kit";
import type { CornerWorldConfig } from "../config";
import type { SettingProps } from "../settings/types";
import { ACTIONS, type ActionHooks, type ActionState, type ActionUpdate } from "./actions";
import { buildCat, buildPerson } from "./rig";

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
  /** The pet's name, if the room has one. */
  pet?: string;
  update(t: number, dt: number, k: number, state: ActionState, hooks: ActionHooks): void;
}

export function buildCast(scene: T.Scene, config: CornerWorldConfig, props: SettingProps): Cast {
  const characters: Cast["characters"] = [];
  const lines: Record<string, readonly string[]> = {};
  const updates: ActionUpdate[] = [];

  for (const c of config.characters) {
    const rig = buildPerson(c.name, {
      seated: c.pose === "seated",
      skin: c.look.skin,
      shirt: c.look.shirt,
      pants: c.look.pants,
      apron: c.look.apron,
      hair: c.look.hair,
      bun: c.look.bun,
    });
    at(rig.root, c.at[0], 0, c.at[1]);
    rig.root.rotation.y = c.rot;
    scene.add(rig.root);
    characters.push({ name: c.name, anchor: rig.head, lift: 0.42 });
    lines[c.name] = c.lines;
    updates.push(ACTIONS[c.action](rig, c, props));
  }

  const pet = config.pet;
  if (pet) {
    const cat = buildCat(pet.name, pet.color, pet.dark);
    cat.root.rotation.y = pet.rot;
    scene.add(at(cat.root, pet.at[0], 0, pet.at[1]));
    characters.push({ name: pet.name, anchor: cat.head, lift: 0.25 });
    lines[pet.name] = [pet.line];
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
    pet: pet?.name,
    update(t, dt, k, state, hooks) {
      for (const u of updates) u(t, dt, k, state, hooks);
    },
  };
}
