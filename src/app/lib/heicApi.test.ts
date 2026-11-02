import { describe, expect, it } from "vitest";
import { checkHeicRequest, HEIC_LIMIT, looksLikeHeif } from "../../../api/heicCheck";
import { HEIC_MAX_BYTES } from "./heicServer";

const heif = (brand: string) => new Uint8Array([0, 0, 0, 24, ...Array.from("ftyp" + brand, (c) => c.charCodeAt(0)), 0, 0, 0, 0]);

describe("/api/heic's checks", () => {
  it("takes HEIC and HEIF brands, and nothing else", () => {
    for (const b of ["heic", "heix", "mif1", "msf1"]) expect(looksLikeHeif(heif(b))).toBe(true);
    expect(looksLikeHeif(heif("isom"))).toBe(false);
    expect(looksLikeHeif(new TextEncoder().encode("<script>alert(1)</script>"))).toBe(false);
    expect(looksLikeHeif(new Uint8Array(4))).toBe(false);
  });

  it("refuses no token, oversized bodies and form posts before reading anything", () => {
    expect(checkHeicRequest(new Headers({ "content-type": "application/octet-stream" }))?.status).toBe(401);
    expect(checkHeicRequest(new Headers({ authorization: "Bearer t", "content-type": "application/octet-stream", "content-length": String(HEIC_LIMIT + 1) }))?.status).toBe(413);
    expect(checkHeicRequest(new Headers({ authorization: "Bearer t", "content-type": "application/x-www-form-urlencoded" }))?.status).toBe(415);
    expect(checkHeicRequest(new Headers({ authorization: "Bearer t", "content-type": "application/octet-stream", "content-length": "1000" }))).toBeNull();
  });

  it("the app never sends more than the function takes", () => {
    expect(HEIC_MAX_BYTES).toBeLessThanOrEqual(HEIC_LIMIT);
  });
});
