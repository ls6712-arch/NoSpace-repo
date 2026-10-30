// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getMomentHold: vi.fn(), releaseMoment: vi.fn() }));
vi.mock("../lib/profileApi", () => api);
const social = vi.hoisted(() => ({
  shareMoment: vi.fn(),
  sharePursuit: vi.fn(),
  blockedIds: [] as string[],
  participations: [{ id: 7, fromUser: "me", toUser: "pal", status: "accepted", kind: "make_together", createdAt: 1 }],
}));
vi.mock("../context/SocialContext", () => ({ useSocial: () => social }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("../lib/messageTabs", () => ({ canAttachInto: () => true }));

import { SendToChatDialog } from "./SendToChatDialog";

const ok = <T,>(value: T) => Promise.resolve({ ok: true as const, value });
const order: string[] = [];

beforeEach(() => {
  order.length = 0;
  api.getMomentHold.mockReset();
  api.releaseMoment.mockReset().mockImplementation(() => {
    order.push("release");
    return ok(null);
  });
  social.shareMoment.mockReset().mockImplementation(() => {
    order.push("share");
    return Promise.resolve({ error: null });
  });
});
afterEach(cleanup);

const open = () =>
  render(
    <MemoryRouter>
      <SendToChatDialog open onOpenChange={() => {}} kind="moment" postId={42} />
    </MemoryRouter>,
  );
const pickChat = () => fireEvent.click(screen.getAllByRole("button").find((b) => b.textContent !== "Done" && !/close/i.test(b.textContent ?? ""))!);

describe("Sharing a held Moment in chat", () => {
  it("asks first, and only after Share now releases it and then shares", async () => {
    api.getMomentHold.mockImplementation(() => ok("2026-10-30T20:00:00Z"));
    open();
    pickChat();
    expect(await screen.findByText("Share now?")).toBeTruthy();
    expect(screen.getByText("Anyone who can see your Moments will see this one too.")).toBeTruthy();
    expect(api.releaseMoment).not.toHaveBeenCalled();
    expect(social.shareMoment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Share now" }));
    await waitFor(() => expect(social.shareMoment).toHaveBeenCalledWith(7, 42));
    expect(api.releaseMoment).toHaveBeenCalledWith(42);
    expect(order).toEqual(["release", "share"]);
  });

  it("shares nothing and releases nothing when you cancel", async () => {
    api.getMomentHold.mockImplementation(() => ok("2026-10-30T20:00:00Z"));
    open();
    pickChat();
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByText("Share now?")).toBeNull());
    expect(api.releaseMoment).not.toHaveBeenCalled();
    expect(social.shareMoment).not.toHaveBeenCalled();
  });

  it("does not share when releasing fails", async () => {
    api.getMomentHold.mockImplementation(() => ok("2026-10-30T20:00:00Z"));
    api.releaseMoment.mockImplementation(() => Promise.resolve({ ok: false, message: "x" }));
    open();
    pickChat();
    fireEvent.click(await screen.findByRole("button", { name: "Share now" }));
    await waitFor(() => expect(api.releaseMoment).toHaveBeenCalled());
    expect(social.shareMoment).not.toHaveBeenCalled();
  });

  it("shares straight away when the Moment is already visible", async () => {
    api.getMomentHold.mockImplementation(() => ok(null));
    open();
    pickChat();
    await waitFor(() => expect(social.shareMoment).toHaveBeenCalledWith(7, 42));
    expect(screen.queryByText("Share now?")).toBeNull();
    expect(api.releaseMoment).not.toHaveBeenCalled();
  });
});
