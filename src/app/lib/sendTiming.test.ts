// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SEND_MS, recordSendMs, typicalSendMs, waitForTypicalSend } from "./sendTiming";

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("typicalSendMs", () => {
  it("is one second until a real send has been seen", () => {
    expect(typicalSendMs()).toBe(DEFAULT_SEND_MS);
  });

  it("is the median of the last few real sends", () => {
    [800, 1200, 5000].forEach(recordSendMs);
    expect(typicalSendMs()).toBe(1200);
  });

  it("stays between 0.4 and 4 seconds", () => {
    recordSendMs(20);
    expect(typicalSendMs()).toBe(400);
    sessionStorage.clear();
    [9000, 9000, 9000].forEach(recordSendMs);
    expect(typicalSendMs()).toBe(4000);
  });
});

describe("waitForTypicalSend", () => {
  it("holds a fast refusal until a typical send would have finished", async () => {
    recordSendMs(1500);
    let done = false;
    void waitForTypicalSend(Date.now()).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1400);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(done).toBe(true);
  });

  it("does not wait again when the call already took that long", async () => {
    recordSendMs(1000);
    let done = false;
    void waitForTypicalSend(Date.now() - 2000).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });
});
