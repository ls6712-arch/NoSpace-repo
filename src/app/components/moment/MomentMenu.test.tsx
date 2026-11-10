// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MomentTestState } from "./testSupport";

const ctx = vi.hoisted(() => ({ user: { id: "me" } }) as MomentTestState);
vi.mock("../../../lib/supabase", () => ({ supabase: null }));
vi.mock("../../context/AuthContext", async () => (await import("./testSupport")).authMock(ctx));
vi.mock("../../context/ContentContext", async () => (await import("./testSupport")).contentMock(ctx));
vi.mock("../../context/SocialContext", async () => (await import("./testSupport")).socialMock(ctx));
vi.mock("../../context/PrivateLogsContext", async () => (await import("./testSupport")).privateLogsMock());
vi.mock("../../context/CornersContext", async () => (await import("./testSupport")).cornersMock());

import { MomentMenu, momentMenuItems } from "./MomentMenu";
import { testPost } from "./testSupport";

afterEach(cleanup);

const labels = (args: Parameters<typeof momentMenuItems>[0]) => momentMenuItems(args).map((i) => i.label);

describe("the ⋯ menu's one list", () => {
  it("on someone else's Moment: message them, copy the link, report", () => {
    expect(labels({ post: testPost({ creator: "SPD" }), mine: false, inPursuit: false })).toEqual(["Message SPD about this", "Copy link", "Report"]);
  });

  it("on your own Moment: details, Pursuit, audience, link, delete", () => {
    expect(labels({ post: testPost({ userId: "me" }), mine: true, inPursuit: false })).toEqual(["Add details", "Add to Pursuit", "Change who sees this", "Copy link", "Delete"]);
  });

  it("says Move to another Pursuit once your Moment is in one", () => {
    expect(labels({ post: testPost({ userId: "me" }), mine: true, inPursuit: true })[1]).toBe("Move to another Pursuit");
  });

  it("never mixes the two lists", () => {
    const theirs = labels({ post: testPost(), mine: false, inPursuit: false });
    const own = labels({ post: testPost({ userId: "me" }), mine: true, inPursuit: false });
    for (const l of ["Add details", "Add to Pursuit", "Change who sees this", "Delete"]) expect(theirs).not.toContain(l);
    for (const l of ["Report", "Message Priya about this"]) expect(own).not.toContain(l);
  });

  it("offers no link for an Only you Moment, which nobody else could open", () => {
    expect(labels({ post: testPost({ userId: "me", visibility: "just_me" }), mine: true, inPursuit: false })).toEqual(["Add details", "Add to Pursuit", "Change who sees this", "Delete"]);
  });

  it("has no audience or link on a private-log stand-in", () => {
    expect(labels({ post: testPost({ isPrivateLog: true, visibility: "private" }), mine: true, inPursuit: false })).toEqual(["Add details", "Add to Pursuit", "Delete"]);
  });

  it("has only Copy link when there is no account behind the Moment", () => {
    expect(labels({ post: testPost({ userId: undefined }), mine: false, inPursuit: false })).toEqual(["Copy link"]);
  });

  it("marks only Report and Delete as strong", () => {
    const strong = (mine: boolean) => momentMenuItems({ post: testPost(), mine, inPursuit: false }).filter((i) => i.strong).map((i) => i.label);
    expect(strong(false)).toEqual(["Report"]);
    expect(strong(true)).toEqual(["Delete"]);
  });
});

describe("MomentMenu", () => {
  const open = (mine: boolean) => {
    render(
      <MemoryRouter>
        <MomentMenu post={testPost(mine ? { userId: "me", creator: "Me" } : { creator: "SPD" })} mine={mine} audienceOpen={false} onAudienceOpenChange={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    return within(screen.getByRole("menu", { name: "More" })).getAllByRole("menuitem").map((b) => b.textContent);
  };

  it("opens someone else's list from the More button", () => {
    expect(open(false)).toEqual(["Message SPD about this", "Copy link", "Report"]);
  });

  it("opens your own list from the More button", () => {
    expect(open(true)).toEqual(["Add details", "Add to Pursuit", "Change who sees this", "Copy link", "Delete"]);
  });

  it("asks before deleting", () => {
    open(true);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(screen.getByText("Delete this Moment?")).toBeTruthy();
  });

  it("opens Change who sees this through the header's own state", () => {
    const onAudienceOpenChange = vi.fn();
    render(
      <MemoryRouter>
        <MomentMenu post={testPost({ userId: "me" })} mine audienceOpen={false} onAudienceOpenChange={onAudienceOpenChange} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Change who sees this" }));
    expect(onAudienceOpenChange).toHaveBeenCalledWith(true);
  });
});
