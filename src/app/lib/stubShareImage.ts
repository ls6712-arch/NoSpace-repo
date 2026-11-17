import { APP_NAME, SITE_DOMAIN } from "../config";
import { STORY, type Rect } from "./recapImage";
import { KIND_LABEL, type StubFace } from "./stubFace";
import { editionLabel } from "./stubs";

/**
 * The story image for one Stub (brief: the four Stubs, §5.4): 1080 by 1920, the
 * Stub large and tilted on a dark background with its own glow, the person's
 * first name, and a small Soosh mark. Drawn with the canvas API, no library.
 * What it prints is plain strings (stubShareLines) and its layout is plain
 * numbers (stubShareLayout), so both can be checked without a canvas.
 */
export interface StubShareLayout {
  ticket: Rect;
  /** The perforation, measured from the top of the ticket. */
  tearY: number;
  name: Rect;
  mark: Rect;
}

export function stubShareLayout(): StubShareLayout {
  const w = 720;
  const h = 1060;
  const x = (STORY.width - w) / 2;
  const y = 300;
  return {
    ticket: { x, y, w, h },
    tearY: h - 250,
    name: { x: 96, y: y + h + 130, w: STORY.width - 192, h: 80 },
    mark: { x: 96, y: STORY.height - 190, w: STORY.width - 192, h: 60 },
  };
}

export interface StubShareLines {
  /** Small line at the top of the ticket: "Soosh drop", "Finisher". */
  kicker: string;
  title: string;
  /** The biggest line: "No. 042" for a drop, the day for the others. */
  big: string;
  /** Under the big line: "of 318", "Still open", "October", a goal. */
  detail: string;
  /** On the tear-off. */
  foot: string;
  /** Under the ticket: whose it is. Empty when there is no name to print. */
  owner: string;
  mark: string;
}

/** Everything the image prints, already worded. Real numbers only: an edition and a total appear when the Stub has them. */
export function stubShareLines(face: StubFace, firstName?: string): StubShareLines {
  const drop = face.kind === "drop";
  const big = drop && face.edition ? editionLabel(face.edition) : face.kind === "regular" && face.monthLong ? face.monthLong : face.day;
  const detail = drop
    ? face.editionsTotal
      ? `of ${face.editionsTotal}`
      : "Still open"
    : face.kind === "event" && face.hostName
      ? `Confirmed by ${face.hostName}`
      : face.cornerName && face.cornerName !== face.title
        ? face.cornerName
        : "";
  const name = firstName?.trim().split(/\s+/)[0]?.slice(0, 24) ?? "";
  return {
    kicker: drop ? "Soosh drop" : KIND_LABEL[face.kind],
    title: face.title,
    big,
    detail,
    foot: drop || face.kind === "regular" ? face.day : KIND_LABEL[face.kind],
    owner: name ? `Kept by ${name}` : "",
    mark: `${APP_NAME} · ${SITE_DOMAIN}`,
  };
}

const BG = "#0E0D0C"; // design-token-ignore: app background, drawn on a canvas that cannot read CSS variables
const TEXT = "#F4EFE8"; // design-token-ignore: app text colour, drawn on a canvas
const INK = "#16130F"; // design-token-ignore: ink on the ticket, drawn on a canvas
const PAPER = "#F6EFE2"; // design-token-ignore: ticket stock for the kinds with no palette, drawn on a canvas
const CORAL = "#FF6B4A"; // design-token-ignore: the accent, for the glow when a Stub has no palette
/** The same five colours a drop gets when none were chosen (drops.palette default). */
const HOLO = ["#ff7ab6", "#ffd36e", "#7ff2c8", "#73aaff", "#c47bff"]; // design-token-ignore: the drop default palette, drawn on a canvas

const HEX = /^#[0-9a-f]{6}$/i;
/** Only plain hex colours reach the canvas; anything else falls back. */
export const sharePalette = (face: StubFace): string[] => {
  const safe = (face.palette ?? []).filter((c) => HEX.test(c));
  if (safe.length >= 2) return safe;
  return face.kind === "drop" ? HOLO : [PAPER, PAPER];
};

/** Breaks a title into at most `maxLines` lines that fit `maxWidth`, ending the last one with an ellipsis if it must. */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || measure(next) <= maxWidth) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = `${kept[maxLines - 1]}…`;
  while (last.length > 2 && measure(last) > maxWidth) last = `${last.slice(0, -2)}…`;
  kept[maxLines - 1] = last;
  return kept;
}

const DISPLAY = "'Bricolage Grotesque', Inter, system-ui, sans-serif";
const BODY = "Inter, system-ui, sans-serif";

export function drawStubShare(ctx: CanvasRenderingContext2D, face: StubFace, firstName?: string) {
  const l = stubShareLayout();
  const lines = stubShareLines(face, firstName);
  const palette = sharePalette(face);
  const t = l.ticket;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, STORY.width, STORY.height);

  // The glow, in the Stub's own colour.
  const glow = ctx.createRadialGradient(STORY.width / 2, t.y + t.h / 2, 80, STORY.width / 2, t.y + t.h / 2, 820);
  glow.addColorStop(0, face.kind === "drop" ? palette[0] : CORAL);
  glow.addColorStop(1, BG);
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, STORY.width, STORY.height);
  ctx.globalAlpha = 1;

  // The ticket, tilted 6 degrees about its own centre.
  ctx.save();
  ctx.translate(t.x + t.w / 2, t.y + t.h / 2);
  ctx.rotate((-6 * Math.PI) / 180);
  ctx.translate(-t.w / 2, -t.h / 2);

  ctx.shadowColor = "rgba(0, 0, 0, 0.55)"; // design-token-ignore: the ticket's drop shadow, drawn on a canvas
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 34;
  const stock = ctx.createLinearGradient(0, 0, t.w, t.h);
  palette.forEach((c, i) => stock.addColorStop(palette.length === 1 ? 0 : i / (palette.length - 1), c));
  ctx.fillStyle = stock;
  ctx.beginPath();
  ctx.roundRect(0, 0, t.w, t.h, 44);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // A soft sheen so the foil reads as foil, not a flat gradient.
  const sheen = ctx.createLinearGradient(0, 0, t.w, t.h * 0.6);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.5)"); // design-token-ignore: foil sheen, drawn on a canvas
  sheen.addColorStop(0.45, "rgba(255, 255, 255, 0.08)"); // design-token-ignore: foil sheen, drawn on a canvas
  sheen.addColorStop(1, "rgba(255, 255, 255, 0.3)"); // design-token-ignore: foil sheen, drawn on a canvas
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, t.w, t.h, 44);
  ctx.clip();
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, t.w, t.h);
  ctx.restore();

  // The perforation: two notches and a dotted line.
  ctx.fillStyle = BG;
  for (const nx of [0, t.w]) {
    ctx.beginPath();
    ctx.arc(nx, l.tearY, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 4;
  ctx.setLineDash([4, 18]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(44, l.tearY);
  ctx.lineTo(t.w - 44, l.tearY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  const pad = 60;
  ctx.fillStyle = INK;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.globalAlpha = 0.75;
  ctx.font = `600 34px ${BODY}`;
  ctx.fillText(lines.kicker, pad, 64, t.w - pad * 2);
  ctx.globalAlpha = 1;

  ctx.font = `800 84px ${DISPLAY}`;
  const title = wrapLines(lines.title, t.w - pad * 2, (s) => ctx.measureText(s).width);
  title.forEach((line, i) => ctx.fillText(line, pad, 130 + i * 92, t.w - pad * 2));

  ctx.font = `800 168px ${DISPLAY}`;
  ctx.fillText(lines.big, pad, l.tearY - 300, t.w - pad * 2);
  if (lines.detail) {
    ctx.font = `600 40px ${BODY}`;
    ctx.fillText(lines.detail, pad, l.tearY - 104, t.w - pad * 2);
  }

  ctx.font = `600 38px ${BODY}`;
  ctx.fillText(lines.foot, pad, l.tearY + 96, t.w - pad * 2);
  ctx.textAlign = "right";
  ctx.font = `800 44px ${DISPLAY}`;
  ctx.fillText(APP_NAME, t.w - pad, l.tearY + 92);
  ctx.restore();

  ctx.fillStyle = TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  if (lines.owner) {
    ctx.font = `800 64px ${DISPLAY}`;
    ctx.fillText(lines.owner, STORY.width / 2, l.name.y, l.name.w);
  }
  ctx.globalAlpha = 0.7;
  ctx.font = `600 36px ${BODY}`;
  ctx.fillText(lines.mark, STORY.width / 2, l.mark.y, l.mark.w);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

/** Renders the story image for a Stub. Null when the device cannot draw one. */
export async function renderStubShare(face: StubFace, firstName?: string): Promise<Blob | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = STORY.width;
    canvas.height = STORY.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // The display face, if it has loaded; the image is still drawn without it.
    await document.fonts?.load?.(`800 84px 'Bricolage Grotesque'`).catch(() => undefined);
    drawStubShare(ctx, face, firstName);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  } catch {
    return null;
  }
}

export type ShareOutcome = "shared" | "saved" | "failed";

/**
 * Hands the Stub's image to the phone's share sheet (Instagram, Messages), or
 * saves it where there is no share sheet. Closing the sheet counts as shared:
 * it is not an error and nothing more should happen.
 */
export async function shareStub(face: StubFace, firstName?: string): Promise<ShareOutcome> {
  const blob = await renderStubShare(face, firstName);
  if (!blob) return "failed";
  const file = new File([blob], "soosh-stub.png", { type: "image/png" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: face.title });
      return "shared";
    }
  } catch {
    return "shared";
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = "soosh-stub.png";
  a.click();
  URL.revokeObjectURL(url);
  return "saved";
}
