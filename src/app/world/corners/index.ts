import type { CornerWorldConfig } from "../config";
import { boardGames } from "./board-games";
import { gardening } from "./gardening";
import { pottery } from "./pottery";
import { reading } from "./reading";

/** Every Corner that has a room. To add one, write its config in this folder and list it here. */
export const CORNER_WORLDS: readonly CornerWorldConfig[] = [pottery, gardening, reading, boardGames];
