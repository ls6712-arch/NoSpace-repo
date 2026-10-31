/**
 * The four Stub materials (brief: claude-code-brief-stubs-earned.md §5). These are
 * the colours of physical things (card stock, ink, foil, brushed metal), fixed in
 * both themes like a printed ticket, so they live here and nowhere else. Text on a
 * Stub always uses the ink of its own material.
 */
export const STOCK = {
  /** Off-white admission card (Was there) and the Finisher's tear-off. */
  card: "#F3ECDC", // design-token-ignore: card stock of a printed ticket, the same in both themes
  cardInk: "#1D1A14", // design-token-ignore: ink on card stock
  cardMuted: "#6C6352", // design-token-ignore: faded ink on card stock, 5.0:1 on card
  stampRed: "#B23A24", // design-token-ignore: a host's rubber-stamp ink, 5.3:1 on card
} as const;

export const METAL = {
  /** Brushed aluminium band on a Regular. */
  band: "linear-gradient(90deg, #8F8F99 0%, #E9E9EF 22%, #A6A6B0 40%, #F6F6FA 58%, #9A9AA4 78%, #DCDCE2 100%)", // design-token-ignore: brushed metal sheen
  ink: "#2A2A31", // design-token-ignore: engraved text on the metal band
  rivet: "radial-gradient(circle at 35% 35%, #FFFFFF, #7A7A84 70%)", // design-token-ignore: rivet highlight
} as const;

export const GOLD_FOIL = {
  edge: "#D9B26A", // design-token-ignore: gold foil edge of a Finisher
  stamp: "#F1D38C", // design-token-ignore: gold ink stamp, 7.9:1 on the photo shade
  shade: "linear-gradient(180deg, rgba(8, 12, 10, 0) 35%, rgba(8, 12, 10, 0.85) 100%)", // design-token-ignore: darkens a photo under its title
  /** When a Pursuit has no cover yet. */
  fallback: "linear-gradient(180deg, #33493C 0%, #24352C 55%, #13201A 100%)", // design-token-ignore: deep green under the gold, until a cover exists
  sweep: "linear-gradient(118deg, transparent 30%, rgba(255, 236, 186, 0.55) 45%, rgba(255, 255, 255, 0.8) 48%, rgba(255, 236, 186, 0.5) 51%, transparent 64%)", // design-token-ignore: foil highlight
  text: "#FBF6EC", // design-token-ignore: light text on a dark photo
} as const;

/** A drop's own colours come from the drop; this is the default rainbow foil. */
export const HOLO_DEFAULT = ["#FF7AB6", "#FFD36E", "#7FF2C8", "#73AAFF", "#C47BFF"] as const; // design-token-ignore: holographic foil default palette
export const HOLO_INK = "#1B1030"; // design-token-ignore: ink printed on holographic foil, 9:1 on its lightest band

export const PAPER_GRAIN = "repeating-radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 3px)"; // design-token-ignore: paper grain texture
export const RAYS = "repeating-conic-gradient(from 0deg at 50% 118%, rgba(255, 255, 255, 0.22) 0deg 4deg, transparent 4deg 9deg)"; // design-token-ignore: light rays on holographic foil
export const SHEEN = "linear-gradient(115deg, transparent 35%, rgba(255, 255, 255, 0.35) 48%, transparent 60%)"; // design-token-ignore: soft light across paper
export const BARCODE = "repeating-linear-gradient(90deg, #1D1A14 0 2px, transparent 2px 4px, #1D1A14 4px 5px, transparent 5px 9px, #1D1A14 9px 12px, transparent 12px 14px)"; // design-token-ignore: a barcode printed in card ink

export const EDGE = {
  /** Hairline under the metal band, the tear-off's dashes, a rivet's rim. */
  dark: "rgba(0, 0, 0, 0.28)", // design-token-ignore: a printed edge, the same in both themes
  light: "rgba(255, 255, 255, 0.3)", // design-token-ignore: a light rule on the lights-down reveal
  rivetRim: "inset 0 0 0 1px rgba(0, 0, 0, 0.35)", // design-token-ignore: rivet rim
  drop: "0 2.5em 3.75em -1.25em rgba(0, 0, 0, 0.55)", // design-token-ignore: a card's shadow, scaled with the Stub
} as const;

export const CARD_LINES = "repeating-linear-gradient(0deg, rgba(120, 100, 70, 0.05) 0 1px, transparent 1px 4px)"; // design-token-ignore: faint lines in card stock
export const spotlight = (x: string, y: string) => `radial-gradient(circle at ${x} ${y}, rgba(255, 255, 255, 0.7), transparent 38%)`; // design-token-ignore: light on foil where the pointer is

/**
 * Sizes inside a Stub. A Stub is a printed object drawn at 248px and scaled as a
 * whole by its font size, so its type and corners are in em and sit outside the
 * app's type scale on purpose (brief §5).
 */
export const ART = {
  frame: "rounded-[1.125em]", // design-token-ignore: a Stub's corner, scaled with the Stub
  label: "text-[0.75em] font-semibold tracking-[0.14em]", // design-token-ignore: small print on a Stub, scaled with it
  fine: "text-[0.875em]", // design-token-ignore: fine print on a Stub, scaled with it
  tiny: "text-[0.7em] font-semibold", // design-token-ignore: the date inside a host's stamp, scaled with it
  month: "text-[3.1em] tracking-[0.02em]", // design-token-ignore: the month on a Regular's metal band
  big: "text-[2.1em] leading-[0.95]", // design-token-ignore: a Stub's title
  bigger: "text-[2.6em] leading-[0.92]", // design-token-ignore: a Space's name on a Was there Stub
  title: "text-[1.75em] leading-none", // design-token-ignore: a Finisher's title over its photo
  count: "text-[1.6em]", // design-token-ignore: the figure on a Stub's tear-off
  stampWord: "text-[1.1em] leading-none whitespace-nowrap", // design-token-ignore: the word inside a host's stamp
  stampTag: "text-[0.95em] tracking-[0.06em] rounded-[0.5em]", // design-token-ignore: the Finished stamp, scaled with the Stub
  edition: "text-[6.75em] leading-[0.9] tracking-[-0.04em]", // design-token-ignore: a drop's edition number
} as const;
