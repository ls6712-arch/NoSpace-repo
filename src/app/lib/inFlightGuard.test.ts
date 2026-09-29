import { describe, expect, it, vi } from "vitest";
import { InFlightGuard, isInFlightSkipped } from "./inFlightGuard";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("InFlightGuard", () => {
  it("runs a single call normally and returns its value", async () => {
    const guard = new InFlightGuard();
    const result = await guard.run(async () => "ok");
    expect(result).toBe("ok");
  });

  it("two concurrent calls produce exactly one execution and one silent skip", async () => {
    const insert = vi.fn();
    const first = deferred<{ id: number }>();
    insert.mockImplementationOnce(() => first.promise);

    const guard = new InFlightGuard();
    const call1 = guard.run(() => insert());
    // The first call is still in flight (its promise hasn't resolved yet)
    // when the second one arrives — the exact shape of the reported bug.
    const call2 = guard.run(() => insert());

    first.resolve({ id: 1 });
    const [result1, result2] = await Promise.all([call1, call2]);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(result1).toEqual({ id: 1 });
    expect(isInFlightSkipped(result2)).toBe(true);
    // The skip is silent by design — nothing in its shape is an error, and
    // nothing about it looks like one to a caller checking `instanceof
    // Error` or a truthy `.error` field.
    expect(result2 instanceof Error).toBe(false);
  });

  it("lets a later call through once the in-flight one has finished", async () => {
    const guard = new InFlightGuard();
    const first = await guard.run(async () => "first");
    const second = await guard.run(async () => "second");
    expect(first).toBe("first");
    expect(second).toBe("second");
  });

  it("clears the busy flag even when the wrapped call throws", async () => {
    const guard = new InFlightGuard();
    await expect(
      guard.run(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const after = await guard.run(async () => "recovered");
    expect(after).toBe("recovered");
  });
});
