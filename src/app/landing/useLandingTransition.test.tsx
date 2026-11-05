// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLandingTransition } from "./useLandingTransition";
const motion = vi.hoisted(() => ({ enabled: true, cancel: vi.fn(), animate: vi.fn() }));
vi.mock("./LandingMotion", () => ({ useLandingMotion: () => motion }));
vi.mock("motion/mini", () => ({ animate: (...args: unknown[]) => { motion.animate(...args); return { cancel: motion.cancel }; } }));
function Example({ identity }: { identity: string }) { const ref = useLandingTransition(identity); return <div ref={ref}>Example content</div>; }
afterEach(() => { cleanup(); motion.enabled = true; vi.clearAllMocks(); });

describe("landing Motion transitions", () => {
  it("stops and resets an in-flight transition when the page is paused", () => {
    const { rerender, container } = render(<Example identity="first"/>);
    expect(motion.animate).toHaveBeenCalledTimes(1);
    const element = container.firstElementChild as HTMLElement;
    element.style.opacity = "0.4"; element.style.transform = "translateY(8px)";
    motion.enabled = false;
    rerender(<Example identity="second"/>);
    expect(motion.cancel).toHaveBeenCalledTimes(1);
    expect(motion.animate).toHaveBeenCalledTimes(1);
    expect(element.style.opacity).toBe("1");
    expect(element.style.transform).toBe("none");
  });
  it("never starts a transition while motion is disabled and cleans up on unmount", () => {
    motion.enabled = false;
    const { rerender, unmount } = render(<Example identity="first"/>);
    expect(motion.animate).not.toHaveBeenCalled();
    motion.enabled = true;
    rerender(<Example identity="first"/>);
    expect(motion.animate).toHaveBeenCalledTimes(1);
    unmount();
    expect(motion.cancel).toHaveBeenCalledTimes(1);
  });
});
