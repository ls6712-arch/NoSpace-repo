import type { SettingName } from "../config";

/**
 * Where the camera starts in each setting. Posters and loop videos are framed from these, and the live room
 * takes over from them, so a change here shows as a jump between the two. Change one only together with
 * that setting's posters and loops.
 */
export interface CameraPose {
  /** The point the camera looks at. */
  look: readonly [number, number, number];
  /** Turn round the room, radians. */
  yaw: number;
  /** Tilt down, radians. */
  pitch: number;
  /** Distance from the look point. */
  radius: number;
}

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
  /**
   * A small upright screen is too narrow to show both the walls and what is beside them. Where this is set,
   * such a screen starts here, and once the person enters the camera glides to the pose above (walls and
   * signs in view) over GLIDE_SECONDS. With reduced motion it starts at the pose above and never glides.
   */
  arrivePhone?: CameraPose;
}

/** How long the glide from `arrivePhone` to the walls takes. */
export const GLIDE_SECONDS = 2;

const INDOOR: StartPose = { look: [0.1, 1.0, -0.3], yaw: 0.42, pitch: 0.3, radius: 7.4, radiusPhone: 9.6 };

export const START_POSES: Record<SettingName, StartPose> = {
  studio: INDOOR,
  // The open garden: looks further left and from further back than the reference prototype did, so that on a
  // wide screen the vegetable patch, the apple tree and the sunflowers are in frame together with the walls.
  // A phone starts on the garden itself (patch, sunflowers, apple tree) and glides in to the walls.
  garden: {
    look: [-2.8, 1.0, -0.3],
    yaw: 0.34,
    pitch: 0.32,
    radius: 11,
    radiusPhone: 12.4,
    arrivePhone: { look: [-7.3, 0.9, 0.3], yaw: 0.12, pitch: 0.3, radius: 9 },
  },
  nook: INDOOR,
  cafe: INDOOR,
};

/** The pose the room settles on: what a wide screen shows from the start, and where a phone's glide ends. */
export function settledPose(setting: SettingName, phone: boolean): CameraPose {
  const p = START_POSES[setting];
  return { look: p.look, yaw: p.yaw, pitch: p.pitch, radius: phone ? p.radiusPhone : p.radius };
}

/**
 * The first thing the camera shows. This is the pose a poster or a loop is framed from: the same function,
 * with the same arguments, gives the live room its first frame, so the two line up.
 */
export function firstPose(setting: SettingName, o: { phone: boolean; reducedMotion: boolean }): CameraPose {
  const arrive = START_POSES[setting].arrivePhone;
  return o.phone && arrive && !o.reducedMotion ? arrive : settledPose(setting, o.phone);
}

/** Whether the camera glides after the person enters. */
export function glides(setting: SettingName, o: { phone: boolean; reducedMotion: boolean }): boolean {
  return o.phone && !o.reducedMotion && !!START_POSES[setting].arrivePhone;
}

/** The pose `u` of the way (0 to 1) from one pose to another, easing out of the first and into the second. */
export function glidePose(from: CameraPose, to: CameraPose, u: number): CameraPose {
  const c = Math.max(0, Math.min(1, u));
  const e = c * c * (3 - 2 * c);
  const mix = (a: number, b: number) => a + (b - a) * e;
  return {
    look: [mix(from.look[0], to.look[0]), mix(from.look[1], to.look[1]), mix(from.look[2], to.look[2])],
    yaw: mix(from.yaw, to.yaw),
    pitch: mix(from.pitch, to.pitch),
    radius: mix(from.radius, to.radius),
  };
}
