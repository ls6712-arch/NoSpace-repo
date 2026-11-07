import { describe, expect, it } from "vitest";
import { legacyPostMediaPath, thoughtMediaIsVideo } from "./thoughtMedia";

describe("thoughtMediaIsVideo", () => {
  it("reads the extension of a path, a URL and a signed link", () => {
    expect(thoughtMediaIsVideo("u1/abc.mp4")).toBe(true);
    expect(thoughtMediaIsVideo("https://x.supabase.co/storage/v1/object/sign/moment-media/u1/abc.webm?token=t")).toBe(true);
    expect(thoughtMediaIsVideo("u1/abc.jpg")).toBe(false);
    expect(thoughtMediaIsVideo("https://x.co/a.jpg?name=b.mp4")).toBe(false);
    expect(thoughtMediaIsVideo(undefined)).toBe(false);
  });
});

describe("legacyPostMediaPath", () => {
  it("finds the path in a public post-media URL", () => {
    expect(legacyPostMediaPath("https://x.supabase.co/storage/v1/object/public/post-media/u1/1-abc.jpg")).toBe("u1/1-abc.jpg");
  });
  it("is null for anything else", () => {
    expect(legacyPostMediaPath("https://example.com/a.jpg")).toBeNull();
    expect(legacyPostMediaPath("https://x.supabase.co/storage/v1/object/public/post-media/../x.jpg")).toBeNull();
    expect(legacyPostMediaPath(null)).toBeNull();
  });
});
