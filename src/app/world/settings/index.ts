import type { SettingName } from "../config";
import { buildStudio } from "./studio";
import type { SettingBuilder } from "./types";

/** One builder per setting name in ../config. */
export const SETTINGS: Record<SettingName, SettingBuilder> = { studio: buildStudio };
