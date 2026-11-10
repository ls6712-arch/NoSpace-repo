// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MomentTestState } from "./testSupport";

const ctx = vi.hoisted(() => ({ user: { id: "me" } }) as MomentTestState);
vi.mock("../../../lib/supabase", () => ({ supabase: null }));
vi.mock("../../context/AuthContext", async () => (await import("./testSupport")).authMock(ctx));
vi.mock("../../context/ContentContext", async () => (await import("./testSupport")).contentMock(ctx));
vi.mock("../../context/SocialContext", async () => (await import("./testSupport")).socialMock(ctx));
vi.mock("../../context/PrivateLogsContext", async () => (await import("./testSupport")).privateLogsMock());
vi.mock("../../context/CornersContext", async () => (await import("./testSupport")).cornersMock());
vi.mock("../../lib/bookmarksRemote", () => ({ syncBookmark: vi.fn(async () => undefined) }));

import { Moment } from "./Moment";
import { testPost } from "./testSupport";
import { seedFollowGraph } from "./useFollowState";
import { takeThoughtsIntent } from "./thoughtsIntent";

const show = (post = testPost(), onOpen = vi.fn()) =>
  render(
    <MemoryRouter>
      <Moment post={post} onOpen={onOpen} />
    </MemoryRouter>,
  );

beforeEach(() => {
  ctx.user = { id: "me" };
  ctx.posts = [];
  ctx.reactions = {};
  ctx.thoughts = {};
  ctx.toggleReaction = vi.fn();
  seedFollowGraph({ userId: "me" });
});
afterEach(cleanup);

describe("one Moment", () => {
  it("has the header, media, icon row and caption, and no button with words but Follow", () => {
    show();
    expect(document.querySelector("[data-moment-header]")).toBeTruthy();
    expect(document.querySelector("[data-moment-media]")).toBeTruthy();
    expect(document.querySelector("[data-moment-actions]")).toBeTruthy();
    const worded = screen.getAllByRole("button").map((b) => b.textContent).filter(Boolean);
    expect(worded).toEqual(["Follow"]);
  });

  it("writes one meta line: the Corner (a link), the place, when", () => {
    show(testPost({ city: "Brooklyn", createdAt: Date.now() - 3 * 60 * 60 * 1000 }));
    expect(document.querySelector("[data-moment-meta]")!.textContent).toBe("Cooking · Brooklyn · 3h");
    expect(screen.getByRole("link", { name: "Cooking" }).getAttribute("href")).toBe("/corners/cooking");
  });

  it("links the name to the profile", () => {
    show();
    expect(screen.getByRole("link", { name: "Priya" }).getAttribute("href")).toBe("/u/u-priya");
  });

  it("says Follow, Follow back or Requested, and nothing once you follow them", () => {
    show();
    expect(screen.getByRole("button", { name: "Follow" })).toBeTruthy();
    cleanup();
    seedFollowGraph({ userId: "me", followers: ["u-priya"] });
    show();
    expect(screen.getByRole("button", { name: "Follow back" })).toBeTruthy();
    cleanup();
    seedFollowGraph({ userId: "me", requested: ["u-priya"] });
    show();
    expect((screen.getByRole("button", { name: "Requested" }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    seedFollowGraph({ userId: "me", following: ["u-priya"] });
    show();
    expect(screen.queryByRole("button", { name: /^(Follow|Follow back|Requested)$/ })).toBeNull();
  });

  it("on your own Moment: no Follow, and who sees it at the end of the meta line", () => {
    show(testPost({ userId: "me", visibility: "followers" }));
    expect(screen.queryByRole("button", { name: /^Follow/ })).toBeNull();
    const audience = screen.getByRole("button", { name: "Change who sees this. Followers" });
    expect(audience.textContent).toBe("Followers");
    fireEvent.click(audience);
    expect(screen.getByText("Who sees this")).toBeTruthy();
  });

  it("does nothing on a single tap of the photo, and loves it on a double tap", () => {
    const onOpen = vi.fn();
    show(testPost(), onOpen);
    const media = document.querySelector<HTMLElement>("[data-moment-media]")!;
    fireEvent.click(media);
    expect(onOpen).not.toHaveBeenCalled();
    expect(ctx.toggleReaction).not.toHaveBeenCalled();
    fireEvent.click(media);
    expect(ctx.toggleReaction).toHaveBeenCalledWith(1, "love");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("never un-loves on a double tap", () => {
    ctx.reactions = { 1: ["love"] };
    show();
    const media = document.querySelector<HTMLElement>("[data-moment-media]")!;
    fireEvent.click(media);
    fireEvent.click(media);
    expect(ctx.toggleReaction).not.toHaveBeenCalled();
  });

  it("shows See thoughts only when there are any, and opens the Moment at them", () => {
    show();
    expect(screen.queryByRole("button", { name: "See thoughts" })).toBeNull();
    cleanup();
    ctx.thoughts = { 1: [{ id: 1, postId: 1, createdAt: 1 }] };
    const onOpen = vi.fn();
    show(testPost(), onOpen);
    fireEvent.click(screen.getByRole("button", { name: "See thoughts" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(takeThoughtsIntent(1)).toBe(true);
    expect(takeThoughtsIntent(1)).toBe(false);
  });

  it("sets a text-only Moment's words into its tile and does not repeat them below", () => {
    show(testPost({ type: "written", media: "", caption: "Wedged twenty pounds tonight." }));
    expect(document.querySelector('[data-moment-media="words"]')!.textContent).toBe("Wedged twenty pounds tonight.");
    expect(document.querySelector("[data-moment-caption]")).toBeNull();
  });
});
