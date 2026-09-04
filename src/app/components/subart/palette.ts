import type { ReactElement } from "react";

/**
 * Shared palette for the per-hobby illustrations, kept identical to
 * GeneratedArt.tsx so the small hobby tiles read as the same illustration
 * family as the big category scenes.
 */
export const INK = "#3A2A1F";
export const PAPER = "#F1E3C8";
export const PAPER_DARK = "#E8D5AC";
export const TERRACOTTA = "#C96F49";
export const RUST = "#A8492F";
export const MUSTARD = "#E3A83E";
export const MUSTARD_LIGHT = "#F0C572";
export const OLIVE = "#7C8A54";
export const SAGE = "#A9B98C";
export const DENIM = "#5C7C97";
export const DENIM_LIGHT = "#89A6BC";
export const BLUSH = "#D98A82";
export const CREAM = "#FBF3E2";

/**
 * One hobby's drawing. Returns raw SVG children only — the wrapper in
 * SubHobbyArt.tsx supplies the <svg>, the 200x200 viewBox, the parchment
 * ground and the shadow, so a drawing never declares its own <svg>.
 *
 * Drawing conventions every entry follows:
 *   - 200x200 viewBox; the object sits centred on x=100, resting on y=150
 *   - roughly 90-110px tall, so tiles look consistent at a glance
 *   - flat fills from the palette above, no gradients, no text, no images
 */
export type SubArtDrawing = () => ReactElement;
