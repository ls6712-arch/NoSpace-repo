import { Suspense, lazy, useEffect, useState } from "react";
import { LANDING_COPY as COPY } from "../copy";
import { webgl2Available } from "../carousel/CornerCarousel";
import { useLandingMotion } from "../LandingMotion";

// ogl and the shaders load with the carousel's chunk, only when the page asks for them.
const SatinRibbon = lazy(() => import("./SatinRibbon"));

function useNarrow() {
  const query = "(max-width: 743px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const list = window.matchMedia?.(query);
    if (!list) return;
    const update = () => setNarrow(list.matches);
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, []);
  return narrow;
}

/**
 * The maxxing words on a slow black satin ribbon between the hero and the Corner carousel.
 * Decorative and hidden from screen readers. Without WebGL2 it is a flat band with the same words;
 * with motion off it holds still.
 */
export function MaxxingRibbon() {
  const { enabled } = useLandingMotion();
  const narrow = useNarrow();
  const flat = <p className="lp-ribbon-flat">{COPY.maxxing.join(" · ")}</p>;
  return <div className="lp-ribbon" aria-hidden="true">
    {webgl2Available()
      ? <Suspense fallback={null}>
          <SatinRibbon className="lp-ribbon-canvas" words={COPY.maxxing} animate={enabled}
            ribbonWidth={narrow ? 46 : 68} amplitude={narrow ? 36 : 74} depth={narrow ? 70 : 130} frequency={narrow ? 0.9 : 1.1}/>
        </Suspense>
      : flat}
  </div>;
}
