import { describe, expect, it } from "vitest";
import { variantSrcSet, variantUrl } from "./imageVariants";

const SIGNED = "https://abc.supabase.co/storage/v1/object/sign/moment-media/u1/p.jpg?token=T";
const PUBLIC = "https://abc.supabase.co/storage/v1/object/public/post-media/u1/a.png";

describe("variantUrl", () => {
  it("does nothing while transforms are off", () => {
    expect(variantUrl(SIGNED, { width: 400 }, false)).toBe(SIGNED);
    expect(variantSrcSet(SIGNED, 400, false)).toBeUndefined();
  });
  it("points signed and public Storage URLs at the render endpoint, keeping the token", () => {
    const s = new URL(variantUrl(SIGNED, { width: 400 }, true));
    expect(s.pathname).toBe("/storage/v1/render/image/sign/moment-media/u1/p.jpg");
    expect(s.searchParams.get("token")).toBe("T");
    expect(s.searchParams.get("width")).toBe("400");
    const p = new URL(variantUrl(PUBLIC, { width: 96 }, true));
    expect(p.pathname).toBe("/storage/v1/render/image/public/post-media/u1/a.png");
    expect(p.searchParams.get("resize")).toBe("cover");
  });
  it("leaves other hosts, blobs and data URIs alone", () => {
    for (const u of ["https://images.unsplash.com/photo-1?w=600", "blob:http://x/1", "data:image/png;base64,AAA", "not a url", ""]) {
      expect(variantUrl(u, { width: 400 }, true)).toBe(u);
    }
  });
  it("builds a 1x/2x srcset", () => {
    expect(variantSrcSet(SIGNED, 200, true)).toMatch(/width=200.* 1x, .*width=400.* 2x$/);
  });
});
