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
vi.mock("../../lib/bookmarksRemote", () => ({ syncBookmark: vi.fn(async () => undefined) }));

import { MomentActions } from "./MomentActions";
import { testPost } from "./testSupport";
import { getSavedIds, replaceSaved } from "../../lib/journal";

const row = () => document.querySelector<HTMLElement>("[data-moment-actions]");
const show = (post = testPost(), mine = false, onThoughts = vi.fn()) =>
  render(
    <MemoryRouter>
      <MomentActions post={post} mine={mine} onThoughts={onThoughts} />
    </MemoryRouter>,
  );

beforeEach(() => {
  ctx.posts = [];
  ctx.ownCounts = {};
  ctx.reactions = {};
  ctx.toggleReaction = vi.fn();
  replaceSaved([]);
});
afterEach(cleanup);

describe("counts on a Moment's icon row", () => {
  const busy = testPost({ loveCount: 12, saveCount: 4 });

  it("shows nobody else a number: no loves, no thoughts, no saves", () => {
    ctx.ownCounts = { 1: { thoughts: 3 } };
    show(busy, false);
    expect(row()!.textContent).toBe("");
    expect(row()!.querySelector("[data-count]")).toBeNull();
    expect(row()!.textContent).not.toMatch(/\d/);
    // And the labels carry none either.
    for (const b of screen.getAllByRole("button")) expect(b.getAttribute("aria-label")).not.toMatch(/\d/);
  });

  it("shows the owner loves, thoughts and saves, each next to its icon", () => {
    ctx.ownCounts = { 1: { thoughts: 3 } };
    show({ ...busy, userId: "me" }, true);
    const text = (kind: string) => row()!.querySelector(`[data-count="${kind}"]`)!.textContent;
    expect(text("loves")).toBe("12");
    expect(text("thoughts")).toBe("3");
    expect(text("saves")).toBe("4");
  });

  it("shows the owner a bare icon for zero, never 0", () => {
    show(testPost({ userId: "me" }), true);
    expect(row()!.textContent).toBe("");
    expect(row()!.querySelectorAll("[data-count]")).toHaveLength(3);
  });

  it("reads the live Moment, so the owner's numbers move without a reload", () => {
    ctx.posts = [testPost({ userId: "me", loveCount: 13, saveCount: 5 })];
    show(testPost({ userId: "me", loveCount: 12, saveCount: 4 }), true);
    expect(row()!.querySelector('[data-count="loves"]')!.textContent).toBe("13");
    expect(row()!.querySelector('[data-count="saves"]')!.textContent).toBe("5");
  });
});

describe("the icon row", () => {
  it("is Love this, Thoughts, Send to, then Save, by their glossary names", () => {
    show();
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Love this", "Thoughts", "Send to", "Save"]);
  });

  it("gives every icon a 44px target", () => {
    show();
    for (const b of screen.getAllByRole("button")) {
      expect(b.className).toContain("h-11");
      expect(b.className).toContain("min-w-11");
    }
  });

  it("loves through the one reaction store, and reads Loved once it is", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Love this" }));
    expect(ctx.toggleReaction).toHaveBeenCalledWith(1, "love");
    cleanup();
    ctx.reactions = { 1: ["love"] };
    show();
    expect(screen.getByRole("button", { name: "Loved" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("saves and unsaves, and reads Saved while it is", () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(getSavedIds()).toEqual([1]);
    fireEvent.click(screen.getByRole("button", { name: "Saved" }));
    expect(getSavedIds()).toEqual([]);
  });

  it("opens the Moment at its thoughts", () => {
    const onThoughts = vi.fn();
    show(testPost(), false, onThoughts);
    fireEvent.click(screen.getByRole("button", { name: "Thoughts" }));
    expect(onThoughts).toHaveBeenCalledTimes(1);
  });

  it("has no Send to on an Only you Moment, and no row at all on your own", () => {
    show(testPost({ visibility: "just_me" }), false);
    expect(screen.queryByRole("button", { name: "Send to" })).toBeNull();
    cleanup();
    show(testPost({ userId: "me", visibility: "just_me" }), true);
    expect(row()).toBeNull();
  });

  it("lets the owner send their Moment and open its thoughts, but not love or save it", () => {
    show(testPost({ userId: "me" }), true);
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Thoughts, 0", "Send to"]);
  });

  it("has no action pill: every control is an icon with no words", () => {
    show();
    for (const b of screen.getAllByRole("button")) expect(b.textContent).toBe("");
  });
});
