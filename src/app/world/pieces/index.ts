import type * as T from "three";
import type { PieceKind } from "../config";
import type { PieceSpec } from "../layout";
import { PROFILES, pieceMesh } from "./pot";

/**
 * The piece a Moment becomes in a room. What it looks like depends on the kind of piece the Corner uses and
 * on the Moment's id only (`pieceSpec`), so the same Moment always looks the same. `finished` is whether the
 * Moment's Pursuit is finished: a glazed pot against bare clay.
 */
interface PieceMaker {
  make(spec: PieceSpec, finished: boolean): T.Mesh;
  /** How tall the piece stands before it is scaled, so it can be kept under a shelf. */
  height(spec: PieceSpec): number;
}

const MAKERS: Record<PieceKind, PieceMaker> = {
  pot: { make: pieceMesh, height: (spec) => PROFILES[spec.shape].h },
};

/** The kinds of piece the engine can make. */
export const MADE_KINDS = Object.keys(MAKERS);

export function makePiece(kind: PieceKind, spec: PieceSpec, finished: boolean): T.Mesh {
  return MAKERS[kind].make(spec, finished);
}

export function pieceHeight(kind: PieceKind, spec: PieceSpec): number {
  return MAKERS[kind].height(spec);
}
