import type { SettingName } from "../config";

/**
 * The look of the shared room for each setting: floor, walls, trim, the window, the back shelves, the lamps
 * and the corkboard. The furniture itself is in ../settings. Colours are 0xrrggbb.
 */
export interface RoomTheme {
  /** No left wall: the room opens onto a garden (pergola, path, beds). */
  open: boolean;
  floor: "wood" | "tile";
  /** Multiplied into the wooden floor. */
  floorTint: number;
  /** The back wall. */
  wallBack: { kind: "plaster" | "plank"; color: number };
  wallLeft: number;
  trim: number;
  /** The window frame. */
  frame: number;
  /** Shelves, benches and stools. */
  shelf: number;
  rack: number;
  rackPost: number;
  /** The window in the left wall: from z, to z, from y, to y. */
  win: readonly [number, number, number, number];
  /** Four full-height shelves in a bookcase, against three open ones. */
  tall: boolean;
  /** Where the pendant lamps hang: x, y, z. */
  lamps: readonly (readonly [number, number, number])[];
  shade: number;
  /** The corkboard: frame and face. */
  board: readonly [number, number];
  /** A chalkboard, not cork. */
  chalk: boolean;
  /** How strongly the setting's warm glow (a kiln, a fire) follows the light. 0 for none. */
  warmMul: number;
  /** Sun and sky brightness against the studio's. */
  bright: number;
}

export const THEMES: Record<SettingName, RoomTheme> = {
  studio: {
    open: false, floor: "wood", floorTint: 0xffffff, wallBack: { kind: "plaster", color: 0xe6d2b8 }, wallLeft: 0xead8bf, trim: 0x5a3b26, frame: 0x3f5a4c,
    shelf: 0x9b7a62, rack: 0x9b7a62, rackPost: 0x5a3b26, win: [-1.7, 0.7, 1.2, 3.2], tall: false,
    lamps: [[-1.6, 2.85, 0.4], [1.3, 3.0, 0.9], [2.5, 2.8, -1.6]], shade: 0x2f4a3e, board: [0x5a3b26, 0xc79a63], chalk: false, warmMul: 1, bright: 1,
  },
  garden: {
    open: true, floor: "tile", floorTint: 0xffffff, wallBack: { kind: "plank", color: 0x8fa58a }, wallLeft: 0xece7da, trim: 0x4d5f48, frame: 0xf3f1e8,
    shelf: 0x8a6a4c, rack: 0x6f8a6a, rackPost: 0x3f4f3c, win: [-3.4, 2.4, 0.7, 3.8], tall: false,
    lamps: [[-1.6, 2.95, 0.4], [1.4, 3.05, 0.75], [2.4, 2.95, -1.5]], shade: 0xe2ddc9, board: [0x3a2a20, 0x2f3d34], chalk: true, warmMul: 0, bright: 1.15,
  },
  nook: {
    open: false, floor: "wood", floorTint: 0xb9a593, wallBack: { kind: "plaster", color: 0x5d7366 }, wallLeft: 0xd8c6ab, trim: 0x3b2a20, frame: 0x2f2420,
    shelf: 0x6b4a35, rack: 0x6b4a35, rackPost: 0x3b2a20, win: [-1.9, 0.9, 1.0, 3.3], tall: true,
    lamps: [[-1.6, 2.6, 0.4], [1.6, 3.0, 0.3]], shade: 0x7a3b22, board: [0x3b2a20, 0xb88a5a], chalk: false, warmMul: 1.5, bright: 0.92,
  },
  cafe: {
    open: false, floor: "wood", floorTint: 0xd6b8a2, wallBack: { kind: "plaster", color: 0xc98a6a }, wallLeft: 0xe6d1b6, trim: 0x3a2a22, frame: 0x2f4a3e,
    shelf: 0x7a5236, rack: 0x7a5236, rackPost: 0x3a2a22, win: [-1.7, 0.7, 1.2, 3.2], tall: true,
    lamps: [[0.95, 2.55, 0.55], [-1.6, 2.7, 0.4], [2.5, 2.9, -1.5]], shade: 0xb8902f, board: [0x3a2a22, 0xc79a63], chalk: false, warmMul: 0, bright: 1,
  },
};
