/**
 * A satin ribbon that waves through 3D space with words printed along it.
 * Soosh's own build (WebGL2 through ogl, the library the Corner carousel uses),
 * made to the look of React Bits Pro's Ribbon Type: a solid band that slowly
 * undulates, rocks around its length, and now and then rolls a full twist
 * along itself. Colours come from the theme tokens, so it is ink on paper in
 * light mode and paper on ink in dark mode. Decorative: the parent hides it
 * from screen readers. With motion off it draws one still frame.
 */
import { useEffect, useRef } from "react";
import { Camera, Geometry, Mesh, Program, Renderer, Texture } from "ogl";

export interface SatinRibbonProps {
  /** Words printed along the ribbon, repeated with the separator between them. */
  words: readonly string[];
  separator?: string;
  /** Ribbon width in CSS pixels. */
  ribbonWidth?: number;
  /** Wave height in CSS pixels. */
  amplitude?: number;
  /** Waves across the view. */
  frequency?: number;
  /** How far the ribbon swings toward and away from the viewer, in CSS pixels. */
  depth?: number;
  /** Text speed along the ribbon, CSS pixels per second. */
  speed?: number;
  /** Speed of the shape's undulation. */
  flow?: number;
  /** How far the ribbon rocks around its length, in turns. */
  twist?: number;
  /** Speed at which the rocking travels along the ribbon. */
  twistSpeed?: number;
  /** Seconds between full twists rolling along the ribbon; 0 for none. */
  autoTwist?: number;
  /** False draws one still frame and never animates. */
  animate?: boolean;
  className?: string;
}

const SEGMENTS = 320;
const FOV = 30;

const vertex = /* glsl */ `#version 300 es
in vec2 aCoord;
uniform mat4 projectionMatrix;
uniform mat4 modelViewMatrix;
uniform float uTime, uSpan, uRibbon, uAmp, uFreq, uDepth, uFlow, uTwist, uTwistSpeed, uPulse;
out float vU;
out float vV;
out vec3 vNormal;
const float TAU = 6.28318530718;
void main() {
  float u = aCoord.x;
  float v = aCoord.y;
  float ph = u * uFreq * TAU + uTime * uFlow;
  float ph2 = u * uFreq * 0.7 * TAU + uTime * uFlow * 0.6 + 1.3;
  vec3 c = vec3((u - 0.5) * uSpan, uAmp * sin(ph), uDepth * cos(ph2));
  vec3 t = normalize(vec3(uSpan, uAmp * cos(ph) * uFreq * TAU, -uDepth * sin(ph2) * uFreq * 0.7 * TAU));
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 b = normalize(up - t * dot(up, t));
  vec3 n = cross(t, b);
  float a = uTwist * TAU * sin(u * TAU * 1.3 - uTime * uTwistSpeed * TAU)
          + TAU * smoothstep(uPulse - 0.07, uPulse + 0.07, u);
  vec3 across = b * cos(a) + n * sin(a);
  vNormal = -b * sin(a) + n * cos(a);
  vU = u;
  vV = v;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(c + across * v * uRibbon, 1.0);
}`;

const fragment = /* glsl */ `#version 300 es
precision highp float;
in float vU;
in float vV;
in vec3 vNormal;
uniform sampler2D tText;
uniform vec3 uRibbonColor, uTextColor;
uniform float uSpan, uTextW, uOffset;
out vec4 fragColor;
void main() {
  vec3 n = normalize(vNormal);
  bool front = gl_FrontFacing;
  if (!front) n = -n;
  vec3 l = normalize(vec3(-0.35, 0.55, 1.0));
  vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
  float diff = 0.62 + 0.38 * max(dot(n, l), 0.0);
  float spec = pow(max(dot(n, h), 0.0), 28.0) * 0.38 + pow(1.0 - abs(n.z), 3.0) * 0.12;
  vec3 ribbon = uRibbonColor * diff + vec3(spec);
  if (!front) ribbon *= 0.82;
  float mask = 0.0;
  if (front) {
    float s = vU * uSpan / uTextW + uOffset;
    mask = texture(tText, vec2(fract(s), 0.5 - vV)).a;
  }
  vec3 col = mix(ribbon, uTextColor * (0.86 + 0.14 * diff) + vec3(spec * 0.3), mask);
  fragColor = vec4(col, 1.0);
}`;

/** The page's display font, resolved through its custom property to a family list canvas can use. */
function displayFamily(container: HTMLElement): string {
  const probe = document.createElement("span");
  probe.style.fontFamily = "var(--font-display)";
  container.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily || getComputedStyle(container).fontFamily;
  probe.remove();
  return family;
}

/** Any CSS colour (hex, rgb, oklch) to linear-ish 0..1 RGB, through a 1px canvas. */
function toRgb(value: string, fallback: [number, number, number]): [number, number, number] {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d");
    if (!ctx || !value) return fallback;
    ctx.fillStyle = `rgb(${fallback.map(x => x * 255).join(",")})`;
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r / 255, g / 255, b / 255];
  } catch {
    return fallback;
  }
}

export default function SatinRibbon({
  words, separator = " · ", ribbonWidth = 64, amplitude = 60, frequency = 1.05, depth = 110,
  speed = 26, flow = 0.12, twist = 0.07, twistSpeed = 0.04, autoTwist = 16, animate = true, className,
}: SatinRibbonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const text = words.join(separator) + separator;

  useEffect(() => {
    const container = ref.current;
    if (!container) return undefined;
    const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), alpha: true, premultipliedAlpha: true, antialias: true });
    const gl = renderer.gl;
    if (!renderer.isWebgl2) { gl.getExtension("WEBGL_lose_context")?.loseContext(); return undefined; }
    gl.clearColor(0, 0, 0, 0);
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    const camera = new Camera(gl, { fov: FOV });
    const coords = new Float32Array((SEGMENTS + 1) * 2 * 2);
    const index = new Uint16Array(SEGMENTS * 6);
    for (let i = 0; i <= SEGMENTS; i++) {
      const u = i / SEGMENTS;
      coords.set([u, 0.5, u, -0.5], i * 4);
      if (i < SEGMENTS) { const a = i * 2; index.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], i * 6); }
    }
    const geometry = new Geometry(gl, { aCoord: { size: 2, data: coords }, index: { data: index } });

    // The words, drawn once into a strip the ribbon repeats along its length.
    const texCanvas = document.createElement("canvas");
    const texture = new Texture(gl, { wrapS: gl.REPEAT, wrapT: gl.CLAMP_TO_EDGE, generateMipmaps: true, minFilter: gl.LINEAR_MIPMAP_LINEAR, flipY: false });
    const program = new Program(gl, {
      vertex, fragment, cullFace: false,
      uniforms: {
        tText: { value: texture },
        uTime: { value: 0 }, uSpan: { value: 1000 }, uRibbon: { value: ribbonWidth }, uAmp: { value: amplitude }, uFreq: { value: frequency },
        uDepth: { value: depth }, uFlow: { value: flow }, uTwist: { value: twist }, uTwistSpeed: { value: twistSpeed }, uPulse: { value: 2 },
        uRibbonColor: { value: [0.06, 0.05, 0.05] }, uTextColor: { value: [0.97, 0.96, 0.94] }, uTextW: { value: 1000 }, uOffset: { value: 0 },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    const drawText = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2) * 1.5;
      const family = displayFamily(container);
      const ctx = texCanvas.getContext("2d");
      if (!ctx) return;
      const fontPx = ribbonWidth * 0.48;
      const font = `800 ${fontPx * scale}px ${family}`;
      ctx.font = font;
      const measured = ctx.measureText(text).width;
      const k = Math.min(1, 4096 / Math.max(1, measured));
      texCanvas.width = Math.ceil(measured * k);
      texCanvas.height = Math.ceil(ribbonWidth * scale * k);
      ctx.font = `800 ${fontPx * scale * k}px ${family}`;
      ctx.textBaseline = "middle";
      // design-token-ignore: an alpha mask only; the shader colours it with the theme tokens
      ctx.fillStyle = "#fff";
      ctx.clearRect(0, 0, texCanvas.width, texCanvas.height);
      ctx.fillText(text, 0, texCanvas.height * 0.53);
      texture.image = texCanvas;
      texture.needsUpdate = true;
      program.uniforms.uTextW.value = texCanvas.width / (scale * k);
    };

    const recolor = () => {
      const style = getComputedStyle(container);
      program.uniforms.uRibbonColor.value = toRgb(style.getPropertyValue("--foreground").trim(), [0.06, 0.05, 0.05]);
      program.uniforms.uTextColor.value = toRgb(style.getPropertyValue("--background").trim(), [0.97, 0.96, 0.94]);
    };

    let width = 1, height = 1;
    const resize = () => {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height);
      camera.perspective({ aspect: width / height });
      camera.position.z = (height / 2) / Math.tan((FOV * Math.PI) / 360);
      camera.far = camera.position.z * 4;
      camera.perspective();
      program.uniforms.uSpan.value = width * 1.25 + amplitude * 2;
    };

    let time = 0, last = 0, raf = 0, visible = true, pulse: { from: number; start: number } | null = null, nextTwist = autoTwist;
    const PULSE_SECONDS = 3.2;
    const render = () => {
      program.uniforms.uTime.value = time;
      program.uniforms.uOffset.value = (time * speed) / program.uniforms.uTextW.value;
      if (pulse) {
        const p = (time - pulse.start) / PULSE_SECONDS;
        program.uniforms.uPulse.value = p >= 1 ? 2 : pulse.from + (1.15 - pulse.from) * (1 - Math.pow(1 - p, 2));
        if (p >= 1) pulse = null;
      }
      renderer.render({ scene: mesh, camera });
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) { last = now; return; }
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      time += dt;
      if (autoTwist > 0 && time >= nextTwist && !pulse) { pulse = { from: -0.15, start: time }; nextTwist = time + autoTwist; }
      render();
    };

    const onPointer = (e: PointerEvent) => {
      if (!animate || pulse) return;
      const r = canvas.getBoundingClientRect();
      const u = 0.5 + (e.clientX - r.left - r.width / 2) / program.uniforms.uSpan.value;
      pulse = { from: Math.max(-0.15, u - 0.1), start: time };
    };
    canvas.addEventListener("pointerdown", onPointer);

    const ro = new ResizeObserver(() => { resize(); if (!animate) render(); });
    ro.observe(container);
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(container);
    const mo = new MutationObserver(() => { recolor(); if (!animate) render(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });

    recolor();
    drawText();
    resize();
    if (animate) {
      pulse = { from: -0.15, start: 0.4 };
      raf = requestAnimationFrame(frame);
    } else {
      time = 3;
      render();
    }
    let alive = true;
    // Canvas text only uses a web font once it has loaded, so ask for it, then print again.
    document.fonts?.load(`800 ${Math.round(ribbonWidth * 0.48)}px ${displayFamily(container)}`).catch(() => undefined)
      .then(() => { if (!alive) return; drawText(); if (!animate) render(); });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect(); mo.disconnect();
      canvas.removeEventListener("pointerdown", onPointer);
      canvas.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [text, ribbonWidth, amplitude, frequency, depth, speed, flow, twist, twistSpeed, autoTwist, animate]);

  return <div ref={ref} className={className}/>;
}
