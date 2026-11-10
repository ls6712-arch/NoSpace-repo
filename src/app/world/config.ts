/**
 * What a Corner's room is made from. One engine draws every room; a Corner supplies a config: which setting
 * (the furniture), which kind of piece a Moment becomes, the characters, and the words. Adding a Corner is
 * adding a config under ./corners. See docs/corner-worlds.md.
 *
 * Plain data and plain checks only. Nothing here imports three.js, so the Corner page and the tests can read
 * configs without downloading the 3D code.
 */

/** The settings the engine can build (./settings). */
export const SETTING_NAMES = ["studio", "garden", "nook", "cafe"] as const;
export type SettingName = (typeof SETTING_NAMES)[number];

/** What a Moment can look like in a room (./pieces). */
export const PIECE_KINDS = ["pot", "plant", "book", "game"] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];

/** What a character can be doing (./characters/actions). */
export const ACTION_NAMES = ["wheel", "press", "glaze", "water", "dig", "read", "write", "dice", "move", "think"] as const;
export type ActionName = (typeof ACTION_NAMES)[number];

export const POSES = ["seated", "standing", "kneel"] as const;
export type Pose = (typeof POSES)[number];

/** Background sound a room can have (./sound). Rain plays at night in every room. */
export const SOUND_BEDS = ["wheel", "birds", "wind", "fire", "clock", "cafe"] as const;
export type SoundBed = (typeof SOUND_BEDS)[number];

/** An action that needs a prop only one setting has. */
export const ACTION_NEEDS_SETTING: Partial<Record<ActionName, SettingName>> = { wheel: "studio", dice: "cafe", move: "cafe" };

/** Colours are numbers, 0xrrggbb: the colour of a 3D material, not a page colour, so not a theme token. */
export interface CharacterLook {
  skin: number;
  shirt: number;
  pants: number;
  /** No apron when left out. */
  apron?: number;
  hair: number;
  bun?: boolean;
  glasses?: boolean;
}

export interface CharacterConfig {
  name: string;
  pose: Pose;
  action: ActionName;
  /** Where they stand or sit: x and z on the floor. */
  at: readonly [number, number];
  /** Which way they face, radians. */
  rot: number;
  look: CharacterLook;
  /** What they say, each shown with the Character tag. */
  lines: readonly string[];
  /** Said when the pot on the wheel collapses (the wheel action). */
  collapseLine?: string;
  /** Said now and then when the dice land well (the think action). */
  cheerLine?: string;
  /** The cover of the book they hold (the read action). 0xrrggbb. */
  bookColor?: number;
}

export const PET_KINDS = ["cat", "dog"] as const;
export type PetKind = (typeof PET_KINDS)[number];

export interface PetConfig {
  name: string;
  /** A cat when left out. */
  kind?: PetKind;
  at: readonly [number, number];
  rot: number;
  color: number;
  dark: number;
  /** What tapping it says. */
  line: string;
}

export interface WallCopy {
  /** The wall's name: on its sign, its tag in the room, its panel section and in Log a Moment. */
  label: string;
  /** After the number under the sign: "2 in progress". Counts pieces, never people. */
  sub: string;
}

export interface CornerWorldConfig {
  /** The Corner, as `space-slug/corner-slug`. */
  key: string;
  slug: string;
  name: string;
  setting: SettingName;
  pieceKind: PieceKind;
  copy: {
    /** The line on the entry screen, under the Corner's name. */
    intro: string;
    /** Read out for the canvas. */
    stageLabel: string;
    walls: { still: WallCopy; made: WallCopy };
    /** Your shelf, with nothing on it. */
    yoursEmpty: string;
    /** Your shelf, with pieces. */
    yoursNote: string;
    /** The one-time hint under the first sign. */
    hint: string;
  };
  /** In the order they take turns speaking. */
  characters: readonly CharacterConfig[];
  pet?: PetConfig;
  /** A room may have two pets. */
  secondPet?: PetConfig;
  /** Who says what when the viewer walks in. */
  greeting: readonly [string, string];
  sounds: { bed: readonly SoundBed[] };
}

/** A room's pets: none, one or two. */
export function petsOf(config: Pick<CornerWorldConfig, "pet" | "secondPet">): PetConfig[] {
  return [config.pet, config.secondPet].filter((p): p is PetConfig => !!p);
}

/** Top-level keys a config may have. The reference prototype's example people, Walls and chat never ship. */
const ALLOWED_KEYS = ["key", "slug", "name", "setting", "pieceKind", "copy", "characters", "pet", "secondPet", "greeting", "reactions", "stations", "board", "sounds", "pursuit"];
const PROTOTYPE_ONLY_KEYS = ["wall", "edges", "chat", "activities"];
const PROTOTYPE_ONLY_COPY = ["pmeta", "chatHere"];
/** Names used for example people in the reference prototype. None may appear in a config. */
export const EXAMPLE_PEOPLE = ["Maya", "Alex", "Priya", "Jordan", "Ines", "Jun", "Sam"];

const isColor = (c: unknown) => typeof c === "number" && Number.isInteger(c) && c >= 0 && c <= 0xffffff;

/**
 * Everything wrong with a config, as plain sentences; empty when it is fine. The rules of the reference
 * build script (build_corner.py), plus the ones that keep prototype content out.
 */
export function checkConfig(input: unknown): string[] {
  const errs: string[] = [];
  const cfg = input as Partial<CornerWorldConfig> & Record<string, unknown>;
  if (!cfg || typeof cfg !== "object") return ["not a config"];
  for (const k of ["key", "slug", "name", "setting", "pieceKind", "copy", "characters", "greeting", "sounds"]) if (!(k in cfg)) errs.push(`missing "${k}"`);
  if (errs.length) return errs;

  for (const k of Object.keys(cfg)) {
    if (PROTOTYPE_ONLY_KEYS.includes(k)) errs.push(`"${k}" is prototype-only and must not ship`);
    else if (!ALLOWED_KEYS.includes(k)) errs.push(`unknown key "${k}"`);
  }
  for (const k of PROTOTYPE_ONLY_COPY) if (k in (cfg.copy as object)) errs.push(`copy.${k} is prototype-only and must not ship`);

  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(String(cfg.key))) errs.push("key must be space-slug/corner-slug");
  else if (String(cfg.key).split("/")[1] !== cfg.slug) errs.push("slug must be the Corner part of key");
  if (!(SETTING_NAMES as readonly string[]).includes(String(cfg.setting))) errs.push(`setting must be one of ${SETTING_NAMES.join(", ")}`);
  if (!(PIECE_KINDS as readonly string[]).includes(String(cfg.pieceKind))) errs.push(`pieceKind must be one of ${PIECE_KINDS.join(", ")}`);

  const characters = cfg.characters ?? [];
  if (characters.length < 1) errs.push("needs at least one character");
  const names = new Set<string>();
  for (const c of characters) {
    if (names.has(c.name)) errs.push(`character ${c.name} appears twice`);
    names.add(c.name);
    if (!(ACTION_NAMES as readonly string[]).includes(c.action)) errs.push(`character ${c.name}: action must be one of ${ACTION_NAMES.join(", ")}`);
    if (!(POSES as readonly string[]).includes(c.pose)) errs.push(`character ${c.name}: pose must be seated, standing or kneel`);
    const need = ACTION_NEEDS_SETTING[c.action];
    if (need && cfg.setting !== need) errs.push(`character ${c.name}: action "${c.action}" only works in the ${need} setting`);
    if (!c.lines?.length) errs.push(`character ${c.name} has nothing to say`);
    for (const [part, colour] of Object.entries(c.look ?? {})) if (typeof colour !== "boolean" && !isColor(colour)) errs.push(`character ${c.name}: look.${part} must be a colour, 0xrrggbb`);
    if (c.bookColor !== undefined && !isColor(c.bookColor)) errs.push(`character ${c.name}: bookColor must be a colour, 0xrrggbb`);
  }
  if (cfg.secondPet && !cfg.pet) errs.push("secondPet needs a pet: a room's one pet goes in pet");
  for (const pet of petsOf(cfg as CornerWorldConfig)) {
    if (names.has(pet.name)) errs.push(`the pet ${pet.name} shares a name with someone else in the room`);
    if (!isColor(pet.color) || !isColor(pet.dark)) errs.push("pet: color and dark must be colours, 0xrrggbb");
    if (pet.kind !== undefined && !(PET_KINDS as readonly string[]).includes(pet.kind)) errs.push(`pet ${pet.name}: kind must be one of ${PET_KINDS.join(", ")}`);
    if (!pet.line) errs.push(`pet ${pet.name} has no line`);
    names.add(pet.name);
  }
  if (!cfg.greeting || !characters.some((c) => c.name === cfg.greeting![0])) errs.push("greeting must be said by a character");

  const stations = (cfg as { stations?: Record<string, { who?: string }> }).stations;
  for (const [id, s] of Object.entries(stations ?? {})) if (!names.has(String(s.who))) errs.push(`station ${id}: "${s.who}" is not a character`);

  for (const wall of ["still", "made"] as const) {
    const w = cfg.copy?.walls?.[wall];
    if (!w?.label || !w?.sub) errs.push(`copy.walls.${wall} needs a label and a sub`);
  }
  for (const bed of cfg.sounds?.bed ?? []) if (!(SOUND_BEDS as readonly string[]).includes(bed)) errs.push(`sounds.bed: "${bed}" is not a sound bed`);

  const blob = JSON.stringify(cfg);
  if (/[–—]/.test(blob)) errs.push("copy contains an em or en dash; rewrite without it");
  for (const person of EXAMPLE_PEOPLE) if (new RegExp(`\\b${person}\\b`).test(blob)) errs.push(`"${person}" is an example person from the prototype`);
  return errs;
}
