/**
 * The story image for a finished Pursuit (screen 13): 1080 by 1920, the grid of
 * Moments over the gold stub. Drawn with the canvas API, no library. The layout
 * is plain numbers so it can be checked without a canvas.
 */
export const STORY = { width: 1080, height: 1920 } as const;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RecapLayout {
  title: Rect;
  kicker: Rect;
  tiles: Rect[];
  stub: Rect;
}

/** Up to 10 tiles in 5 columns, then the stub. */
export function recapLayout(tileCount: number): RecapLayout {
  const margin = 64;
  const gap = 16;
  const cols = 5;
  const tile = Math.floor((STORY.width - margin * 2 - gap * (cols - 1)) / cols);
  const gridTop = 560;
  const tiles: Rect[] = Array.from({ length: Math.min(10, Math.max(0, tileCount)) }, (_, i) => ({
    x: margin + (i % cols) * (tile + gap),
    y: gridTop + Math.floor(i / cols) * (tile + gap),
    w: tile,
    h: tile,
  }));
  const rows = Math.max(1, Math.ceil(tiles.length / cols));
  const stubTop = gridTop + rows * (tile + gap) + 64;
  return {
    kicker: { x: margin, y: 300, w: STORY.width - margin * 2, h: 48 },
    title: { x: margin, y: 360, w: STORY.width - margin * 2, h: 160 },
    tiles,
    stub: { x: margin, y: stubTop, w: STORY.width - margin * 2, h: 320 },
  };
}

export interface RecapContent {
  kicker: string;
  title: string;
  stubTitle: string;
  stubCount: string;
  stubMeta: string;
  /** Loaded photos in order; null draws a plain tile. */
  photos: (CanvasImageSource | null)[];
}

const GOLD = "#D7A03D"; // design-token-ignore: gold stub colour from the visual spec
const BG = "#0E0D0C"; // design-token-ignore: app background, drawn on a canvas that cannot read CSS variables
const TEXT = "#F4EFE8"; // design-token-ignore: app text colour, drawn on a canvas that cannot read CSS variables
const TILE = "#201D1B"; // design-token-ignore: raised surface colour, drawn on a canvas

export function drawRecap(ctx: CanvasRenderingContext2D, content: RecapContent) {
  const layout = recapLayout(content.photos.length);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, STORY.width, STORY.height);

  ctx.fillStyle = TEXT;
  ctx.textBaseline = "top";
  ctx.globalAlpha = 0.7;
  ctx.font = "600 36px Inter, system-ui, sans-serif";
  ctx.fillText(content.kicker, layout.kicker.x, layout.kicker.y);
  ctx.globalAlpha = 1;
  ctx.font = "800 96px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
  ctx.fillText(content.title, layout.title.x, layout.title.y, layout.title.w);

  layout.tiles.forEach((r, i) => {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 20);
    ctx.clip();
    ctx.fillStyle = TILE;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const img = content.photos[i];
    if (img) {
      const iw = (img as { width?: number }).width ?? r.w;
      const ih = (img as { height?: number }).height ?? r.h;
      const scale = Math.max(r.w / iw, r.h / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(img, r.x + (r.w - dw) / 2, r.y + (r.h - dh) / 2, dw, dh);
    }
    ctx.restore();
    ctx.fillStyle = TEXT;
    ctx.font = "600 28px Inter, system-ui, sans-serif";
    ctx.fillText(`#${i + 1}`, r.x + 16, r.y + r.h - 44);
  });

  const s = layout.stub;
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.roundRect(s.x, s.y, s.w, s.h, 32);
  ctx.fill();
  ctx.fillStyle = BG;
  ctx.font = "800 88px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
  ctx.fillText(content.stubTitle, s.x + 48, s.y + 56, s.w - 400);
  ctx.font = "600 34px Inter, system-ui, sans-serif";
  ctx.fillText(content.stubMeta, s.x + 48, s.y + s.h - 96, s.w - 96);
  ctx.font = "800 120px 'Bricolage Grotesque', Inter, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(content.stubCount, s.x + s.w - 48, s.y + 56);
  ctx.textAlign = "left";
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Renders the story image. A photo that will not load (or taints the canvas) becomes a plain tile. */
export async function renderRecap(content: Omit<RecapContent, "photos"> & { photoUrls: string[] }): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = STORY.width;
  canvas.height = STORY.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const photos = await Promise.all(content.photoUrls.slice(0, 10).map(loadImage));
  drawRecap(ctx, { ...content, photos });
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
