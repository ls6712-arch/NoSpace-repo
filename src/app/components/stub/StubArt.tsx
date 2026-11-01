import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "../ui/utils";
import { plural } from "../../lib/plural";
import { KIND_LABEL, type StubFace } from "../../lib/stubFace";
import { editionLabel } from "../../lib/stubs";
import { ART, BARCODE, CARD_LINES, EDGE, GOLD_FOIL, HOLO_DEFAULT, HOLO_INK, METAL, PAPER_GRAIN, RAYS, SHEEN, STOCK, spotlight } from "../../lib/stubMaterials";
import { ImageWithFallback } from "../ImageWithFallback";

/** The artwork is drawn at 248 by 420 and scaled by font size, so every size is the same Stub. */
const BASE_W = 248;
const RATIO = 420 / 248;
/** Where the perforation sits, in em of the 16px base. */
const PERF_EM = 19.875;

const notches = `radial-gradient(circle 0.75em at 0 ${PERF_EM}em, transparent 98%, #000) left / 51% 100% no-repeat, radial-gradient(circle 0.75em at 100% ${PERF_EM}em, transparent 98%, #000) right / 51% 100% no-repeat`; // design-token-ignore: mask alpha only, never painted

interface Tilt {
  /** 0 to 1 across and down; 0.5 is flat. */
  x: number;
  y: number;
  on: boolean;
}

/**
 * Light follows the pointer, and on a phone the phone's tilt once the person has
 * opened a Stub full size (iOS asks once, from that tap). Nothing moves under
 * reduced motion.
 */
function useTilt(enabled: boolean) {
  const [t, setT] = useState<Tilt>({ x: 0.5, y: 0.5, on: false });
  const frame = useRef(0);
  const set = useCallback((next: Tilt) => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setT(next));
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      const x = Math.min(1, Math.max(0, 0.5 + e.gamma / 60));
      const y = Math.min(1, Math.max(0, 0.5 + (e.beta - 45) / 60));
      set({ x, y, on: true });
    };
    window.addEventListener("deviceorientation", onTilt);
    return () => window.removeEventListener("deviceorientation", onTilt);
  }, [enabled, set]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    set({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, on: true });
  };
  const onPointerLeave = () => enabled && set({ x: 0.5, y: 0.5, on: false });
  return { t, onPointerMove, onPointerLeave };
}

/** iOS needs a tap before it shares the phone's tilt. Call from a click. Best effort. */
export async function askForTilt(): Promise<void> {
  try {
    const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (D?.requestPermission) await D.requestPermission();
  } catch {
    // Declined or not offered: the pointer and the automatic sweep still work.
  }
}

/** Words for screen readers: the kind, what it's for, and when. */
export function stubLabel(f: StubFace): string {
  const extra = f.kind === "drop" && f.edition ? `, ${editionLabel(f.edition)}` : f.kind === "regular" && f.monthLong ? `, ${f.monthLong}` : "";
  return `${KIND_LABEL[f.kind]} Stub: ${f.title}${extra}, ${f.day}`;
}

/**
 * A Stub as a keepsake (brief §5): Regular is paper with a metal band, Finisher is
 * the Pursuit's photo under gold foil, Was there is a stamped admission ticket, and
 * a drop is holographic and numbered. Material says how rare it is, never a label.
 */
export function StubArt({
  face,
  width = BASE_W,
  interactive = false,
  shimmer = false,
  className,
  style,
}: {
  face: StubFace;
  width?: number;
  /** Tilt with the pointer or phone. Use on a full-size Stub. */
  interactive?: boolean;
  /** A slow foil sweep on its own, for rare Stubs resting on a Shelf. */
  shimmer?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const reduce = useReducedMotion() ?? false;
  const { t, onPointerMove, onPointerLeave } = useTilt(interactive && !reduce);
  const rx = ((0.5 - t.y) * 18).toFixed(1);
  const ry = ((t.x - 0.5) * 22).toFixed(1);
  const lightX = `${Math.round(t.x * 100)}%`;
  const lightY = `${Math.round(t.y * 100)}%`;
  const sweep = shimmer && !reduce && !t.on;

  const frame: CSSProperties = {
    width,
    height: Math.round(width * RATIO),
    fontSize: (width / BASE_W) * 16,
    transform: t.on ? `rotateX(${rx}deg) rotateY(${ry}deg) scale(1.03)` : undefined,
    transition: "transform var(--duration-fast) var(--ease-standard)",
    boxShadow: EDGE.drop,
    WebkitMask: notches,
    mask: notches,
    ...style,
  };

  return (
    <div style={{ perspective: "70em", fontSize: (width / BASE_W) * 16 }} className={cn("inline-block", className)}>
      <div
        role="img"
        aria-label={stubLabel(face)}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        style={frame}
        className={cn("relative overflow-hidden", ART.frame)}
      >
        {face.kind === "regular" && <Regular face={face} />}
        {face.kind === "finish" && <Finisher face={face} />}
        {face.kind === "event" && <WasThere face={face} />}
        {face.kind === "drop" && <Drop face={face} lightX={lightX} lightY={lightY} tiltX={t.x} />}

        {/* The light that moves with you; on a resting rare Stub it sweeps by itself. */}
        <span
          aria-hidden="true"
          style={{
            background: face.kind === "finish" ? GOLD_FOIL.sweep : SHEEN,
            backgroundSize: "260% 260%",
            backgroundPosition: `${lightX} 50%`,
            mixBlendMode: face.kind === "finish" ? "overlay" : "soft-light",
          }}
          className={cn("pointer-events-none absolute inset-0", sweep && "motion-safe:animate-[stub-sweep_4.5s_ease-in-out_infinite]")}
        />
      </div>
    </div>
  );
}

const display = "font-[family-name:var(--font-display)] font-extrabold";
const smallCaps = ART.label;

function Perforation({ ink }: { ink: string }) {
  return <span aria-hidden="true" style={{ top: `${PERF_EM - 0.0625}em`, borderColor: ink }} className="absolute inset-x-[1.125em] border-t-2 border-dashed opacity-40" />;
}

function Regular({ face }: { face: StubFace }) {
  const ink = "var(--ink)";
  return (
    <div style={{ background: `${PAPER_GRAIN}, ${face.color}`, color: ink }} className="absolute inset-0">
      <div style={{ background: METAL.band, color: METAL.ink, borderColor: EDGE.dark }} className="absolute inset-x-0 top-0 flex h-[5.5em] items-center justify-between border-b-2 px-[1.25em]">
        <span aria-hidden="true" style={{ background: METAL.rivet, boxShadow: EDGE.rivetRim }} className="size-[0.75em] rounded-full" />
        <span className={cn(display, ART.month)}>{face.monthShort}</span>
        <span aria-hidden="true" style={{ background: METAL.rivet, boxShadow: EDGE.rivetRim }} className="size-[0.75em] rounded-full" />
      </div>
      <div className="absolute inset-x-[1.375em] top-[7.5em] flex flex-col gap-[0.25em]">
        <span className={smallCaps}>{KIND_LABEL.regular}</span>
        <span className={cn(display, "line-clamp-3", ART.big)}>{face.title}</span>
      </div>
      <Perforation ink={ink} />
      <div className="absolute inset-x-0 bottom-0 flex h-[6.375em] items-center justify-between px-[1.375em]">
        <span className={cn(display, ART.count)}>{plural(10, "day")}</span>
        <span className={smallCaps}>{face.monthLong}</span>
      </div>
    </div>
  );
}

function Finisher({ face }: { face: StubFace }) {
  return (
    <div style={{ boxShadow: `inset 0 0 0 2px ${GOLD_FOIL.edge}` }} className="absolute inset-0 overflow-hidden">
      <div style={{ background: GOLD_FOIL.fallback }} className="absolute inset-x-0 top-0 h-[19.875em]">
        {face.photoUrl && <ImageWithFallback src={face.photoUrl} alt="" width={496} className="size-full" />}
        <span aria-hidden="true" style={{ background: GOLD_FOIL.shade }} className="absolute inset-0" />
      </div>
      <span
        style={{ color: GOLD_FOIL.stamp, borderColor: GOLD_FOIL.stamp }}
        className={cn(display, ART.stampTag, "absolute top-[1.125em] right-[1em] rotate-[9deg] border-[0.16em] px-[0.6em] py-[0.25em]")}
      >
        Finished
      </span>
      <div style={{ color: GOLD_FOIL.text }} className="absolute inset-x-[1.375em] top-[12.5em] flex flex-col gap-[0.25em]">
        <span style={{ color: GOLD_FOIL.stamp }} className={smallCaps}>
          {KIND_LABEL.finish}
        </span>
        <span className={cn(display, "line-clamp-3", ART.title)}>{face.title}</span>
      </div>
      <div style={{ background: STOCK.card, color: STOCK.cardInk, borderColor: EDGE.dark }} className="absolute inset-x-0 top-[19.875em] bottom-0 flex items-center justify-between border-t-2 border-dashed px-[1.375em]">
        <span className={cn(display, ART.count)}>{face.goal ? `${face.goal}/${face.goal}` : face.cornerName ?? ""}</span>
        <span className={smallCaps}>{face.day}</span>
      </div>
    </div>
  );
}

function WasThere({ face }: { face: StubFace }) {
  const full = !!face.hostName || !!face.eventTitle;
  return (
    <div style={{ background: `${CARD_LINES}, ${STOCK.card}`, color: STOCK.cardInk }} className="absolute inset-0">
      <span aria-hidden="true" style={{ background: face.color }} className="absolute inset-x-0 top-0 h-[0.75em]" />
      <div style={{ color: STOCK.cardMuted }} className={cn(smallCaps, "absolute inset-x-[1.375em] top-[2.1em] flex justify-between")}>
        <span>Admit one</span>
        {face.serial ? <span style={{ color: STOCK.stampRed }}>{editionLabel(face.serial)}</span> : null}
      </div>
      <div className="absolute inset-x-[1.375em] top-[3.9em]">
        <p className={cn(display, ART.bigger, "m-0 line-clamp-3")}>{face.title}</p>
      </div>
      {full && (
        <p style={{ color: STOCK.cardMuted }} className={cn(ART.fine, "absolute inset-x-[1.375em] top-[11.9em] m-0 line-clamp-2 max-w-[60%] leading-snug")}>
          {[face.eventTitle, face.neighborhood].filter(Boolean).join(" · ")}
        </p>
      )}
      <div
        aria-hidden="true"
        style={{ color: STOCK.stampRed, borderColor: STOCK.stampRed, boxShadow: `inset 0 0 0 0.3em ${STOCK.card}, inset 0 0 0 0.4em ${STOCK.stampRed}` }}
        className="absolute top-[12.25em] left-[7.25em] flex size-[7em] -rotate-[14deg] flex-col items-center justify-center rounded-full border-[0.19em] opacity-90"
      >
        <span className={cn(display, ART.stampWord)}>Was there</span>
        <span className={cn(ART.tiny, "mt-[0.2em]")}>{face.day}</span>
      </div>
      <Perforation ink={STOCK.cardInk} />
      <div className="absolute inset-x-[1.375em] top-[21.1em] flex flex-col gap-[0.5em]">
        <span aria-hidden="true" style={{ background: BARCODE }} className="h-[2.1em]" />
        <span style={{ color: STOCK.cardMuted }} className={smallCaps}>
          {face.hostName ? `Confirmed by ${face.hostName}` : face.cornerName ?? ""}
        </span>
      </div>
    </div>
  );
}

function Drop({ face, lightX, lightY, tiltX }: { face: StubFace; lightX: string; lightY: string; tiltX: number }) {
  const colors = (face.palette?.length ? face.palette : HOLO_DEFAULT).slice(0, 6);
  const angle = Math.round(100 + tiltX * 80);
  const holo = `linear-gradient(${angle}deg, ${[...colors, colors[0]].join(", ")})`;
  return (
    <div style={{ background: holo, backgroundSize: "300% 300%", backgroundPosition: `${lightX} 50%`, color: HOLO_INK }} className="absolute inset-0">
      <span aria-hidden="true" style={{ background: RAYS }} className="absolute inset-0" />
      <div className={cn(smallCaps, "absolute inset-x-[1.375em] top-[1.5em] flex justify-between")}>
        <span>Soosh drop</span>
        <span>{face.day}</span>
      </div>
      <div className="absolute top-[3.25em] left-[1.1em]">
        <p className={cn(display, ART.edition, "m-0")}>{face.edition ? String(face.edition).padStart(3, "0") : "000"}</p>
      </div>
      <p className={cn(ART.fine, "absolute top-[11.6em] left-[1.6em] m-0 font-semibold")}>{face.editionsTotal ? `of ${face.editionsTotal}` : "Still open"}</p>
      <div className="absolute inset-x-[1.375em] top-[13.6em]">
        <p className={cn(display, ART.big, "m-0 line-clamp-2")}>{face.title}</p>
      </div>
      <Perforation ink={HOLO_INK} />
      <div className={cn(smallCaps, "absolute inset-x-[1.375em] bottom-0 flex h-[6.375em] items-center justify-between")}>
        <span>{face.goal ? plural(face.goal, "Moment") : KIND_LABEL.drop}</span>
        <span>{face.cornerName ?? ""}</span>
      </div>
      <span aria-hidden="true" style={{ background: spotlight(lightX, lightY) }} className="absolute inset-0 mix-blend-overlay" />
    </div>
  );
}
