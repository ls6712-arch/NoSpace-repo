import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import { haptic } from "../../lib/motionTokens";

/**
 * Stubby, Soosh's character: a ticket with a face. It never talks. It acts.
 *
 * - The yellow body is you (two eyes, two brows, one mouth, no arms or legs).
 * - The white tab is the plan. What you pick gets stamped there.
 * - The perforation is the invite. Tear it and the tab is your friend's half.
 *
 * It moves like a cartoon, not a switch between poses:
 * - anticipation: it crouches before a jump and braces before a tear;
 * - squash and stretch: tall on the way up, flat on landing, a wobble to rest;
 * - follow-through: the tab flaps after a landing, stamps splat ink;
 * - idle life: it breathes, blinks at random (sometimes twice), glances
 *   around, and with `followPointer` its eyes follow the pointer.
 *
 * Set `state` and Stubby plays that reaction once, then rests in the look the
 * state leaves behind (a stamp stays stamped, torn stays torn). `knock`,
 * `thinking` and `sleep` keep going until the state changes.
 *
 * Character motion is the one place that does not use motionTokens: its
 * timings are part of the character (approved with the Stubby brief).
 * Colours come from the `--stubby-*` tokens, so the palette can change
 * without touching this file. Under reduced motion every state still shows
 * its face and stamp; nothing moves.
 *
 * One rule runs through every state: Stubby never makes anyone feel bad.
 */

export type StubbyState =
  | "idle" // waiting on any screen: breathes, blinks, glances around
  | "stamped" // you picked something: crouch, jump, a star slams onto the tab
  | "unstamped" // you un-picked it: the stamp fades, a small sigh
  | "yours" // you added a pass you already have: winks, the tab is punched
  | "shrug" // you skipped a question: glances away, shrugs twice
  | "torn" // you invited a friend: braces, the tab rips off and flies out
  | "rejoined" // your friend said yes: their half flies back, star eyes, two jumps
  | "tilt" // your friend can't make it: the half drifts back, head tilts
  | "arrived" // a friend invited you: their stamped half slides in
  | "knock" // it's the day: leans in and knocks twice, every few seconds
  | "checkedIn" // you got there: a hand stamp slams down, ink splats
  | "done" // you logged it: a spinning jump, the tab gets a check
  | "letGo" // a plan passed: eyes close, a slow sway, the stamp fades. No guilt
  | "sleep" // weeks away: asleep with floating z's until the state changes
  | "thinking" // Soosh is finding things: looks up, bobs, the stamp slot spins
  | "cool"; // the resting look on the welcome and dark screens

type Face = "idle" | "happy" | "giggle" | "wink" | "shrug" | "tilt" | "surprised" | "thinking" | "sleep" | "cool" | "brace" | "starry";
type Stamp = "none" | "star" | "punch" | "check" | "hand";

/** The look each state leaves behind once its reaction has played. */
const REST: Record<StubbyState, { face: Face; stamp?: Stamp; torn?: boolean }> = {
  idle: { face: "idle" },
  stamped: { face: "idle", stamp: "star" },
  unstamped: { face: "idle", stamp: "none" },
  yours: { face: "idle", stamp: "punch" },
  shrug: { face: "idle" },
  torn: { face: "idle", stamp: "star", torn: true },
  rejoined: { face: "idle", stamp: "star", torn: false },
  tilt: { face: "idle", torn: false },
  arrived: { face: "idle", stamp: "star", torn: false },
  knock: { face: "idle", stamp: "star" },
  checkedIn: { face: "idle", stamp: "hand" },
  done: { face: "idle", stamp: "check" },
  letGo: { face: "idle", stamp: "none" },
  sleep: { face: "sleep" },
  thinking: { face: "thinking" },
  cool: { face: "cool" },
};

// ---------- drawing (a 240 by 150 box; perforation at x 172) ----------

const OUTLINE =
  "M 26 14 H 160 A 12 12 0 0 0 184 14 H 214 A 18 18 0 0 1 232 32 V 112 A 18 18 0 0 1 214 130 H 184 A 12 12 0 0 0 160 130 H 26 A 18 18 0 0 1 8 112 V 32 A 18 18 0 0 1 26 14 Z";
const BODY_FILL =
  "M 26 14 H 160 A 12 12 0 0 0 172 26 V 118 A 12 12 0 0 0 160 130 H 26 A 18 18 0 0 1 8 112 V 32 A 18 18 0 0 1 26 14 Z";
const TAB_FILL =
  "M 172 26 A 12 12 0 0 0 184 14 H 214 A 18 18 0 0 1 232 32 V 112 A 18 18 0 0 1 214 130 H 184 A 12 12 0 0 0 172 118 Z";
const BODY_TORN =
  "M 26 14 H 166 L 160 26 L 168 38 L 160 50 L 168 62 L 160 74 L 168 86 L 160 98 L 168 110 L 160 122 L 166 130 H 26 A 18 18 0 0 1 8 112 V 32 A 18 18 0 0 1 26 14 Z";
const TAB_TORN =
  "M 178 14 H 214 A 18 18 0 0 1 232 32 V 112 A 18 18 0 0 1 214 130 H 178 L 172 122 L 180 110 L 172 98 L 180 86 L 172 74 L 180 62 L 172 50 L 180 38 L 172 26 Z";

const INK = "var(--stubby-ink)";
const STAMP_INK = "var(--stubby-stamp)";
const ROUND = { strokeLinecap: "round", strokeLinejoin: "round" } as const;
const VB = (x: number, y: number): CSSProperties => ({ transformBox: "view-box", transformOrigin: `${x}px ${y}px` });

type Eye = "open" | "tall" | "happy" | "closed" | "half" | "wink" | "squintL" | "squintR" | "star";
function EyeArt({ kind, cx }: { kind: Eye; cx: number }) {
  const stroke = { fill: "none", stroke: INK, strokeWidth: 6, ...ROUND };
  switch (kind) {
    case "tall":
      return (
        <>
          <rect x={cx - 7} y={48} width={14} height={28} rx={7} fill={INK} />
          <circle cx={cx + 2.5} cy={54} r={2.8} fill="var(--stubby-tab)" />
        </>
      );
    case "happy":
      return <path d={`M${cx - 7} 66 Q${cx} 55 ${cx + 7} 66`} {...stroke} />;
    case "closed":
      return <path d={`M${cx - 7} 63 Q${cx} 70 ${cx + 7} 63`} {...stroke} />;
    case "half":
      return <path d={`M${cx - 6} 60 H${cx + 6} V68 A6 6 0 0 1 ${cx - 6} 68 Z`} fill={INK} />;
    case "wink":
      return <path d={`M${cx - 8} 66 Q${cx} 58 ${cx + 8} 66`} {...stroke} />;
    case "squintL":
      return <path d={`M${cx - 7} 58 L${cx + 5} 64 L${cx - 7} 70`} {...stroke} />;
    case "squintR":
      return <path d={`M${cx + 7} 58 L${cx - 5} 64 L${cx + 7} 70`} {...stroke} />;
    case "star":
      return (
        <path
          transform={`translate(${cx} 64)`}
          d="M0 -11 L3.2 -3.6 L11 -3.4 L5 1.8 L7 10 L0 5.6 L-7 10 L-5 1.8 L-11 -3.4 L-3.2 -3.6 Z"
          fill={INK}
        />
      );
    default:
      return (
        <>
          <rect x={cx - 6} y={53} width={12} height={22} rx={6} fill={INK} />
          <circle cx={cx + 2.5} cy={58} r={2.4} fill="var(--stubby-tab)" />
        </>
      );
  }
}

type Mouth = "smile" | "grin" | "laugh" | "flat" | "o" | "big" | "tiny" | "hmm" | "smirk" | "winky" | "wavy";
function MouthArt({ kind }: { kind: Mouth }) {
  const line = (d: string) => <path d={d} fill="none" stroke={INK} strokeWidth={5.5} {...ROUND} />;
  switch (kind) {
    case "grin":
      return <path d="M80 84 Q94 102 108 84 Z" fill={INK} stroke={INK} strokeWidth={4} strokeLinejoin="round" />;
    case "laugh":
      return (
        <>
          <path d="M80 83 Q94 106 108 83 Z" fill={INK} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <path d="M88 96 Q94 92 100 96 Q94 100 88 96 Z" fill="var(--stubby-tongue)" />
        </>
      );
    case "flat":
      return line("M84 92 L102 90");
    case "o":
      return <ellipse cx={94} cy={93} rx={5} ry={4.5} fill={INK} />;
    case "big":
      return <ellipse cx={94} cy={94} rx={7} ry={8.5} fill={INK} />;
    case "tiny":
      return <ellipse cx={94} cy={92} rx={3.6} ry={3.2} fill={INK} />;
    case "hmm":
      return line("M88 92 Q94 90 100 92");
    case "smirk":
      return line("M86 91 Q96 95 104 87");
    case "winky":
      return line("M84 90 Q96 98 106 87");
    case "wavy":
      return line("M83 92 Q88 88 93 92 Q98 96 103 92");
    default:
      return line("M86 92 Q94 97 102 91");
  }
}

const FACES: Record<Face, { brows: [string, string]; eyes: [Eye, Eye]; mouth: Mouth }> = {
  idle: { brows: ["M66 44 L84 42", "M102 42 L120 44"], eyes: ["open", "open"], mouth: "smile" },
  happy: { brows: ["M66 40 L84 37", "M102 37 L120 40"], eyes: ["happy", "happy"], mouth: "grin" },
  giggle: { brows: ["M66 38 L84 35", "M102 35 L120 38"], eyes: ["happy", "happy"], mouth: "laugh" },
  wink: { brows: ["M66 44 L84 42", "M102 40 L120 46"], eyes: ["open", "wink"], mouth: "winky" },
  shrug: { brows: ["M66 46 L84 46", "M102 40 L120 36"], eyes: ["open", "open"], mouth: "flat" },
  tilt: { brows: ["M66 46 L82 40", "M104 40 L120 46"], eyes: ["open", "open"], mouth: "o" },
  surprised: { brows: ["M66 35 L84 32", "M102 32 L120 35"], eyes: ["tall", "tall"], mouth: "big" },
  thinking: { brows: ["M66 40 L84 40", "M102 36 L120 40"], eyes: ["open", "open"], mouth: "hmm" },
  sleep: { brows: ["M66 50 L84 50", "M102 50 L120 50"], eyes: ["closed", "closed"], mouth: "tiny" },
  cool: { brows: ["M66 50 L84 50", "M102 50 L120 50"], eyes: ["half", "half"], mouth: "smirk" },
  brace: { brows: ["M66 46 L84 50", "M102 50 L120 46"], eyes: ["squintL", "squintR"], mouth: "wavy" },
  starry: { brows: ["M66 38 L84 35", "M102 35 L120 38"], eyes: ["star", "star"], mouth: "laugh" },
};

function StampArt({ stamp }: { stamp: Stamp }) {
  switch (stamp) {
    case "star":
      return (
        <path
          transform="translate(208 42)"
          d="M0 -15 L4.4 -5.4 L14.6 -4.6 L6.8 2.4 L9.2 12.6 L0 7.2 L-9.2 12.6 L-6.8 2.4 L-14.6 -4.6 L-4.4 -5.4 Z"
          fill={STAMP_INK}
        />
      );
    case "punch":
      return <circle cx={208} cy={42} r={10} fill="var(--stubby-hole)" stroke={INK} strokeWidth={4} />;
    case "check":
      return (
        <g fill="none" stroke={STAMP_INK} {...ROUND}>
          <circle cx={208} cy={42} r={14} strokeWidth={3.5} />
          <path d="M200.5 42.5 L206 48 L216 36.5" strokeWidth={4.5} />
        </g>
      );
    case "hand":
      return (
        <g fill="none" stroke={STAMP_INK} transform="rotate(-14 208 42)">
          <circle cx={208} cy={42} r={16} strokeWidth={3} />
          <circle cx={208} cy={42} r={11} strokeWidth={1.5} />
          <path d="M202 42 L206 46 L214 37" strokeWidth={3} {...ROUND} />
        </g>
      );
    default:
      return null;
  }
}

// ---------- motion ----------

const EASE = {
  out: "cubic-bezier(.2,.8,.3,1)",
  in: "cubic-bezier(.5,0,.8,.4)",
  inout: "cubic-bezier(.6,0,.4,1)",
  back: "cubic-bezier(.34,1.56,.64,1)",
  settle: "cubic-bezier(0,0,.58,1)",
  sway: "cubic-bezier(.42,0,.58,1)",
  fall: "cubic-bezier(.42,0,1,1)",
  drift: "cubic-bezier(.25,.1,.25,1)",
};
const T = (x = 0, y = 0) => `translate(${x}px, ${y}px)`;
const S = (x = 1, y = 1) => `scale(${x}, ${y})`;
const R = (d = 0) => `rotate(${d}deg)`;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const SVG_NS = "http://www.w3.org/2000/svg";

/** Freeze an element where it is and drop its running animations. */
function settle(el: Element | null) {
  if (!el) return;
  for (const a of el.getAnimations()) {
    try {
      a.commitStyles();
    } catch {
      // commitStyles throws on elements that are not rendered; nothing to keep.
    }
    a.cancel();
  }
}

type Refs = {
  ground: SVGEllipseElement | null;
  hop: SVGGElement | null;
  flip: SVGGElement | null;
  lean: SVGGElement | null;
  squash: SVGGElement | null;
  breath: SVGGElement | null;
  tab: SVGGElement | null;
  stamp: SVGGElement | null;
  slot: SVGCircleElement | null;
  brows: SVGGElement | null;
  look: SVGGElement | null;
  face: SVGGElement | null;
  blink: SVGGElement | null;
  fx: SVGGElement | null;
};

export function Stubby({
  state = "idle",
  size = 160,
  onDark = false,
  followPointer = false,
  label,
  onPoke,
  className,
  style,
}: {
  state?: StubbyState;
  /** Width in px. Below 56px Stubby becomes the mark: eyes only, no tab detail, no reactions. */
  size?: number;
  /** White outline, for cobalt and navy screens. */
  onDark?: boolean;
  /** Eyes follow the pointer. Use on the welcome and on screens where Stubby is the hero. */
  followPointer?: boolean;
  /** Read out by screen readers. Leave empty when the text next to Stubby says the same thing. */
  label?: string;
  /** Tapping Stubby always squishes it. Pass a handler only when the tap should also do something. */
  onPoke?: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const reduce = useReducedMotion() ?? false;
  const mark = size < 56;
  // Without the Web Animations API (an old browser, or a test runner) Stubby holds still instead of crashing.
  const canAnimate = typeof Element !== "undefined" && typeof Element.prototype.animate === "function";
  const still = reduce || mark || !canAnimate;
  const clipId = `stubby-tab-${useId().replace(/:/g, "")}`;

  const [face, setFace] = useState<Face>(REST[state].face);
  const [stamp, setStamp] = useState<Stamp>(REST[state].stamp ?? "none");
  const [torn, setTorn] = useState<boolean>(!!REST[state].torn);

  const refs = useRef<Refs>({
    ground: null, hop: null, flip: null, lean: null, squash: null, breath: null, tab: null,
    stamp: null, slot: null, brows: null, look: null, face: null, blink: null, fx: null,
  });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const faceNow = useRef<Face>(face);
  const showFace = useCallback((f: Face) => {
    faceNow.current = f;
    setFace(f);
  }, []);
  const busy = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const anim = useCallback(
    (el: Element | null, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
      if (still || !el) return Promise.resolve();
      settle(el);
      return el
        .animate(frames, { fill: "forwards", ...opts })
        .finished.then(() => undefined)
        .catch(() => undefined);
    },
    [still],
  );

  const fx = useCallback(
    (markup: string, frames: Keyframe[], opts: KeyframeAnimationOptions) => {
      const layer = refs.current.fx;
      if (still || !layer) return;
      // Short-lived particles: built outside React on purpose, removed when they finish.
      const g = document.createElementNS(SVG_NS, "g");
      g.innerHTML = markup;
      g.style.transformBox = "view-box";
      layer.appendChild(g);
      g.animate(frames, { fill: "forwards", ...opts }).finished.then(
        () => g.remove(),
        () => g.remove(),
      );
    },
    [still],
  );

  // ---------- building blocks ----------
  const r = refs.current;

  const hop = useCallback(
    async (h = 26, { crouch = 0.86, spin = 0 } = {}) => {
      const { squash, ground, flip, tab, hop: hopEl } = refs.current;
      const g0 = onDark ? 0.35 : 0.14, g1 = g0 / 2;
      await anim(squash, [{ transform: S(1, 1) }, { transform: S(1.1, crouch) }], { duration: 120, easing: EASE.out });
      const up = 230, down = 210;
      void anim(squash, [{ transform: S(1.1, crouch) }, { transform: S(0.93, 1.1) }, { transform: S(1, 1) }], { duration: up, easing: EASE.out });
      void anim(ground, [{ transform: S(1, 1), opacity: g0 }, { transform: S(0.62, 0.7), opacity: g1 }], { duration: up, easing: EASE.out });
      if (spin) void anim(flip, [{ transform: "rotateY(0deg)" }, { transform: `rotateY(${spin}deg)` }], { duration: up + down, easing: EASE.inout });
      void anim(tab, [{ transform: R(0) }, { transform: R(5) }], { duration: up, easing: EASE.out });
      await anim(hopEl, [{ transform: T(0, 0) }, { transform: T(0, -h) }], { duration: up, easing: EASE.out });
      void anim(ground, [{ transform: S(0.62, 0.7), opacity: g1 }, { transform: S(1, 1), opacity: g0 }], { duration: down, easing: EASE.in });
      void anim(squash, [{ transform: S(1, 1) }, { transform: S(0.95, 1.06) }], { duration: down, easing: EASE.in });
      await anim(hopEl, [{ transform: T(0, -h) }, { transform: T(0, 0) }], { duration: down, easing: EASE.in });
      if (spin && flip) {
        settle(flip);
        flip.style.transform = "";
      }
      void anim(tab, [{ transform: R(5) }, { transform: R(-7) }, { transform: R(4) }, { transform: R(-2) }, { transform: R(0) }], { duration: 520, easing: EASE.settle });
      await anim(
        squash,
        [{ transform: S(0.95, 1.06) }, { transform: S(1.14, 0.84) }, { transform: S(0.96, 1.04) }, { transform: S(1.02, 0.99) }, { transform: S(1, 1) }],
        { duration: 420, easing: EASE.settle },
      );
    },
    [anim, onDark],
  );

  const wiggle = useCallback(
    async (times = 3, deg = 4, dur = 90) => {
      const f: Keyframe[] = [{ transform: R(0) }];
      for (let i = 0; i < times; i++) f.push({ transform: R(deg) }, { transform: R(-deg) });
      f.push({ transform: R(0) });
      await anim(refs.current.lean, f, { duration: dur * f.length, easing: EASE.sway });
    },
    [anim],
  );

  const blink = useCallback(
    async (twice = false) => {
      if (!["idle", "thinking", "tilt", "shrug", "surprised"].includes(faceNow.current)) return;
      const f = [{ transform: S(1, 1) }, { transform: S(1, 0.08) }, { transform: S(1, 1) }];
      await anim(refs.current.blink, f, { duration: 150, easing: EASE.sway });
      if (twice) {
        await wait(90);
        await anim(refs.current.blink, f, { duration: 150 });
      }
    },
    [anim],
  );

  const browPop = useCallback(
    (dy = -5) => anim(refs.current.brows, [{ transform: T(0, 0) }, { transform: T(0, dy) }, { transform: T(0, 0) }], { duration: 380, easing: EASE.back }),
    [anim],
  );

  const lookAt = useRef({ x: 0, y: 0 });
  const lookTo = useCallback(
    (x: number, y: number, dur = 120) => {
      const { look, face: faceEl } = refs.current;
      if (still || !look || !faceEl) return;
      const from = T(lookAt.current.x, lookAt.current.y);
      lookAt.current = { x, y };
      settle(look);
      look.animate([{ transform: from }, { transform: T(x, y) }], { duration: dur, fill: "forwards", easing: EASE.out });
      settle(faceEl);
      faceEl.animate([{ transform: T(x * 0.35, y * 0.35) }], { duration: dur, fill: "forwards", easing: EASE.out });
    },
    [still],
  );

  const inkSplat = useCallback(() => {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6 + Math.random() * 0.5, d = 20 + Math.random() * 10;
      fx(`<circle cx="208" cy="42" r="${2 + Math.random() * 2}" fill="var(--stubby-stamp)"/>`,
        [{ transform: T(0, 0), opacity: 1 }, { transform: T(Math.cos(a) * d, Math.sin(a) * d), opacity: 0 }],
        { duration: 420, easing: EASE.out });
    }
  }, [fx]);

  const sparkles = useCallback((cx = 176, cy = 20, n = 6) => {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.45, d = 60 + Math.random() * 30;
      const col = i % 2 ? "var(--stubby-body)" : "var(--stubby-stamp)";
      fx(`<path transform="translate(${cx} ${cy})" d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill="${col}" stroke="var(--stubby-ink)" stroke-width="1.2"/>`,
        [{ transform: `${T(0, 0)} scale(0.3)`, opacity: 0 }, { transform: `${T(Math.cos(a) * d * 0.6, Math.sin(a) * d * 0.6)} scale(1.2)`, opacity: 1, offset: 0.5 }, { transform: `${T(Math.cos(a) * d, Math.sin(a) * d)} scale(0.6)`, opacity: 0 }],
        { duration: 760, easing: EASE.out });
    }
  }, [fx]);

  const outlineVar = onDark ? "var(--stubby-line-on-dark)" : INK;

  // ---------- reactions ----------
  const play = useCallback(
    async (s: StubbyState) => {
      const rest = REST[s];
      const done = () => {
        if (rest.stamp !== undefined) setStamp(rest.stamp);
        if (rest.torn !== undefined) setTorn(rest.torn);
        showFace(rest.face);
      };
      if (still) return done();
      const { stamp: stampEl, tab, lean, squash, hop: hopEl } = refs.current;

      switch (s) {
        case "stamped": {
          showFace("happy");
          void browPop(-6);
          setStamp("star");
          stampEl?.animate(
            [{ transform: "scale(2.4) rotate(-30deg)", opacity: 0 }, { transform: "scale(0.85) rotate(4deg)", opacity: 1, offset: 0.6 }, { transform: "scale(1) rotate(0deg)", opacity: 1 }],
            { duration: 380, easing: EASE.out, delay: 260, fill: "backwards" },
          );
          setTimeout(inkSplat, 500);
          haptic();
          await hop(28);
          await wait(500);
          break;
        }
        case "unstamped": {
          showFace("tilt");
          await anim(stampEl, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(0.6) rotate(20deg)", opacity: 0 }], { duration: 420, easing: EASE.in });
          setStamp("none");
          settle(stampEl);
          if (stampEl) stampEl.style.cssText = "";
          await anim(squash, [{ transform: S(1, 1) }, { transform: S(1.04, 0.94) }, { transform: S(1, 1) }], { duration: 700, easing: EASE.sway });
          break;
        }
        case "yours": {
          showFace("wink");
          void anim(lean, [{ transform: R(0) }, { transform: R(-6) }, { transform: R(0) }], { duration: 520, easing: EASE.back });
          await wait(160);
          setStamp("punch");
          stampEl?.animate([{ transform: "scale(0)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 300, easing: EASE.back });
          fx(`<circle cx="208" cy="42" r="7" fill="var(--stubby-tab)" stroke="var(--stubby-ink)" stroke-width="2"/>`,
            [{ transform: T(0, 0), opacity: 1 }, { transform: `${T(14, 60)} rotate(160deg)`, opacity: 1, offset: 0.7 }, { transform: T(18, 96), opacity: 0 }],
            { duration: 900, easing: EASE.in });
          await wait(700);
          break;
        }
        case "shrug": {
          showFace("shrug");
          lookTo(-8, 0, 200);
          void anim(lean, [{ transform: R(0) }, { transform: R(-6) }], { duration: 220, easing: EASE.out });
          for (let i = 0; i < 2; i++) {
            await anim(squash, [{ transform: S(1, 1) }, { transform: S(0.96, 1.07) }, { transform: S(1, 1) }], { duration: 260, easing: EASE.sway });
          }
          await wait(250);
          await anim(lean, [{ transform: R(-6) }, { transform: R(0) }], { duration: 300, easing: EASE.back });
          lookTo(0, 0, 200);
          break;
        }
        case "torn": {
          showFace("brace");
          await wiggle(4, 2, 45);
          setTorn(true);
          setStamp((p) => (p === "none" ? "star" : p));
          showFace("surprised");
          void anim(lean, [{ transform: R(0) }, { transform: R(-5) }, { transform: R(2) }, { transform: R(0) }], { duration: 600, easing: EASE.settle });
          await anim(tab, [
            { transform: `${T(0, 0)} ${R(0)}`, opacity: 1 },
            { transform: `${T(40, -50)} ${R(25)}`, opacity: 1, offset: 0.45 },
            { transform: `${T(110, -10)} ${R(70)}`, opacity: 0 },
          ], { duration: 700, easing: EASE.out });
          await wait(150);
          showFace("happy");
          await wait(600);
          break;
        }
        case "rejoined": {
          setTorn(true);
          showFace("surprised");
          await anim(tab, [
            { transform: `${T(110, -10)} ${R(70)}`, opacity: 0 },
            { transform: `${T(40, -40)} ${R(20)}`, opacity: 1, offset: 0.55 },
            { transform: `${T(0, 0)} ${R(0)}`, opacity: 1 },
          ], { duration: 560, easing: EASE.out });
          setTorn(false);
          setStamp("star");
          void anim(lean, [{ transform: R(0) }, { transform: R(4) }, { transform: R(0) }], { duration: 260 });
          sparkles(176, 20, 7);
          showFace("starry");
          haptic();
          await hop(34);
          await hop(18, { crouch: 0.92 });
          await wait(300);
          break;
        }
        case "tilt": {
          setTorn(true);
          showFace("tilt");
          void anim(lean, [{ transform: R(0) }, { transform: R(-10) }], { duration: 700, easing: EASE.out });
          await anim(tab, [{ transform: `${T(70, 10)} ${R(16)}`, opacity: 0.5 }, { transform: `${T(0, 0)} ${R(0)}`, opacity: 1 }], { duration: 1500, easing: EASE.drift });
          setTorn(false);
          await wait(400);
          await anim(lean, [{ transform: R(-10) }, { transform: R(0) }], { duration: 600, easing: EASE.back });
          break;
        }
        case "arrived": {
          setTorn(true);
          setStamp("star");
          showFace("surprised");
          void browPop(-7);
          await anim(tab, [{ transform: `${T(130, 0)} ${R(25)}`, opacity: 0 }, { transform: `${T(-6, 0)} ${R(-3)}`, opacity: 1, offset: 0.75 }, { transform: `${T(0, 0)} ${R(0)}`, opacity: 1 }], { duration: 650, easing: EASE.out });
          setTorn(false);
          sparkles(176, 24, 5);
          showFace("happy");
          await hop(22);
          await wait(400);
          break;
        }
        case "knock": {
          setStamp((p) => (p === "none" ? "star" : p));
          lookTo(6, 0, 150);
          for (let i = 0; i < 2; i++) {
            await anim(lean, [{ transform: `${R(0)} ${T(0, 0)}` }, { transform: `${R(7)} ${T(8, 0)}` }], { duration: 140, easing: EASE.in });
            fx(`<g stroke="${outlineVar}" stroke-width="4" stroke-linecap="round"><path d="M242 56 L254 48"/><path d="M246 72 L260 72"/><path d="M242 88 L254 96"/></g>`,
              [{ opacity: 0, transform: T(-6, 0) }, { opacity: 1, transform: T(0, 0), offset: 0.3 }, { opacity: 0, transform: T(6, 0) }], { duration: 360 });
            void browPop(-3);
            await anim(lean, [{ transform: `${R(7)} ${T(8, 0)}` }, { transform: `${R(0)} ${T(0, 0)}` }], { duration: 200, easing: EASE.out });
          }
          lookTo(0, 0, 200);
          break;
        }
        case "checkedIn": {
          showFace("brace");
          fx(`<g transform="rotate(-14 208 42)" fill="none" stroke="var(--stubby-stamp)"><circle cx="208" cy="42" r="16" stroke-width="3"/><circle cx="208" cy="42" r="11" stroke-width="1.5"/></g>`,
            [{ transform: `${T(0, -120)} scale(2.6)`, opacity: 0 }, { transform: `${T(0, 0)} scale(1)`, opacity: 1 }], { duration: 260, easing: EASE.in });
          await wait(260);
          setStamp("hand");
          inkSplat();
          haptic();
          await anim(squash, [{ transform: S(1, 1) }, { transform: S(1.16, 0.8) }, { transform: S(0.97, 1.04) }, { transform: S(1, 1) }], { duration: 420, easing: EASE.settle });
          showFace("happy");
          await hop(16, { crouch: 0.94 });
          await wait(500);
          break;
        }
        case "done": {
          showFace("happy");
          setTimeout(() => {
            setStamp("check");
            inkSplat();
          }, 420);
          await hop(36, { spin: 360 });
          sparkles(120, 10, 6);
          await wait(600);
          break;
        }
        case "letGo": {
          showFace("sleep");
          void anim(stampEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 1800, easing: EASE.fall }).then(() => {
            setStamp("none");
            settle(stampEl);
            if (stampEl) stampEl.style.cssText = "";
          });
          await anim(lean, [{ transform: R(0) }, { transform: R(3) }, { transform: R(-3) }, { transform: R(2) }, { transform: R(0) }], { duration: 2600, easing: EASE.sway });
          showFace("idle");
          await blink();
          break;
        }
        case "sleep": {
          showFace("sleep");
          lookTo(0, 0, 300);
          await anim(lean, [{ transform: R(0) }, { transform: R(4) }], { duration: 1200, easing: EASE.sway });
          return; // stays asleep; the loop below adds the z's
        }
        case "thinking": {
          showFace("thinking");
          lookTo(5, -4, 260);
          return; // the loop below bobs and spins until the state changes
        }
        case "cool": {
          showFace("cool");
          for (let i = 0; i < 2; i++) {
            await anim(hopEl, [{ transform: T(0, 0) }, { transform: T(0, 4) }, { transform: T(0, 0) }], { duration: 420, easing: EASE.sway });
          }
          return;
        }
        default:
          break;
      }
      if (alive.current) done();
    },
    [still, anim, hop, wiggle, blink, browPop, lookTo, inkSplat, sparkles, fx, outlineVar, showFace],
  );

  // Leaving sleep or thinking gets its own small beat before the next reaction.
  const prev = useRef<StubbyState>(state);
  const firstRun = useRef(true);
  useEffect(() => {
    const from = prev.current;
    prev.current = state;
    if (firstRun.current) {
      firstRun.current = false;
      if (state === "idle" || state === "cool" || state === "sleep" || state === "thinking") return;
    }
    queue.current = queue.current.then(async () => {
      if (!alive.current) return;
      busy.current = true;
      try {
        const { lean, squash } = refs.current;
        if (!still && from === "sleep" && state !== "sleep") {
          showFace("surprised");
          void anim(lean, [{ transform: R(4) }, { transform: R(0) }], { duration: 300, easing: EASE.out });
          await anim(squash, [{ transform: S(1, 1) }, { transform: S(0.88, 1.2) }, { transform: S(0.88, 1.2), offset: 0.6 }, { transform: S(1.06, 0.94) }, { transform: S(1, 1) }], { duration: 1000, easing: EASE.sway });
        }
        if (!still && from === "thinking" && state !== "thinking") {
          lookTo(0, 0, 150);
          showFace("surprised");
          await browPop(-8);
        }
        await play(state);
      } finally {
        busy.current = false;
      }
    });
  }, [state, play, still, anim, lookTo, browPop, showFace]);

  // ---------- idle life ----------
  // Idle life rests while Stubby is off screen or the tab is hidden, to save
  // battery. Reactions (stamps, hops) still play whenever they are asked for.
  const awake = useRef(true);
  const breathAnim = useRef<Animation | null>(null);
  useEffect(() => {
    if (still) return;
    const svg = svgRef.current;
    let onScreen = true;
    const update = () => {
      const next = onScreen && !document.hidden;
      if (next === awake.current) return;
      awake.current = next;
      if (next) breathAnim.current?.play();
      else breathAnim.current?.pause();
    };
    const io =
      svg && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            onScreen = entries[entries.length - 1].isIntersecting;
            update();
          })
        : null;
    if (svg) io?.observe(svg);
    document.addEventListener("visibilitychange", update);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", update);
      awake.current = true;
    };
  }, [still]);

  useEffect(() => {
    if (still) return;
    const breath = refs.current.breath;
    const slow = state === "sleep";
    const a = breath?.animate(
      [{ transform: S(1, 1) }, { transform: S(1.012, slow ? 0.965 : 0.982) }, { transform: S(1, 1) }],
      { duration: slow ? 3600 : 2600, iterations: Infinity, easing: EASE.sway },
    );
    breathAnim.current = a ?? null;
    if (a && !awake.current) a.pause();
    return () => {
      a?.cancel();
      if (breathAnim.current === a) breathAnim.current = null;
    };
  }, [still, state]);

  const lastPointer = useRef(0);
  useEffect(() => {
    if (still) return;
    let t: ReturnType<typeof setTimeout>;
    let g: ReturnType<typeof setTimeout>;
    const blinkLoop = () => {
      t = setTimeout(async () => {
        if (awake.current && !busy.current && state !== "sleep") await blink(Math.random() < 0.25);
        blinkLoop();
      }, 1800 + Math.random() * 3800);
    };
    const glanceLoop = () => {
      g = setTimeout(async () => {
        if (awake.current && !busy.current && faceNow.current === "idle" && Date.now() - lastPointer.current > 2500) {
          lookTo(Math.random() < 0.5 ? -6 : 6, Math.random() < 0.3 ? -3 : 0, 260);
          await wait(900 + Math.random() * 700);
          if (Date.now() - lastPointer.current > 2500) lookTo(0, 0, 320);
        }
        glanceLoop();
      }, 3500 + Math.random() * 4000);
    };
    blinkLoop();
    glanceLoop();
    return () => {
      clearTimeout(t);
      clearTimeout(g);
    };
  }, [still, state, blink, lookTo]);

  // Looping states: knock repeats, thinking bobs and spins, sleep floats z's.
  useEffect(() => {
    if (still) return;
    let stop = false;
    const { hop: hopEl, slot } = refs.current;
    if (state === "thinking") {
      const spin = slot?.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 1600, iterations: Infinity });
      const bob = hopEl?.animate([{ transform: T(0, 0) }, { transform: T(0, -6) }, { transform: T(0, 0) }], { duration: 700, iterations: Infinity, easing: EASE.sway });
      const eyes = setInterval(() => lookTo(Math.random() < 0.5 ? -5 : 5, -4, 260), 1400);
      return () => {
        spin?.cancel();
        bob?.cancel();
        clearInterval(eyes);
      };
    }
    if (state === "sleep") {
      const z = () =>
        fx(`<text x="150" y="20" font-family="var(--font-heading)" font-weight="800" font-size="${14 + Math.random() * 8}" fill="${outlineVar}">z</text>`,
          [{ transform: T(0, 0), opacity: 0 }, { transform: T(10, -20), opacity: 1, offset: 0.3 }, { transform: T(30, -60), opacity: 0 }], { duration: 2200, easing: EASE.settle });
      z();
      const id = setInterval(z, 900);
      return () => clearInterval(id);
    }
    if (state === "knock") {
      const id = setInterval(() => {
        if (!stop && !busy.current) {
          queue.current = queue.current.then(() => play("knock"));
        }
      }, 3200);
      return () => {
        stop = true;
        clearInterval(id);
      };
    }
  }, [still, state, lookTo, fx, outlineVar, play]);

  // Eyes follow the pointer.
  useEffect(() => {
    if (still || !followPointer) return;
    const onMove = (e: PointerEvent) => {
      lastPointer.current = Date.now();
      const svg = svgRef.current;
      if (!svg || state === "sleep" || (busy.current && faceNow.current !== "idle")) return;
      const b = svg.getBoundingClientRect();
      const dx = e.clientX - (b.left + b.width * 0.42), dy = e.clientY - (b.top + b.height * 0.5);
      const len = Math.hypot(dx, dy) || 1, k = Math.min(1, len / 260);
      lookTo((dx / len) * 6 * k, (dy / len) * 4 * k, 120);
    };
    addEventListener("pointermove", onMove);
    return () => removeEventListener("pointermove", onMove);
  }, [still, followPointer, state, lookTo]);

  // Poke: squish and giggle. Five quick pokes: a dizzy spin, then cool about it.
  const pokes = useRef<number[]>([]);
  const poke = () => {
    if (still) return;
    queue.current = queue.current.then(async () => {
      busy.current = true;
      try {
        const now = Date.now();
        pokes.current = pokes.current.filter((t) => now - t < 2500).concat(now);
        const { flip, squash } = refs.current;
        const back = REST[state].face;
        if (pokes.current.length >= 5) {
          pokes.current = [];
          showFace("starry");
          await anim(flip, [{ transform: "rotateY(0deg)" }, { transform: "rotateY(720deg)" }], { duration: 900, easing: EASE.inout });
          settle(flip);
          if (flip) flip.style.transform = "";
          showFace("cool");
          await wait(900);
        } else {
          showFace("giggle");
          await anim(squash, [{ transform: S(1, 1) }, { transform: S(1.15, 0.8) }, { transform: S(0.94, 1.08) }, { transform: S(1.03, 0.98) }, { transform: S(1, 1) }], { duration: 460, easing: EASE.settle });
          await wiggle(2, 3, 70);
        }
        if (alive.current) showFace(back);
      } finally {
        busy.current = false;
      }
    });
  };

  // ---------- render ----------
  const f = FACES[mark ? "idle" : face];
  const strokeW = mark ? 9 : 6;
  const set = <K extends keyof Refs>(k: K) => (el: Refs[K]) => {
    r[k] = el;
  };

  const svg = (
    <svg
      ref={svgRef}
      viewBox="0 0 240 150"
      width={size}
      height={(size * 150) / 240}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ overflow: "visible", display: "block" }}
    >
      <ellipse ref={set("ground")} cx={120} cy={146} rx={92} ry={6} fill={INK} opacity={onDark ? 0.35 : 0.14} style={VB(120, 146)} />
      <g ref={set("hop")} style={VB(120, 132)}>
        <g ref={set("flip")} style={VB(120, 72)}>
          <g ref={set("lean")} style={VB(120, 132)}>
            <g ref={set("squash")} style={VB(120, 132)}>
              <g ref={set("breath")} style={VB(120, 132)}>
                {torn && !mark ? (
                  <path d={BODY_TORN} fill="var(--stubby-body)" stroke={outlineVar} strokeWidth={strokeW} strokeLinejoin="round" />
                ) : (
                  <path d={BODY_FILL} fill="var(--stubby-body)" />
                )}
                <g ref={set("tab")} style={VB(172, 130)}>
                  {torn && !mark ? (
                    <path d={TAB_TORN} fill="var(--stubby-tab)" stroke={outlineVar} strokeWidth={strokeW} strokeLinejoin="round" />
                  ) : (
                    <>
                      <clipPath id={clipId}>
                        <rect x={172} y={0} width={80} height={150} />
                      </clipPath>
                      <path d={TAB_FILL} fill="var(--stubby-tab)" clipPath={`url(#${clipId})`} />
                    </>
                  )}
                  {!mark && (
                    <>
                      <g ref={set("stamp")} style={VB(208, 42)}>
                        {stamp === "none" ? (
                          <circle
                            ref={set("slot")}
                            cx={208}
                            cy={42}
                            r={13}
                            fill="none"
                            stroke="var(--stubby-slot)"
                            strokeWidth={3}
                            strokeDasharray="3.5 4"
                            style={VB(208, 42)}
                          />
                        ) : (
                          <StampArt stamp={stamp} />
                        )}
                      </g>
                      <text
                        x={208}
                        y={94}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform="rotate(90 208 94)"
                        fontFamily="var(--font-body)"
                        fontWeight={800}
                        fontSize={9}
                        letterSpacing={1}
                        fill={INK}
                      >
                        Admit one
                      </text>
                    </>
                  )}
                </g>
                {!(torn && !mark) && (
                  <>
                    {!mark && (
                      <line x1={172} y1={32} x2={172} y2={112} stroke={INK} strokeWidth={4} strokeDasharray="6 6" strokeLinecap="round" />
                    )}
                    <path d={OUTLINE} fill="none" stroke={outlineVar} strokeWidth={strokeW} strokeLinejoin="round" />
                  </>
                )}
                <g ref={set("face")} style={VB(94, 70)}>
                  {mark ? (
                    <g fill={INK}>
                      <rect x={66} y={50} width={16} height={30} rx={8} />
                      <rect x={104} y={50} width={16} height={30} rx={8} />
                    </g>
                  ) : (
                    <>
                      <g ref={set("brows")} stroke={INK} strokeWidth={6} strokeLinecap="round" fill="none" style={VB(94, 42)}>
                        <path d={f.brows[0]} />
                        <path d={f.brows[1]} />
                      </g>
                      <g ref={set("look")}>
                        <g ref={set("blink")} style={VB(94, 64)}>
                          <EyeArt kind={f.eyes[0]} cx={76} />
                          <EyeArt kind={f.eyes[1]} cx={112} />
                        </g>
                      </g>
                      <MouthArt kind={f.mouth} />
                    </>
                  )}
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
      <g ref={set("fx")} />
    </svg>
  );

  // A tap always squishes Stubby. It is only a button (a tab stop) when the
  // tap does something; otherwise it is decoration and the pointer is enough.
  if (onPoke) {
    return (
      <button
        type="button"
        className={className}
        style={{ background: "none", border: 0, padding: 0, cursor: "pointer", lineHeight: 0, ...style }}
        aria-label={label ?? "Stubby"}
        onClick={() => {
          poke();
          onPoke();
        }}
      >
        {svg}
      </button>
    );
  }
  return (
    <span className={className} style={{ display: "inline-block", lineHeight: 0, ...style }} onPointerDown={poke}>
      {svg}
    </span>
  );
}
