import { describe, expect, it } from "vitest";
import { extractStoragePath, legacyMediaPaths } from "./backfillMomentMediaLogic";

const BUCKET = "post-media";
const publicUrl = (path: string) =>
  `https://abcxyz.supabase.co/storage/v1/object/public/${BUCKET}/${path}`;

describe("extractStoragePath", () => {
  it("pulls the path back out of a matching public URL", () => {
    expect(extractStoragePath(publicUrl("user-1/photo.jpg"), BUCKET)).toBe("user-1/photo.jpg");
  });

  it("returns null for a URL from a different bucket", () => {
    expect(extractStoragePath(publicUrl("user-1/photo.jpg").replace(BUCKET, "message-media"), BUCKET)).toBe(
      null,
    );
  });

  it("returns null for an empty or missing URL", () => {
    expect(extractStoragePath("", BUCKET)).toBe(null);
  });

  it("returns null for a generated-placeholder-art URL that never lived in storage", () => {
    expect(extractStoragePath("https://images.example.com/placeholder-pottery.svg", BUCKET)).toBe(null);
  });
});

describe("legacyMediaPaths", () => {
  it("returns null when there's no media at all", () => {
    expect(legacyMediaPaths({ media_url: null, media_urls: null }, BUCKET)).toBe(null);
    expect(legacyMediaPaths({ media_url: "", media_urls: null }, BUCKET)).toBe(null);
  });

  it("resolves a single-image row from media_url alone", () => {
    expect(legacyMediaPaths({ media_url: publicUrl("a/1.jpg"), media_urls: null }, BUCKET)).toEqual([
      "a/1.jpg",
    ]);
  });

  it("prefers media_urls over media_url when both are set, in order", () => {
    const row = {
      media_url: publicUrl("a/1.jpg"),
      media_urls: [publicUrl("a/1.jpg"), publicUrl("a/2.jpg")],
    };
    expect(legacyMediaPaths(row, BUCKET)).toEqual(["a/1.jpg", "a/2.jpg"]);
  });

  it("returns null for a wordless capture's generated-placeholder-art URL", () => {
    const row = { media_url: "https://images.example.com/placeholder-pottery.svg", media_urls: null };
    expect(legacyMediaPaths(row, BUCKET)).toBe(null);
  });

  it("returns null rather than a partial list when any entry can't be resolved", () => {
    const row = { media_url: null, media_urls: [publicUrl("a/1.jpg"), "https://elsewhere.example.com/x.jpg"] };
    expect(legacyMediaPaths(row, BUCKET)).toBe(null);
  });
});
