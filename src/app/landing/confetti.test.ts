// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { burstFromElement } from "./confetti";

type Fake = { onfinish: null | (() => void); oncancel: null | (() => void) };

function stubAnimate() {
  const anims: Fake[] = [];
  (HTMLElement.prototype as unknown as { animate: unknown }).animate = vi.fn(() => {
    const a: Fake = { onfinish: null, oncancel: null };
    anims.push(a);
    return a;
  });
  return anims;
}

afterEach(() => {
  document.body.innerHTML = "";
  delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate;
  vi.restoreAllMocks();
});

const noReduce = () => vi.stubGlobal("matchMedia", () => ({ matches: false }));

describe("burstFromElement", () => {
  it("throws pieces into one fixed layer and removes every node when they finish", () => {
    noReduce();
    const anims = stubAnimate();
    const el = document.createElement("div");
    document.body.appendChild(el);
    burstFromElement(el, 12);
    const layers = Array.from(document.body.children).filter((c) => c !== el);
    expect(layers).toHaveLength(1);
    expect(layers[0].childElementCount).toBe(12);
    anims.forEach((a) => a.onfinish?.());
    expect(Array.from(document.body.children)).toEqual([el]);
  });

  it("also cleans up a cancelled piece", () => {
    noReduce();
    const anims = stubAnimate();
    const el = document.createElement("div");
    document.body.appendChild(el);
    burstFromElement(el, 3);
    anims.forEach((a) => a.oncancel?.());
    expect(Array.from(document.body.children)).toEqual([el]);
  });

  it("does nothing under reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    stubAnimate();
    const el = document.createElement("div");
    document.body.appendChild(el);
    burstFromElement(el, 12);
    expect(Array.from(document.body.children)).toEqual([el]);
  });
});
