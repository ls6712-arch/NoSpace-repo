import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ERRORS, HEIC_LIMIT, MAX_PIXELS, TIMEOUT_MS, checkHeicRequest, handleHeic, heifPixels, looksLikeHeif, readCapped, type Claim, type HeicDeps } from "../../../api/heicCheck";
import { HEIC_MAX_BYTES } from "./heicServer";

// A minimal HEIF file, box by box: ftyp, then meta > iprp > ipco > ispe (the declared size).
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const box = (t: string, body: number[]) => [...u32(8 + body.length), ...ascii(t), ...body];
const fullBox = (t: string, body: number[]) => box(t, [0, 0, 0, 0, ...body]);
function heif(w: number, h: number, brand = "heic", extra: number[] = []): Uint8Array {
  const ftyp = box("ftyp", [...ascii(brand), 0, 0, 0, 0, ...ascii("mif1")]);
  const meta = fullBox("meta", box("iprp", box("ipco", fullBox("ispe", [...u32(w), ...u32(h)]))));
  return new Uint8Array([...ftyp, ...meta, ...extra]);
}

const TOKEN = "header.payload.signature";
function deps(over: Partial<HeicDeps> & { claimAs?: Claim } = {}) {
  const convert = vi.fn(async () => new Uint8Array([0xff, 0xd8, 0xff]));
  const d: HeicDeps = {
    getUser: async (t) => (t === TOKEN ? { id: "u1", is_anonymous: false } : null),
    claim: async () => over.claimAs ?? "ok",
    convert,
    ...over,
  };
  return { d, convert: (over.convert as typeof convert | undefined) ?? convert };
}
const post = (body: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request("https://soosh.test/api/heic", {
    method: "POST",
    body,
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/octet-stream", ...headers },
  });
const errorOf = async (r: Response) => ((await r.json()) as { error: string }).error;

describe("/api/heic: who", () => {
  it("refuses no token, a token Supabase Auth rejects, and an anonymous guest (401), before reading anything", async () => {
    for (const [req, user] of [
      [post(heif(100, 100), { authorization: "" }), null],
      [post(heif(100, 100), { authorization: "Bearer forged.jwt.value" }), null],
      [post(heif(100, 100)), { id: "g", is_anonymous: true }],
    ] as const) {
      const { d, convert } = deps({ getUser: async () => user });
      const res = await handleHeic(req, d);
      expect(res.status).toBe(401);
      expect(await errorOf(res)).toBe(ERRORS[401]);
      expect(convert).not.toHaveBeenCalled();
    }
  });

  it("refuses a signed-in non-member (403) and over 30 an hour (429)", async () => {
    for (const [claimAs, status] of [["not_member", 403], ["rate_limited", 429], ["not_signed_in", 401], ["error", 500]] as const) {
      const { d, convert } = deps({ claimAs });
      const res = await handleHeic(post(heif(100, 100)), d);
      expect(res.status).toBe(status);
      expect(convert).not.toHaveBeenCalled();
    }
  });

  it("checks who before it reads the body (a refused caller's upload is never read)", async () => {
    let pulled = false;
    // highWaterMark 0: the stream is only pulled when someone actually reads it.
    const body = new ReadableStream<Uint8Array>({ pull: () => void (pulled = true) }, { highWaterMark: 0 });
    const { d } = deps({ claimAs: "not_member" });
    await handleHeic(new Request("https://soosh.test/api/heic", { method: "POST", body, headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/octet-stream" }, duplex: "half" } as RequestInit), d);
    expect(pulled).toBe(false);
  });
});

describe("/api/heic: how big", () => {
  it("refuses a declared size over 4.4 MB before anything else", () => {
    expect(checkHeicRequest(new Headers({ authorization: "Bearer t", "content-type": "application/octet-stream", "content-length": String(HEIC_LIMIT + 1) }))?.status).toBe(413);
  });

  it("stops reading at 4.4 MB even when the header lies", async () => {
    const chunk = new Uint8Array(1_000_000);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        sent += 1;
        if (sent > 10) c.close();
        else c.enqueue(chunk);
      },
    });
    expect(await readCapped(body)).toBeNull();
    // It stopped at the 5th megabyte, not after all 10.
    expect(sent).toBeLessThanOrEqual(6);
  });

  it("refuses an image declaring more than 40 megapixels, without decoding it", async () => {
    const { d, convert } = deps();
    const res = await handleHeic(post(heif(8000, 6000)), d); // 48 MP
    expect(res.status).toBe(413);
    expect(convert).not.toHaveBeenCalled();
    expect(heifPixels(heif(8000, 6000))).toBe(48_000_000);
    expect(heifPixels(heif(4032, 3024))).toBeLessThan(MAX_PIXELS);
  });

  it("refuses a file whose boxes don't add up, or with no declared size, rather than decode it blind", () => {
    const broken = heif(100, 100);
    broken[27] = 0xff; // the meta box's size now runs past the end
    expect(heifPixels(broken)).toBeNull();
    expect(heifPixels(new Uint8Array(box("ftyp", [...ascii("heic"), 0, 0, 0, 0])))).toBeNull();
  });

  it("the app never sends more than the function takes", () => {
    expect(HEIC_MAX_BYTES).toBeLessThanOrEqual(HEIC_LIMIT);
  });
});

describe("/api/heic: what", () => {
  it("judges the file by its bytes, never its name or type", async () => {
    for (const b of ["heic", "heix", "mif1", "msf1"]) expect(looksLikeHeif(heif(10, 10, b))).toBe(true);
    expect(looksLikeHeif(heif(10, 10, "isom"))).toBe(false);
    const { d, convert } = deps();
    // A JPEG (or a script) labelled HEIC is refused.
    const res = await handleHeic(post(new TextEncoder().encode("<script>alert(1)</script>"), { "content-type": "image/heic" }), d);
    expect(res.status).toBe(415);
    expect(convert).not.toHaveBeenCalled();
  });

  it("refuses form posts and other content types", () => {
    expect(checkHeicRequest(new Headers({ authorization: "Bearer t", "content-type": "application/x-www-form-urlencoded" }))?.status).toBe(415);
    expect(checkHeicRequest(new Headers({ authorization: "Bearer t", "content-type": "multipart/form-data; boundary=x" }))?.status).toBe(415);
  });
});

describe("/api/heic: the conversion", () => {
  it("returns the JPEG only, never stored or cached", async () => {
    const { d, convert } = deps();
    const file = heif(4032, 3024);
    const res = await handleHeic(post(file), d);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
    expect(convert).toHaveBeenCalledWith(file);
    // The only outside calls it has: Auth, the claim, the converter. No storage.
    expect(Object.keys(d).sort()).toEqual(["claim", "convert", "getUser"]);
  });

  it("gives up after the time limit (504)", async () => {
    const { d } = deps({ convert: () => new Promise<Uint8Array>(() => undefined), timeoutMs: 20 });
    const res = await handleHeic(post(heif(100, 100)), d);
    expect(res.status).toBe(504);
  });

  it("answers every failure with a short generic line, never the converter's own error", async () => {
    const { d } = deps({ convert: async () => Promise.reject(new Error("libheif: bad hvcC at offset 0x1f3, /var/task/node_modules/...")) });
    const res = await handleHeic(post(heif(100, 100)), d);
    expect(res.status).toBe(422);
    const text = await res.text();
    expect(text).toBe(JSON.stringify({ error: ERRORS[422] }));
    expect(text).not.toMatch(/libheif|offset|node_modules/);
  });
});

describe("/api/heic: deployment", () => {
  it("declares its config as literal values Vercel can read, with the same 10 second limit", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../../api/heic.ts"), "utf8");
    const m = /export const config = \{ runtime: "nodejs", maxDuration: (\d+) \};/.exec(src);
    expect(m).not.toBeNull();
    expect(Number(m![1]) * 1000).toBe(TIMEOUT_MS);
  });
});
