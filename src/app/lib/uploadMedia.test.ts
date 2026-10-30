import { describe, expect, it } from "vitest";
import {
  jpegName,
  mediaKindOf,
  prepareForUpload,
  scaledSize,
  storageExtension,
  videoUploadType,
  type MediaDeps,
} from "./uploadMedia";
import { UPLOAD_COPY } from "./stateCopy";

const file = (name: string, type: string, bytes = 10) => new File([new Uint8Array(bytes)], name, { type });

function deps(over: Partial<MediaDeps> = {}): MediaDeps & { drawn: { w: number; h: number }[] } {
  const drawn: { w: number; h: number }[] = [];
  return {
    drawn,
    decodeImage: async () => ({ width: 4032, height: 3024, source: {} as CanvasImageSource }),
    encodeJpeg: async (_s, w, h) => {
      drawn.push({ w, h });
      return new Blob([new Uint8Array(500)], { type: "image/jpeg" });
    },
    canPlayVideo: async () => true,
    convertHeic: async (f) => new File([f], f.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" }),
    ...over,
  };
}

describe("mediaKindOf", () => {
  it("reads the type first, then the name", () => {
    expect(mediaKindOf(file("a.png", "image/png"))).toBe("image");
    expect(mediaKindOf(file("IMG_1.HEIC", ""))).toBe("image");
    expect(mediaKindOf(file("clip.MOV", ""))).toBe("video");
    expect(mediaKindOf(file("notes.pdf", "application/pdf"))).toBe("other");
  });
});

describe("scaledSize", () => {
  it("shrinks the long side to the limit and keeps the shape", () => {
    expect(scaledSize(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 });
    expect(scaledSize(3024, 4032, 2048)).toEqual({ width: 1536, height: 2048 });
  });
  it("never enlarges a small picture", () => {
    expect(scaledSize(800, 600, 2048)).toEqual({ width: 800, height: 600 });
  });
  it("treats an empty picture as unreadable", () => {
    expect(scaledSize(0, 600)).toEqual({ width: 0, height: 0 });
  });
});

describe("names and types", () => {
  it("renames to .jpg", () => {
    expect(jpegName("IMG_0012.HEIC")).toBe("IMG_0012.jpg");
    expect(jpegName("photo")).toBe("photo.jpg");
  });
  it("stores QuickTime as MP4 and keeps WebM", () => {
    expect(videoUploadType(file("IMG_9.MOV", "video/quicktime"))).toEqual({ name: "IMG_9.mp4", type: "video/mp4" });
    expect(videoUploadType(file("a.webm", "video/webm"))).toEqual({ name: "a.webm", type: "video/webm" });
  });
  it("picks the stored extension from the prepared type", () => {
    expect(storageExtension(file("x.png", "image/jpeg"))).toBe("jpg");
    expect(storageExtension(file("x.mov", "video/mp4"))).toBe("mp4");
  });
});

describe("prepareForUpload", () => {
  it("turns a PNG into a resized JPEG", async () => {
    const d = deps();
    const r = await prepareForUpload(file("shot.png", "image/png"), { deps: d });
    expect(r.error).toBeNull();
    expect(r.file?.type).toBe("image/jpeg");
    expect(r.file?.name).toBe("shot.jpg");
    expect(d.drawn).toEqual([{ w: 2048, h: 1536 }]);
  });
  it("converts an iPhone photo, then resizes it", async () => {
    const d = deps();
    const r = await prepareForUpload(file("IMG_1.HEIC", "image/heic"), { deps: d });
    expect(r.file?.type).toBe("image/jpeg");
    expect(r.file?.name).toBe("IMG_1.jpg");
    expect(d.drawn).toHaveLength(1);
  });
  it("says so when an iPhone photo can't be converted", async () => {
    const r = await prepareForUpload(file("IMG_1.HEIC", "image/heic"), { deps: deps({ convertHeic: async (f) => f }) });
    expect(r).toEqual({ file: null, error: UPLOAD_COPY.heic });
  });
  it("keeps GIFs as they are so they still move", async () => {
    const d = deps();
    const r = await prepareForUpload(file("dance.gif", "image/gif"), { deps: d });
    expect(r.file?.type).toBe("image/gif");
    expect(d.drawn).toEqual([]);
  });
  it("says so when a photo can't be read", async () => {
    const r = await prepareForUpload(file("x.webp", "image/webp"), {
      deps: deps({ decodeImage: async () => { throw new Error("bad"); } }),
    });
    expect(r).toEqual({ file: null, error: UPLOAD_COPY.unreadable });
  });
  it("uploads a video that plays, as MP4", async () => {
    const r = await prepareForUpload(file("IMG_9.MOV", "video/quicktime"), { deps: deps() });
    expect(r.file?.type).toBe("video/mp4");
    expect(r.file?.name).toBe("IMG_9.mp4");
  });
  it("refuses a video this browser can't play", async () => {
    const r = await prepareForUpload(file("a.mov", "video/quicktime"), { deps: deps({ canPlayVideo: async () => false }) });
    expect(r).toEqual({ file: null, error: UPLOAD_COPY.videoUnplayable });
  });
  it("refuses videos where only photos go", async () => {
    const r = await prepareForUpload(file("a.mp4", "video/mp4"), { allowVideo: false, deps: deps() });
    expect(r).toEqual({ file: null, error: UPLOAD_COPY.photoOnly });
  });
  it("refuses a video over the size limit before trying to play it", async () => {
    let tried = false;
    const big = file("big.mp4", "video/mp4", 3 * 1024 * 1024);
    const r = await prepareForUpload(big, { maxMb: 2, deps: deps({ canPlayVideo: async () => { tried = true; return true; } }) });
    expect(r).toEqual({ file: null, error: UPLOAD_COPY.tooBig(2) });
    expect(tried).toBe(false);
  });
  it("refuses files that are neither photos nor videos", async () => {
    const r = await prepareForUpload(file("notes.pdf", "application/pdf"), { deps: deps() });
    expect(r).toEqual({ file: null, error: UPLOAD_COPY.wrongType });
  });
});

describe("prepareForUpload strips photo metadata", () => {
  // A minimal JPEG: SOI, then an APP1 "Exif" segment carrying a GPS tag, then EOI.
  const withGps = () => {
    const exif = new TextEncoder().encode("Exif\0\0GPSLatitude GPSLongitude DateTimeOriginal Make Model");
    const seg = new Uint8Array(4 + exif.length);
    seg.set([0xff, 0xe1, (exif.length + 2) >> 8, (exif.length + 2) & 0xff]);
    seg.set(exif, 4);
    return new Uint8Array([0xff, 0xd8, ...seg, 0xff, 0xd9]);
  };
  const text = async (f: File) => new TextDecoder("latin1").decode(new Uint8Array(await f.arrayBuffer()));

  it("stores only the re-encoded pixels, never the original bytes", async () => {
    const original = new File([withGps()], "IMG_1.jpg", { type: "image/jpeg" });
    expect(await text(original)).toContain("GPSLatitude");
    const out = await prepareForUpload(original, {
      deps: deps({ encodeJpeg: async () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }) }),
    });
    expect(out.error).toBeNull();
    const stored = await text(out.file!);
    expect(stored).not.toContain("Exif");
    expect(stored).not.toContain("GPS");
    expect(stored).not.toContain("DateTimeOriginal");
  });
});
