import * as T from "three";
import { rng } from "./layout";

/**
 * Small building blocks every Corner world shares: materials, boxes and
 * cylinders, canvas textures, a soft glow. Colours are written as numbers
 * (0xrrggbb) because they are paint in a 3D scene, not interface colours, and
 * the design tokens in theme.css do not reach inside a canvas.
 */

export const PI = Math.PI;

/** A colour as a CSS string for drawing on a 2D canvas texture. */
export function css(hex: number, alpha = 1): string {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return "rgba(" + [r, g, b, alpha].join(",") + ")";
}

export function mat(color: number, roughness = 0.8, metalness = 0): T.MeshStandardMaterial {
  return new T.MeshStandardMaterial({ color, roughness, metalness });
}

export function mesh(geo: T.BufferGeometry, material: T.Material | T.Material[]): T.Mesh {
  const m = new T.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function at<O extends T.Object3D>(o: O, x: number, y: number, z: number): O {
  o.position.set(x, y, z);
  return o;
}

export const box = (w: number, h: number, d: number, m: T.Material) => mesh(new T.BoxGeometry(w, h, d), m);
export const cyl = (rt: number, rb: number, h: number, m: T.Material, seg = 32, open = false) => mesh(new T.CylinderGeometry(rt, rb, h, seg, 1, open), m);
export const sph = (r: number, m: T.Material, ws = 24, hs = 18) => mesh(new T.SphereGeometry(r, ws, hs), m);

export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number], anisotropy = 1): T.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g) draw(g, w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = anisotropy;
  return t;
}

let radial: T.CanvasTexture | null = null;
/** A soft white dot, shared by every glow, dust mote and spark. */
export function radialTex(): T.CanvasTexture {
  if (radial) return radial;
  radial = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, css(0xffffff, 1));
    gr.addColorStop(0.25, css(0xffffff, 0.55));
    gr.addColorStop(1, css(0xffffff, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  return radial;
}
/** Forget the shared dot when a world is torn down, so the next one draws its own. */
export function dropRadialTex() {
  radial = null;
}

export function glow(color: number, scale: number, opacity: number): T.Sprite {
  const s = new T.Sprite(new T.SpriteMaterial({ map: radialTex(), color, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity }));
  s.scale.set(scale, scale, 1);
  return s;
}

export function woodTexture(anisotropy: number): T.CanvasTexture {
  return canvasTex(
    1024,
    1024,
    (g, w, h) => {
      const rows = 10;
      const rh = h / rows;
      const r = rng(7);
      for (let i = 0; i < rows; i++) {
        let x = -r() * 300;
        while (x < w) {
          const len = 260 + r() * 360;
          const hue = 24 + r() * 8;
          const l = 34 + r() * 10;
          g.fillStyle = `hsl(${hue},42%,${l}%)`;
          g.fillRect(x, i * rh, len, rh);
          for (let k = 0; k < 26; k++) {
            g.strokeStyle = `hsla(${hue},40%,${l - 8 - r() * 8}%,${0.12 + r() * 0.18})`;
            g.lineWidth = 0.6 + r() * 1.6;
            g.beginPath();
            const y0 = i * rh + r() * rh;
            g.moveTo(x, y0);
            for (let s = 0; s <= len; s += 20) g.lineTo(x + s, y0 + Math.sin(s * 0.012 + k) * 3 * r());
            g.stroke();
          }
          if (r() < 0.4) {
            g.fillStyle = css(0x3c2012, 0.35);
            g.beginPath();
            g.ellipse(x + len * r(), i * rh + rh / 2, 6 + r() * 6, 3 + r() * 3, 0, 0, PI * 2);
            g.fill();
          }
          g.fillStyle = css(0x1e120a, 0.6);
          g.fillRect(x, i * rh, 2, rh);
          x += len;
        }
        g.fillStyle = css(0x1e120a, 0.55);
        g.fillRect(0, i * rh, w, 2);
      }
    },
    [3, 3],
    anisotropy,
  );
}

export function plasterTexture(seed: number, base: number, anisotropy: number): T.CanvasTexture {
  return canvasTex(
    1024,
    512,
    (g, w, h) => {
      const r = rng(seed);
      g.fillStyle = css(base);
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const a = r() * 0.05;
        g.fillStyle = r() < 0.5 ? css(0xfffaf0, a) : css(0x785a3c, a);
        g.beginPath();
        g.arc(r() * w, r() * h, 4 + r() * 40, 0, PI * 2);
        g.fill();
      }
      for (let i = 0; i < 14; i++) {
        const x = r() * w;
        const gr = g.createLinearGradient(x, 0, x, h);
        gr.addColorStop(0, css(0x785a3c, 0));
        gr.addColorStop(1, css(0x785a3c, 0.07));
        g.fillStyle = gr;
        g.fillRect(x, 0, 20 + r() * 60, h);
      }
    },
    undefined,
    anisotropy,
  );
}

/** A small wooden tag with a few words on it, as hung on a shelf. */
export function tagTexture(text: string, bg: number, fg: number): T.CanvasTexture {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = css(bg);
    g.fillRect(0, 0, w, h);
    g.strokeStyle = css(fg, 0.35);
    g.lineWidth = 4;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = css(fg);
    g.font = "600 54px Georgia, serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 3);
  });
}

/** Frees every geometry, material and texture under an object. */
export function disposeTree(root: T.Object3D) {
  const textures = new Set<T.Texture>();
  root.traverse((n) => {
    const m = n as T.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const material of mats) {
      for (const v of Object.values(material as unknown as Record<string, unknown>)) {
        if (v instanceof T.Texture) textures.add(v);
      }
      material.dispose();
    }
  });
  textures.forEach((t) => t.dispose());
}
