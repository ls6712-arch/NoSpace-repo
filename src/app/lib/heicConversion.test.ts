import { describe, expect, it, vi, beforeEach } from "vitest";

const heic2anyMock = vi.fn();
vi.mock("heic2any", () => ({ default: (...args: unknown[]) => heic2anyMock(...args) }));

const { convertHeicIfNeeded, convertHeicFiles, isHeicFile } = await import("./heicConversion");

function makeFile(name: string, type: string): File {
  return new File(["fake-bytes"], name, { type });
}

beforeEach(() => {
  heic2anyMock.mockReset();
});

describe("convertHeicIfNeeded", () => {
  it("passes a non-HEIC file through untouched, without calling heic2any", async () => {
    const file = makeFile("mug.jpg", "image/jpeg");
    const result = await convertHeicIfNeeded(file);
    expect(result).toBe(file);
    expect(heic2anyMock).not.toHaveBeenCalled();
  });

  it("detects HEIC by MIME type and converts to a renamed JPEG", async () => {
    heic2anyMock.mockResolvedValue(new Blob(["converted"], { type: "image/jpeg" }));
    const file = makeFile("IMG_0001.heic", "image/heic");
    const result = await convertHeicIfNeeded(file);
    expect(heic2anyMock).toHaveBeenCalledWith({ blob: file, toType: "image/jpeg", quality: 0.9 });
    expect(result.name).toBe("IMG_0001.jpg");
    expect(result.type).toBe("image/jpeg");
  });

  it("detects HEIF by file extension even without a matching MIME type", async () => {
    heic2anyMock.mockResolvedValue(new Blob(["converted"], { type: "image/jpeg" }));
    const file = makeFile("photo.HEIF", "application/octet-stream");
    const result = await convertHeicIfNeeded(file);
    expect(heic2anyMock).toHaveBeenCalled();
    expect(result.name).toBe("photo.jpg");
  });

  it("keeps only the first frame when heic2any returns multiple blobs", async () => {
    const first = new Blob(["frame-1"], { type: "image/jpeg" });
    const second = new Blob(["frame-2"], { type: "image/jpeg" });
    heic2anyMock.mockResolvedValue([first, second]);
    const file = makeFile("burst.heic", "image/heic");
    const result = await convertHeicIfNeeded(file);
    expect(await result.text()).toBe("frame-1");
  });

  it("falls back to the original file if conversion throws, logging the real error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    heic2anyMock.mockRejectedValue(new Error("unsupported HEIC variant"));
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
    heic2anyMock.mockResolvedValue(new Blob(["converted"], { type: "image/jpeg" }));
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
    heic2anyMock.mockResolvedValue(new Blob(["converted"], { type: "image/jpeg" }));
    const jpg = makeFile("a.jpg", "image/jpeg");
    const heic = makeFile("b.heic", "image/heic");
    const [resultJpg, resultHeic] = await convertHeicFiles([jpg, heic]);
    expect(resultJpg).toBe(jpg);
    expect(resultHeic.name).toBe("b.jpg");
  });
});
