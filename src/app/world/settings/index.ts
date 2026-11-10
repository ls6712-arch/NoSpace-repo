import type { SettingName } from "../config";
import { buildCafe } from "./cafe";
import { buildGarden } from "./garden";
import { buildNook } from "./nook";
import { buildStudio } from "./studio";
import type { SettingBuilder } from "./types";

/** One builder per setting name in ../config. */
export const SETTINGS: Record<SettingName, SettingBuilder> = { studio: buildStudio, garden: buildGarden, nook: buildNook, cafe: buildCafe };
