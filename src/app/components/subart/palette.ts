import type { ReactElement } from "react";

/**
 * The illustration palette, defined once: the values live in theme.css
 * (--gen-art-*, with dark-tuned overrides under .dark) and these constants
 * are just `var()` references to them. GeneratedArt.tsx re-exports from
 * here, so the small hobby tiles and the big category scenes can't drift.
 */
export const INK = "var(--gen-art-ink)";
export const PAPER = "var(--gen-art-paper)";
export const PAPER_DARK = "var(--gen-art-paper-dark)";
export const TERRACOTTA = "var(--gen-art-terracotta)";
export const RUST = "var(--gen-art-rust)";
export const MUSTARD = "var(--gen-art-mustard)";
export const MUSTARD_LIGHT = "var(--gen-art-mustard-light)";
export const OLIVE = "var(--gen-art-olive)";
export const SAGE = "var(--gen-art-sage)";
export const DENIM = "var(--gen-art-denim)";
export const DENIM_LIGHT = "var(--gen-art-denim-light)";
export const BLUSH = "var(--gen-art-blush)";
export const CREAM = "var(--gen-art-cream)";
export const LAVENDER = "var(--gen-art-lavender)";
export const NIGHT = "var(--gen-art-night)";

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
