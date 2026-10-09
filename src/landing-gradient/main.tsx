/**
 * The landing page's live gradient, built as its own bundle (see
 * vite.gradient.config.ts) and loaded at runtime by the signed-out landing
 * page only. Nothing in the app imports this file, so three.js and
 * ShaderGradient never reach the signed-in bundle.
 *
 * It has its own React root. The host page talks to it through the small
 * handle `mount` returns.
 */
import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useThree, useFrame } from "@react-three/fiber";
import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";

export interface GradientHandle {
  setPaused: (paused: boolean) => void;
  destroy: () => void;
}

/** Stops the render loop entirely while paused, and says when frames flow. */
function Loop({ paused, onReady }: { paused: boolean; onReady: () => void }) {
  const setFrameloop = useThree((s) => s.setFrameloop);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    setFrameloop(paused ? "never" : "always");
    if (!paused) invalidate();
  }, [paused, setFrameloop, invalidate]);
  let frames = 0;
  useFrame(() => {
    frames += 1;
    if (frames === 3) onReady();
  });
  return null;
}

function Gradient({ paused, onReady }: { paused: boolean; onReady: () => void }) {
  return (
    <ShaderGradientCanvas
      style={{ position: "absolute", inset: 0 }}
      pixelDensity={1}
      fov={45}
      pointerEvents="none"
      lazyLoad={false}
    >
      <Loop paused={paused} onReady={onReady} />
      <ShaderGradient
        control="props"
        type="waterPlane"
        animate="on"
        uTime={0}
        uSpeed={0.06}
        uStrength={1.4}
        uDensity={1.2}
        uFrequency={0}
        uAmplitude={0}
        positionX={0}
        positionY={0}
        positionZ={0}
        rotationX={50}
        rotationY={0}
        rotationZ={-60}
        // design-token-ignore: shader colors are handed to WebGL, not CSS. Same palette as --lp-peach and --lp-sun in theme.css.
        color1="#F3A98C"
        color2="#EE9A78" /* design-token-ignore: terracotta-peach, shader input */
        color3="#F2D58A" /* design-token-ignore: shader input */
        reflection={0.1}
        lightType="3d"
        brightness={1.3}
        grain="off"
        cAzimuthAngle={180}
        cPolarAngle={80}
        cDistance={2.8}
        cameraZoom={9.1}
      />
    </ShaderGradientCanvas>
  );
}

export function mount(el: HTMLElement, onReady: () => void): GradientHandle {
  const root = createRoot(el);
  const render = (paused: boolean) => root.render(<Gradient paused={paused} onReady={onReady} />);
  render(false);
  return {
    setPaused: render,
    destroy: () => root.unmount(),
  };
}
