import { BlurText } from "./BlurText";

/**
 * A Corner's name at poster scale: the one place --text-poster is used.
 * Instrument Serif, tight, in the ink colour. The text is the page's h1.
 */
export function PosterTitle({ children, onField = false }: { children: string; onField?: boolean }) {
  return (
    <h1 className={`text-poster ${onField ? "text-[var(--on-field)]" : "text-foreground"}`} style={{ fontFamily: "var(--font-poster)" }}>
      <BlurText text={children} />
    </h1>
  );
}
