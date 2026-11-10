import type { SettingName } from "../config";

/**
 * Where the camera starts in each setting. Posters and loop videos are framed from these, and the live room
 * takes over from them, so a change here shows as a jump between the two. Change one only together with
 * that setting's posters and loops.
 */
export interface StartPose {
  /** The point the camera looks at. */
  look: readonly [number, number, number];
  /** Turn round the room, radians. */
  yaw: number;
  /** Tilt down, radians. */
  pitch: number;
  /** Distance from the look point on a wide screen. */
  radius: number;
  /** The same, on a small upright screen. */
  radiusPhone: number;
}

const INDOOR: StartPose = { look: [0.1, 1.0, -0.3], yaw: 0.42, pitch: 0.3, radius: 7.4, radiusPhone: 9.6 };

export const START_POSES: Record<SettingName, StartPose> = {
  studio: INDOOR,
  // The open garden: looks further left and from further back than the reference prototype did, so that on a
  // wide screen the vegetable patch, the apple tree and the sunflowers are in frame together with the walls.
  garden: { look: [-2.8, 1.0, -0.3], yaw: 0.34, pitch: 0.32, radius: 11, radiusPhone: 12.4 },
  nook: INDOOR,
  cafe: INDOOR,
};
