import { describe, expect, it } from "vitest";
import { withFirstFrame } from "./mediaUrl";

describe("withFirstFrame", () => {
  it("adds a first-frame fragment to a plain video URL", () => {
    expect(withFirstFrame("https://x.supabase.co/storage/v1/object/public/post-media/a/b.mp4")).toBe(
      "https://x.supabase.co/storage/v1/object/public/post-media/a/b.mp4#t=0.1",
    );
  });
  it("keeps a signed URL's token and puts the fragment after it", () => {
    expect(withFirstFrame("https://x/sign/moment-media/a.mp4?token=abc")).toBe("https://x/sign/moment-media/a.mp4?token=abc#t=0.1");
  });
  it("works for blob: previews", () => {
    expect(withFirstFrame("blob:https://app/123")).toBe("blob:https://app/123#t=0.1");
  });
  it("leaves a URL that already has a fragment alone", () => {
    expect(withFirstFrame("https://x/a.mp4#t=2")).toBe("https://x/a.mp4#t=2");
  });
});
