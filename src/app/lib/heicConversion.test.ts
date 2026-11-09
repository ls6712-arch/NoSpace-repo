import { describe, expect, it, vi, beforeEach } from "vitest";

const convertMock = vi.fn();
const nativeMock = vi.fn();
vi.mock("./heicNative", () => ({ heicToJpegNative: (...args: unknown[]) => nativeMock(...args) }));
vi.mock("./heicServer", () => ({ heicToJpegOnServer: (...args: unknown[]) => convertMock(...args) }));

const { convertHeicIfNeeded, convertHeicFiles, isHeicFile } = await import("./heicConversion");

function makeFile(name: string, type: string): File {
  return new File(["fake-bytes"], name, { type });
}

beforeEach(() => {
  convertMock.mockReset();
  nativeMock.mockReset();
  nativeMock.mockRejectedValue(new Error("no native decoder"));
});

describe("convertHeicIfNeeded", () => {
  it("uses the browser's own decoder when it works, without calling the server", async () => {
    nativeMock.mockResolvedValue(new Blob(["native"], { type: "image/jpeg" }));
    const result = await convertHeicIfNeeded(makeFile("IMG_9.heic", "image/heic"));
    expect(result.name).toBe("IMG_9.jpg");
    expect(result.type).toBe("image/jpeg");
    expect(convertMock).not.toHaveBeenCalled();
  });

  it("passes a non-HEIC file through untouched, without calling the converter", async () => {
    const file = makeFile("mug.jpg", "image/jpeg");
    const result = await convertHeicIfNeeded(file);
    expect(result).toBe(file);
    expect(convertMock).not.toHaveBeenCalled();
  });

  it("detects HEIC by MIME type and converts to a renamed JPEG", async () => {
    convertMock.mockResolvedValue(new Blob(["converted"], { type: "image/jpeg" }));
    const file = makeFile("IMG_0001.heic", "image/heic");
    const result = await convertHeicIfNeeded(file);
    expect(convertMock).toHaveBeenCalledWith(file);
    expect(result.name).toBe("IMG_0001.jpg");
    expect(result.type).toBe("image/jpeg");
  });

  it("detects HEIF by file extension even without a matching MIME type", async () => {
    convertMock.mockResolvedValue(new Blob(["converted"], { type: "image/jpeg" }));
    const file = makeFile("photo.HEIF", "application/octet-stream");
    const result = await convertHeicIfNeeded(file);
    expect(convertMock).toHaveBeenCalled();
    expect(result.name).toBe("photo.jpg");
  });

  it("falls back to the original file if conversion throws, logging the real error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    convertMock.mockRejectedValue(new Error("unsupported HEIC variant"));
    const file = makeFile("broken.heic", "image/heic");
    const result = await convertHeicIfNeeded(file);
    expect(result).toBe(file);
    // A caller checks this to tell a real failure apart from a real
    // conversion — see MediaAttachPicker.tsx/CameraCapture.tsx/Log.tsx,
    // which all reject a pick that's still HEIC-shaped after this call
    // rather than silently accepting an unrenderable file.
    expect(isHeicFile(result)).toBe(true);
    expect(consoleError).toHaveBeenCalledWith(
      "HEIC conversion failed, falling back to the original file:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});

describe("isHeicFile", () => {
  it("is true for a successfully converted file's original, unconverted input but false for its output", async () => {
    convertMock.mockResolvedValue(new Blob(["converted"], { type: "image/jpeg" }));
    const file = makeFile("IMG_0002.heic", "image/heic");
    expect(isHeicFile(file)).toBe(true);
    const result = await convertHeicIfNeeded(file);
    expect(isHeicFile(result)).toBe(false);
  });

  it("is false for an ordinary image", () => {
    expect(isHeicFile(makeFile("mug.jpg", "image/jpeg"))).toBe(false);
  });
});

describe("convertHeicFiles", () => {
  it("converts a mixed batch, leaving non-HEIC files untouched", async () => {
    convertMock.mockResolvedValue(new Blob(["converted"], { type: "image/jpeg" }));
    const jpg = makeFile("a.jpg", "image/jpeg");
    const heic = makeFile("b.heic", "image/heic");
    const [resultJpg, resultHeic] = await convertHeicFiles([jpg, heic]);
    expect(resultJpg).toBe(jpg);
    expect(resultHeic.name).toBe("b.jpg");
  });
});
