import type { ActivityExample } from "./examples";

/** Local activity graphics: animated badges and a stable fallback if a photograph fails. */
export function ActivityArt({ art, tone, animated = false }: Pick<ActivityExample, "art" | "tone"> & { animated?: boolean }) {
  return <div className={`lp-art lp-art-${tone}${animated ? " lp-art-animated" : ""}`} aria-hidden="true" data-art={art}>
    <svg viewBox="0 0 240 150" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      {art === "paint" && <>
        <rect x="42" y="30" width="105" height="95" rx="4" className="lp-art-paper"/>
        <path d="m55 110 30-35 22 18 25-38" className="lp-art-accent" strokeWidth="5"/>
        <circle cx="68" cy="52" r="9" className="lp-art-food"/>
        <path d="m162 98 26-70 8 3-26 70-11 17Z" className="lp-art-accent"/>
      </>}
      {art === "sketch" && <>
        <g transform="rotate(8 105 75)"><rect x="60" y="29" width="88" height="95" rx="4" className="lp-art-paper"/><path className="lp-draw-line" pathLength="1" d="M82 89c-11-14-1-36 17-36s31 23 17 36c-9 9-27 8-34 0ZM100 53l4-12M72 109h65"/></g>
        <g className="lp-moving-pencil" transform="rotate(25 167 76)"><rect x="162" y="33" width="10" height="74" rx="2" className="lp-art-accent"/><path d="m162 107 5 13 5-13Z" className="lp-art-ink"/></g>
      </>}
      {art === "guitar" && <g transform="rotate(24 120 75)">
        <path d="M111 68c-25-21-45 5-27 19-30 28 10 55 36 33 26 22 66-5 36-33 18-14-2-40-27-19Z" className="lp-art-accent"/>
        <rect x="115" y="20" width="10" height="72" rx="2" className="lp-art-paper"/><rect x="110" y="12" width="20" height="26" rx="4" className="lp-art-accent"/><circle cx="120" cy="102" r="9" className="lp-art-ink"/><path d="M118 26v89m4-89v89" className="lp-art-strings"/>
      </g>}
      {art === "walk" && <>
        <path d="M28 124h184M51 78v46m143-61v61"/><circle cx="51" cy="61" r="24" className="lp-art-soft"/><circle cx="194" cy="49" r="23" className="lp-art-soft"/>
        <circle cx="119" cy="36" r="9" className="lp-art-ink"/><path className="lp-walking-figure" d="m118 52 2 35-21 35m21-35 24 35m-26-57-21 16m21-16 25 8" strokeWidth="5"/>
        <rect x="139" y="66" width="23" height="16" rx="3" className="lp-art-paper"/><circle cx="151" cy="74" r="4" className="lp-art-accent"/>
      </>}
      {art === "cook" && <>
        <g className="lp-steam"><path d="M92 43q-8-9 0-18m24 15q-8-9 0-18m24 21q-8-9 0-18"/></g>
        <path d="M67 72c7 74 99 74 106 0" className="lp-art-paper"/><ellipse cx="120" cy="72" rx="53" ry="15" className="lp-art-accent"/>
        <path d="m156 60 21-38" strokeWidth="5"/><ellipse cx="181" cy="17" rx="9" ry="13" className="lp-art-paper"/><path d="M91 69h17m7 8h13m5-11h17" className="lp-art-food" strokeWidth="7"/>
      </>}
      {art === "book" && <>
        <path d="M120 42c-19-13-42-15-65-8v83c24-6 46-4 65 8 19-12 41-14 65-8V34c-23-7-46-5-65 8Z" className="lp-art-paper"/><path d="M120 42v83M70 52l30 5m-30 14 30 5m-30 14 30 5m40-38 30-5m-30 24 30-5m-30 24 30-5"/>
      </>}
      {art === "bird" && <g className="lp-moving-bird">
        <path d="M41 119h157m-39 0 18-14M72 119l-8-11"/><path d="M86 92c-21-12-30-32-22-44l26 19c1-21 14-35 34-35 23 0 37 15 36 35l20 8-21 9c-12 25-49 32-73 8Z" className="lp-art-paper"/><path d="M95 69c5 25 28 27 43 8" className="lp-art-accent"/><circle cx="142" cy="56" r="3" className="lp-art-ink"/><path d="m105 107-5 12m23-12-3 12"/>
      </g>}
    </svg>
  </div>;
}
