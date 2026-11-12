import type * as T from "three";
import type { PieceKind } from "../config";
import type { PieceSpec } from "../layout";
import { bookMaker } from "./book";
import { gameMaker } from "./game";
import { plantMaker } from "./plant";
import { PROFILES, pieceMesh } from "./pot";

/**
 * The piece a Moment becomes in a room. What it looks like depends on the kind of piece the Corner uses and
 * on the Moment's id only (`pieceSpec`), so the same Moment always looks the same. `finished` is whether the
 * Moment's Pursuit is finished: a glazed pot against bare clay, a plant in flower against a seedling, a book
 * standing closed against one lying open, a boxed game against an open one.
 */
interface PieceMaker {
  make(spec: PieceSpec, finished: boolean): T.Object3D;
  /** How tall the piece stands before it is scaled, so it can be kept under a shelf. */
  height(spec: PieceSpec, finished: boolean): number;
}

const MAKERS: Record<PieceKind, PieceMaker> = {
  pot: { make: pieceMesh, height: (spec) => PROFILES[spec.shape].h },
  plant: plantMaker,
  book: bookMaker,
  game: gameMaker,
};

/** The kinds of piece the engine can make. */
export const MADE_KINDS = Object.keys(MAKERS);

export function makePiece(kind: PieceKind, spec: PieceSpec, finished: boolean): T.Object3D {
  return MAKERS[kind].make(spec, finished);
}

export function pieceHeight(kind: PieceKind, spec: PieceSpec, finished: boolean): number {
  return MAKERS[kind].height(spec, finished);
}
