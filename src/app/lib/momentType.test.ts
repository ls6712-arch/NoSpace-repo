import { describe, expect, it } from "vitest";
import { classifyMomentType } from "./momentType";

describe("classifyMomentType", () => {
  it("is written when nothing is attached", () => {
    expect(classifyMomentType([])).toBe("written");
  });

  it("is photo when only photos are attached", () => {
    expect(
      classifyMomentType([{ type: "image/jpeg" }, { type: "image/png" }]),
    ).toBe("photo");
  });

  it("is video when only a video is attached", () => {
    expect(classifyMomentType([{ type: "video/mp4" }])).toBe("video");
  });

  it("video wins when photos and a video are attached together", () => {
    expect(
      classifyMomentType([
        { type: "image/jpeg" },
        { type: "image/png" },
        { type: "video/mp4" },
      ]),
    ).toBe("video");
  });

  it("video wins regardless of where the video falls in the list", () => {
    expect(
      classifyMomentType([{ type: "video/quicktime" }, { type: "image/jpeg" }]),
    ).toBe("video");
  });
});
