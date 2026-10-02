import { afterEach, describe, expect, it, vi } from "vitest";
import { friendlyError } from "./friendlyError";
import { ERROR_LINE, OFFLINE_LINE, UPLOAD_COPY } from "./stateCopy";

describe("friendlyError", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never passes raw database text through", () => {
    const pg = { message: 'new row violates row-level security policy for table "space_moments"', code: "42501" };
    expect(friendlyError(pg)).toBe(ERROR_LINE);
    expect(friendlyError(new Error('duplicate key value violates unique constraint "x_pkey"'))).toBe(ERROR_LINE);
    expect(friendlyError("relation public.foo does not exist")).toBe(ERROR_LINE);
  });

  it("uses the caller's fallback for unknown errors", () => {
    expect(friendlyError({ message: "boom" }, "Couldn’t add that Moment.")).toBe("Couldn’t add that Moment.");
  });

  it("maps network failures to the offline line", () => {
    expect(friendlyError(new TypeError("Failed to fetch"))).toBe(OFFLINE_LINE);
    expect(friendlyError({ message: "TypeError: Load failed" })).toBe(OFFLINE_LINE);
  });

  it("says offline whenever the browser is offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(friendlyError({ message: "anything" })).toBe(OFFLINE_LINE);
  });

  it("explains upload size and type failures", () => {
    expect(friendlyError({ statusCode: "413", message: "Payload too large" })).toBe(UPLOAD_COPY.tooBig());
    expect(friendlyError({ message: "mime type image/heic is not supported" })).toBe(UPLOAD_COPY.wrongType);
  });

  it("handles empty input", () => {
    expect(friendlyError(undefined)).toBe(ERROR_LINE);
    expect(friendlyError(null)).toBe(ERROR_LINE);
  });
});
