// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  buckets: [] as string[],
  uploads: [] as string[],
  result: { error: null as null | { message: string } },
}));
vi.mock("../../lib/supabase", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          storage.buckets.push(bucket);
          storage.uploads.push(path);
          return storage.result;
        },
      }),
    },
  },
}));
vi.mock("./uploadMedia", () => ({
  prepareForUpload: async (file: File) => ({ file, error: null }),
  storageExtension: () => "jpg",
}));

import { uploadThoughtFile } from "./momentMedia";

beforeEach(() => {
  storage.buckets = [];
  storage.uploads = [];
  storage.result = { error: null };
});

describe("uploadThoughtFile", () => {
  it("puts a thought's photo in the private moment-media bucket, in the person's own folder", async () => {
    const r = await uploadThoughtFile("user-1", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    expect(storage.buckets).toEqual(["moment-media"]);
    expect(r.error).toBeNull();
    expect(r.path).toMatch(/^user-1\/[0-9a-f-]{36}\.jpg$/);
  });

  it("never uses the public post-media bucket", async () => {
    await uploadThoughtFile("user-1", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    expect(storage.buckets).not.toContain("post-media");
  });

  it("returns no path when the upload fails", async () => {
    storage.result = { error: { message: "boom" } };
    const r = await uploadThoughtFile("user-1", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    expect(r.path).toBeNull();
    expect(r.error).toBeTruthy();
  });
});
