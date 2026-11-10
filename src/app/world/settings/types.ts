import type * as T from "three";
import type { Spot } from "../layout";
import type { MoodState } from "../core/moods";
import type { Room } from "../core/room";

/**
 * What a setting gives the engine. A setting is the furniture of a room (a pottery studio, a greenhouse): it
 * builds its objects on top of the shared room and says where a Corner's real pieces go, where each part's
 * sign floats, and which of its objects a character's action can use. It has no characters and no words of
 * its own: those come from the Corner's config.
 */
export interface Setting {
  /** Where the base of each piece sits, by part of the room, in slot order. */
  slots: Record<Spot, T.Vector3[]>;
  /** The tallest a piece may stand in each part. */
  headroom: Record<Spot, number>;
  /** Where each part's sign floats. */
  signs: Record<Spot, T.Vector3>;
  /** Centre and size of the soft glow shown when a part is pointed at: x, y, z, width. */
  areas: Record<Spot, [number, number, number, number]>;
  /** Objects a character's action moves. An action that needs one a setting lacks does nothing with it. */
  props: SettingProps;
  applyMood(cur: MoodState): void;
  /** Animates the setting's own objects (a spinning wheel, a swaying lamp). Characters are animated by their actions. */
  update(t: number, dt: number, k: number, state: { entered: boolean; reducedMotion: boolean }): void;
}

export interface SettingProps {
  /** The lump of clay on the wheel, which the wheel action raises and collapses. */
  wheelPot?: T.Mesh;
  /** The block of clay on the bench, which the press action squashes. */
  wedgeClay?: T.Mesh;
  /** The pot on the glaze table, which the glaze action turns. */
  glazingPot?: T.Mesh;
}

export type SettingBuilder = (scene: T.Scene, room: Room, labels: Record<Spot, string>) => Setting;
