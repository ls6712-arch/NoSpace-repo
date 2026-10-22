import { UPLOAD_COPY } from "./stateCopy";

/**
 * The one step every upload goes through before it reaches Storage, so what
 * gets stored is something every browser can show.
 *
 * Photos (JPEG, PNG, WebP, AVIF, HEIC, HEIF, or anything else the browser can
 * decode): HEIC is converted first, then the picture is redrawn at most
 * MAX_IMAGE_EDGE pixels on its long side, the right way up, and saved as a
 * JPEG. A 4 MB iPhone photo becomes roughly 300 to 600 KB, so cards load
 * quickly on a phone without Supabase's Pro-plan image resizing.
 *
 * GIFs are kept as they are, so they still move.
 *
 * Videos: checked to actually play in this browser before upload. A
 * QuickTime file (.mov, what iPhones record) is stored as video/mp4, the type
 * Chrome, Firefox and Android will play when the video inside is H.264.
 *
 * Anything that fails comes back as an error sentence for the person, never a
 * silent broken upload.
 */

export const MAX_IMAGE_EDGE = 2048;
export const JPEG_QUALITY = 0.85;
/** Matches the post-media and moment-media buckets' file_size_limit (25 MB). */
export const MAX_UPLOAD_MB = 25;
/** message-media's file_size_limit (10 MB). */
export const MAX_MESSAGE_UPLOAD_MB = 10;

export type MediaKind = "image" | "video" | "other";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif", "bmp", "tif", "tiff"];
const VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "webm", "qt"];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > -1 ? name.slice(dot + 1).toLowerCase() : "";
}

/** What kind of file this is, from its type first and its name second. */
export function mediaKindOf(file: Pick<File, "type" | "name">): MediaKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  const ext = extensionOf(file.name);
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  return "other";
}

/** Same test as heicConversion's isHeicFile, kept here so this module never
 * loads heic2any (which needs a browser) until a HEIC file actually arrives. */
export function isHeicLike(file: Pick<File, "type" | "name">): boolean {
  const ext = extensionOf(file.name);
  return file.type === "image/heic" || file.type === "image/heif" || ext === "heic" || ext === "heif";
}

export function isGif(file: Pick<File, "type" | "name">): boolean {
  return file.type === "image/gif" || extensionOf(file.name) === "gif";
}

/** The size to draw at: the long side at most `maxEdge`, never enlarged. */
export function scaledSize(width: number, height: number, maxEdge = MAX_IMAGE_EDGE): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** `IMG_0012.HEIC` → `IMG_0012.jpg`; a name with no extension gets `.jpg`. */
export function jpegName(name: string): string {
  const base = name.replace(/\.[^./\\]*$/, "") || "photo";
  return `${base}.jpg`;
}

/** The name and content type a playable video is stored under. */
export function videoUploadType(file: Pick<File, "type" | "name">): { name: string; type: string } {
  const ext = extensionOf(file.name);
  if (file.type === "video/webm" || ext === "webm") return { name: file.name, type: "video/webm" };
  // .mov / .m4v / .qt and unknown video types: browsers outside Safari refuse
  // video/quicktime even when the video inside is H.264, but play it as MP4.
  const base = file.name.replace(/\.[^./\\]*$/, "") || "video";
  return { name: `${base}.mp4`, type: "video/mp4" };
}

/** What the browser does for us. Injected so the logic is testable in Node. */
export interface MediaDeps {
  /** Decodes a picture, right way up. Throws if the browser can't read it. */
  decodeImage(file: Blob): Promise<{ width: number; height: number; source: CanvasImageSource; close?: () => void }>;
  /** Draws the decoded picture at width x height and returns a JPEG. */
  encodeJpeg(source: CanvasImageSource, width: number, height: number, quality: number): Promise<Blob>;
  /** True when this browser can load the video and knows its size. */
  canPlayVideo(file: Blob): Promise<boolean>;
  /** Converts HEIC/HEIF to JPEG; returns the file unchanged if it can't. */
  convertHeic(file: File): Promise<File>;
}

export type PreparedUpload = { file: File; error: null } | { file: null; error: string };

export interface PrepareOptions {
  /** Videos are refused (with a sentence) where the destination takes photos only. */
  allowVideo?: boolean;
  maxMb?: number;
  maxEdge?: number;
  deps?: MediaDeps;
}

export async function prepareForUpload(file: File, options: PrepareOptions = {}): Promise<PreparedUpload> {
  const { allowVideo = true, maxMb = MAX_UPLOAD_MB, maxEdge = MAX_IMAGE_EDGE } = options;
  const deps = options.deps ?? browserDeps();
  const kind = mediaKindOf(file);

  if (kind === "video") {
    if (!allowVideo) return { file: null, error: UPLOAD_COPY.photoOnly };
    if (file.size > maxMb * 1024 * 1024) return { file: null, error: UPLOAD_COPY.tooBig(maxMb) };
    const plays = await deps.canPlayVideo(file).catch(() => false);
    if (!plays) return { file: null, error: UPLOAD_COPY.videoUnplayable };
    const { name, type } = videoUploadType(file);
    return { file: new File([file], name, { type }), error: null };
  }

  if (kind !== "image") return { file: null, error: allowVideo ? UPLOAD_COPY.wrongType : UPLOAD_COPY.photoOnly };

  if (isGif(file)) {
    if (file.size > maxMb * 1024 * 1024) return { file: null, error: UPLOAD_COPY.tooBig(maxMb) };
    return { file: new File([file], file.name, { type: "image/gif" }), error: null };
  }

  const converted = isHeicLike(file) ? await deps.convertHeic(file).catch(() => file) : file;
  if (isHeicLike(converted)) return { file: null, error: UPLOAD_COPY.heic };

  let decoded: Awaited<ReturnType<MediaDeps["decodeImage"]>>;
  try {
    decoded = await deps.decodeImage(converted);
  } catch {
    return { file: null, error: UPLOAD_COPY.unreadable };
  }

  try {
    const size = scaledSize(decoded.width, decoded.height, maxEdge);
    if (size.width === 0) return { file: null, error: UPLOAD_COPY.unreadable };
    const jpeg = await deps.encodeJpeg(decoded.source, size.width, size.height, JPEG_QUALITY);
    if (jpeg.size > maxMb * 1024 * 1024) return { file: null, error: UPLOAD_COPY.tooBig(maxMb) };
    return { file: new File([jpeg], jpegName(file.name), { type: "image/jpeg" }), error: null };
  } catch {
    return { file: null, error: UPLOAD_COPY.unreadable };
  } finally {
    decoded.close?.();
  }
}

/** The file extension to store a prepared file under. */
export function storageExtension(file: Pick<File, "type" | "name">): string {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/gif") return "gif";
  if (file.type === "video/mp4") return "mp4";
  if (file.type === "video/webm") return "webm";
  return extensionOf(file.name).replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
}

function browserDeps(): MediaDeps {
  return {
    async convertHeic(file) {
      const { convertHeicIfNeeded } = await import("./heicConversion");
      return convertHeicIfNeeded(file);
    },
    async decodeImage(file) {
      if (typeof createImageBitmap === "function") {
        try {
          const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
          return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() };
        } catch {
          // Fall through to <img>, which some browsers decode more formats with.
        }
      }
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
        await img.decode();
        return { width: img.naturalWidth, height: img.naturalHeight, source: img, close: () => URL.revokeObjectURL(url) };
      } catch (err) {
        URL.revokeObjectURL(url);
        throw err;
      }
    },
    async encodeJpeg(source, width, height, quality) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      // JPEG has no transparency: a transparent PNG goes on white, not black.
      // design-token-ignore: pixel data baked into the uploaded file, not UI
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, 0, 0, width, height);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
      );
    },
    canPlayVideo(file) {
      return new Promise<boolean>((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement("video");
        let done = false;
        const finish = (ok: boolean) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          video.removeAttribute("src");
          video.load();
          URL.revokeObjectURL(url);
          resolve(ok);
        };
        const timer = setTimeout(() => finish(false), 10_000);
        video.preload = "metadata";
        video.muted = true;
        video.onloadedmetadata = () => finish(video.videoWidth > 0 && video.videoHeight > 0);
        video.onerror = () => finish(false);
        video.src = url;
      });
    },
  };
}
