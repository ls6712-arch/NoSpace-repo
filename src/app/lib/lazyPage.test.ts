// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "./lazyPage";

const Thing = () => null;
const reload = vi.fn();

beforeEach(() => {
  sessionStorage.clear();
  reload.mockClear();
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
});
afterEach(() => vi.restoreAllMocks());

describe("page", () => {
  it("returns the named export as the route component", async () => {
    expect(await page(async () => ({ Thing }), "Thing")()).toEqual({ Component: Thing });
  });

  it("reloads once when the chunk cannot be fetched", async () => {
    const p = page(() => Promise.reject(new Error("Failed to fetch")), "Thing" as never)();
    const settled = vi.fn();
    void p.then(settled, settled);
    await Promise.resolve();
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(settled).not.toHaveBeenCalled();
  });

  it("throws on a second failure within a minute instead of looping", async () => {
    sessionStorage.setItem("soosh.chunkReload", String(Date.now()));
    await expect(page(() => Promise.reject(new Error("Failed to fetch")), "Thing" as never)()).rejects.toThrow("Failed to fetch");
    expect(reload).not.toHaveBeenCalled();
  });
});
