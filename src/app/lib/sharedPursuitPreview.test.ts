import { describe, expect, it } from "vitest";
import { buildSharedPursuitPreview } from "./sharedPursuitPreview";

describe("buildSharedPursuitPreview", () => {
  it("attributes the Pursuit to its own owner, never anyone else", () => {
    const pursuitRow = { id: "p1", title: "Learning pottery", user_id: "owner-sush" };
    const preview = buildSharedPursuitPreview(pursuitRow, "Sushmitha", null);
    expect(preview.ownerId).toBe("owner-sush");
    expect(preview.ownerName).toBe("Sushmitha");
  });

  it("still attributes to the owner when a different person shared it — sender never has a way in", () => {
    // A Pursuit owned by Sushmitha, shared into a chat by Nani (the
    // "sender"): the function only ever sees the pursuit row and the
    // owner's own profile lookup — there is no sender parameter at all, so
    // there's no field for "Nani" to end up in by mistake.
    const pursuitRow = { id: "p1", title: "Learning pottery", user_id: "owner-sush" };
    const preview = buildSharedPursuitPreview(pursuitRow, "Sushmitha", null);
    expect(preview.ownerName).not.toBe("Nani");
    expect(preview.ownerId).not.toBe("nani-id");
  });

  it("falls back to 'Someone' when the owner has no display name", () => {
    const preview = buildSharedPursuitPreview({ id: "p1", title: "x", user_id: "u1" }, null, null);
    expect(preview.ownerName).toBe("Someone");
  });

  it("falls back to 'Someone' for a blank display name too", () => {
    const preview = buildSharedPursuitPreview({ id: "p1", title: "x", user_id: "u1" }, "   ", null);
    expect(preview.ownerName).toBe("Someone");
  });

  it("passes the cover image through untouched, including null", () => {
    const withCover = buildSharedPursuitPreview({ id: "p1", title: "x", user_id: "u1" }, "Sush", "https://x/cover.jpg");
    expect(withCover.coverImage).toBe("https://x/cover.jpg");

    const withoutCover = buildSharedPursuitPreview({ id: "p1", title: "x", user_id: "u1" }, "Sush", null);
    expect(withoutCover.coverImage).toBeNull();
  });
});
