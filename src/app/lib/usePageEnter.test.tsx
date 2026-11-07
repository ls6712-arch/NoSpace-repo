// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useRef } from "react";
import { PAGE_ENTER_CLASS, usePageEnter } from "./usePageEnter";

function Main({ path }: { path: string }) {
  const ref = useRef<HTMLElement>(null);
  usePageEnter(ref, path);
  return <main ref={ref} data-testid="main" />;
}

afterEach(cleanup);

describe("usePageEnter", () => {
  it("does nothing on first load, then fades in on each page change", () => {
    const { getByTestId, rerender } = render(<Main path="/a" />);
    const main = getByTestId("main");
    expect(main.classList.contains(PAGE_ENTER_CLASS)).toBe(false);
    rerender(<Main path="/b" />);
    expect(main.classList.contains(PAGE_ENTER_CLASS)).toBe(true);
    main.dispatchEvent(new Event("animationend"));
    expect(main.classList.contains(PAGE_ENTER_CLASS)).toBe(false);
  });

  it("does not run again when the page stays the same", () => {
    const { getByTestId, rerender } = render(<Main path="/a" />);
    rerender(<Main path="/a" />);
    expect(getByTestId("main").classList.contains(PAGE_ENTER_CLASS)).toBe(false);
  });
});
