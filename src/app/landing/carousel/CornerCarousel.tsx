import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { track } from "../../lib/analytics";
import { LANDING_COPY as COPY } from "../copy";
import { carouselCorners } from "./corners";

// ogl and the shaders load only when the section shows, so the landing page's first paint stays light.
const FlexCarousel = lazy(() => import("./FlexCarousel"));

/** The carousel draws with WebGL2. Without it (old browsers, tests) the section is left out. */
export function webgl2Available(): boolean {
  return typeof window !== "undefined" && typeof window.WebGL2RenderingContext !== "undefined";
}

/** Phones get a smaller card and a gentler bend: the glass is sized from the width, so a narrow row bends harder. */
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

export function CornerCarousel() {
  const corners = useMemo(carouselCorners, []);
  const items = useMemo(() => corners.map(c => ({ src: c.src, alt: c.alt, title: c.name })), [corners]);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const narrow = useNarrow();
  if (!webgl2Available() || corners.length < 3) return null;
  const current = corners[active] ?? corners[0];
  const open = (index: number) => {
    const corner = corners[index];
    if (!corner) return;
    track({ name: "landing_action_clicked", action: "corner", placement: "carousel" });
    navigate(corner.to);
  };
  return <section className="lp-section lp-carousel-section" aria-labelledby="carousel-heading">
    <div className="lp-wide lp-section-intro">
      <div><p className="lp-eyebrow">{COPY.explore}</p><h2 className="lp-h2" id="carousel-heading">{COPY.carouselHeading}</h2></div>
      <p className="lp-lede">{COPY.carouselLine}</p>
    </div>
    <div className="lp-carousel">
      <Suspense fallback={null}>
        <FlexCarousel items={items} label={COPY.carouselLabel} preset="liquid" intro="rise" cardHeight={narrow ? 0.46 : 0.56} bend={narrow ? 0.2 : undefined} gap={narrow ? 10 : 14} radius={14}
          squeeze={0.2} focusOnClick={false} captions onChange={setActive} onSelect={open}/>
      </Suspense>
    </div>
    <div className="lp-wide lp-carousel-foot">
      <Link className="lp-corner-link" to={current.to} onClick={() => track({ name: "landing_action_clicked", action: "corner", placement: "carousel" })}>
        {COPY.cornerLink}: {current.name}<ArrowUpRight size={18} aria-hidden="true"/>
      </Link>
      <a className="lp-photo-credit" href={current.source} target="_blank" rel="noopener noreferrer">{COPY.photo}: {current.credit}</a>
    </div>
  </section>;
}
