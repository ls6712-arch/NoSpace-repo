// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageWithFallback } from "./ImageWithFallback";
afterEach(cleanup);

describe("explicit responsive image recovery", () => {
  it("retries the source without a broken candidate before reporting total failure", () => {
    const fail = vi.fn();
    render(<ImageWithFallback src="/original.webp" srcSet="/small.webp 400w, /large.webp 1600w" alt="Reading" onFail={fail}/>);
    const image = screen.getByRole("img");
    fireEvent.error(image);
    expect(image.getAttribute("src")).toBe("/original.webp");
    expect(image.getAttribute("srcset")).toBeNull();
    expect(fail).not.toHaveBeenCalled();
    fireEvent.load(image);
    expect(image.className).toContain("opacity-100");
    fireEvent.error(image);
    expect(fail).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("img", { name: "Reading" }).tagName).toBe("SPAN");
  });

  it("recovers from a failed image when its source changes", () => {
    const { rerender } = render(<ImageWithFallback src="/old.webp" srcSet="/old-small.webp 400w" alt="Old"/>);
    fireEvent.error(screen.getByRole("img"));
    fireEvent.error(screen.getByRole("img"));
    rerender(<ImageWithFallback src="/new.webp" srcSet="/new-small.webp 400w" alt="New"/>);
    const image = screen.getByRole("img", { name: "New" });
    expect(image.tagName).toBe("IMG");
    expect(image.getAttribute("srcset")).toContain("new-small");
  });
});
