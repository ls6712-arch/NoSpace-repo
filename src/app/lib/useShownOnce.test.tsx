// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useShownOnce } from "./useShownOnce";

type Entry = Partial<IntersectionObserverEntry> & { isIntersecting: boolean; intersectionRatio: number };
let fire: (entries: Entry[]) => void = () => {};

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (entries: Entry[]) => void) {
        fire = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Probe({ onShown }: { onShown: () => void }) {
  const ref = useShownOnce<HTMLDivElement>(onShown);
  return <div ref={ref}>card</div>;
}

describe("useShownOnce", () => {
  it("does nothing under half visible, then fires once at half, and never again", () => {
    const onShown = vi.fn();
    render(<Probe onShown={onShown} />);
    act(() => fire([{ isIntersecting: true, intersectionRatio: 0.3 }]));
    expect(onShown).not.toHaveBeenCalled();
    act(() => fire([{ isIntersecting: true, intersectionRatio: 0.5 }]));
    expect(onShown).toHaveBeenCalledTimes(1);
    act(() => fire([{ isIntersecting: false, intersectionRatio: 0 }]));
    act(() => fire([{ isIntersecting: true, intersectionRatio: 1 }]));
    expect(onShown).toHaveBeenCalledTimes(1);
  });

  it("does not fire when the card is never shown", () => {
    const onShown = vi.fn();
    render(<Probe onShown={onShown} />);
    expect(onShown).not.toHaveBeenCalled();
  });
});
