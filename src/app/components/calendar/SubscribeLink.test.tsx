// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => auth.value }));
const feed = vi.hoisted(() => ({
  status: "none" as "none" | "active" | "unavailable",
  local: null as string | null,
  fetchFeedStatus: vi.fn(async (_u: string) => feed.status),
  resetFeedLink: vi.fn(async (_u: string): Promise<{ url?: string; error?: string }> => ({ url: "https://abc.supabase.co/functions/v1/calendar-feed?token=NEW" })),
}));
vi.mock("../../lib/calendarFeed", async (orig) => ({
  ...(await orig<typeof import("../../lib/calendarFeed")>()),
  fetchFeedStatus: feed.fetchFeedStatus,
  resetFeedLink: feed.resetFeedLink,
  localToken: () => feed.local,
  feedUrl: (t: string) => `https://abc.supabase.co/functions/v1/calendar-feed?token=${t}`,
}));
const toasts = vi.hoisted(() => ({ ok: [] as string[], err: [] as string[] }));
vi.mock("../ui/toaster", () => ({ notify: (m: string) => toasts.ok.push(m), notifyError: (m: string) => toasts.err.push(m) }));

import { SubscribeCard } from "./SubscribeLink";

const write = vi.fn(async (_t: string) => undefined);
const flush = () => act(async () => void (await Promise.resolve()));
const show = async () => {
  render(<SubscribeCard />);
  await flush();
  await flush();
};

beforeEach(() => {
  auth.value = { user: { id: "u1" } };
  feed.status = "none";
  feed.local = null;
  feed.fetchFeedStatus.mockClear();
  feed.resetFeedLink.mockClear();
  toasts.ok.length = 0;
  toasts.err.length = 0;
  write.mockClear();
  Object.defineProperty(navigator, "clipboard", { value: { writeText: write }, configurable: true });
});
afterEach(cleanup);

describe("Your calendars", () => {
  it("is out of sight until the link can be made, and when signed out", async () => {
    feed.status = "unavailable";
    await show();
    expect(screen.queryByText("Your calendars")).toBeNull();
    cleanup();
    feed.status = "none";
    auth.value = { user: null };
    await show();
    expect(screen.queryByText("Your calendars")).toBeNull();
  });

  it("says what it is for, with one button to start", async () => {
    await show();
    expect(screen.getByRole("heading", { name: "Your calendars" })).toBeTruthy();
    expect(screen.getByText("Soosh in your calendar")).toBeTruthy();
    expect(screen.getByText("Your plans appear in Google, Apple or Outlook.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy subscribe link" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset link" })).toBeNull();
  });

  it("makes the first link, copies it, says so, and then offers Reset link", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Copy subscribe link" }));
    await flush();
    await flush();
    expect(feed.resetFeedLink).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("https://abc.supabase.co/functions/v1/calendar-feed?token=NEW");
    expect(toasts.ok).toEqual(["Link copied"]);
    expect(screen.getByRole("button", { name: "Reset link" })).toBeTruthy();
    expect(screen.getByText("Resetting stops the old link working.")).toBeTruthy();
  });

  it("copies the link this browser already has, without making another", async () => {
    feed.status = "active";
    feed.local = "T".repeat(43);
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Copy subscribe link" }));
    await flush();
    expect(feed.resetFeedLink).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith(`https://abc.supabase.co/functions/v1/calendar-feed?token=${"T".repeat(43)}`);
  });

  it("on a device without the link, offers only Reset link, and never quietly resets", async () => {
    feed.status = "active";
    feed.local = null;
    await show();
    expect(screen.queryByRole("button", { name: "Copy subscribe link" })).toBeNull();
    expect(screen.getByText("This device doesn’t have your link. Reset it to get a new one.")).toBeTruthy();
    expect(feed.resetFeedLink).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reset link" }));
    await flush();
    await flush();
    expect(feed.resetFeedLink).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Copy subscribe link" })).toBeTruthy();
  });

  it("makes a new link on Reset link and copies that one", async () => {
    feed.status = "active";
    feed.local = "T".repeat(43);
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Reset link" }));
    await flush();
    await flush();
    expect(feed.resetFeedLink).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("https://abc.supabase.co/functions/v1/calendar-feed?token=NEW");
  });

  it("says so when the link cannot be made, and copies nothing", async () => {
    feed.resetFeedLink.mockResolvedValueOnce({ error: "Something went wrong. Try again." });
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Copy subscribe link" }));
    await flush();
    await flush();
    expect(toasts.err).toEqual(["Something went wrong. Try again."]);
    expect(write).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Reset link" })).toBeNull();
  });

  it("says so when the clipboard is not allowed", async () => {
    feed.status = "active";
    feed.local = "T".repeat(43);
    write.mockRejectedValueOnce(new Error("denied"));
    document.execCommand = vi.fn(() => false);
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Copy subscribe link" }));
    await flush();
    await flush();
    expect(toasts.ok).toEqual([]);
    expect(toasts.err).toHaveLength(1);
  });
});
