import type { CornerWorldConfig } from "../config";
import { pottery } from "./pottery";

/** Every Corner that has a room. To add one, write its config in this folder and list it here. */
export const CORNER_WORLDS: readonly CornerWorldConfig[] = [pottery];
