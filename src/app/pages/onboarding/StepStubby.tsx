import { Stubby } from "../../components/stubby/Stubby";
import { useTheme } from "../../context/ThemeContext";
import { useOnboarding } from "./OnboardingContext";

/** Stubby as the flow drives it: its state comes from the flow, and it takes the light outline in dark mode. */
export function StepStubby({ size = 120, followPointer = false }: { size?: number; followPointer?: boolean }) {
  const { stubby } = useOnboarding();
  const { resolvedTheme } = useTheme();
  return <Stubby state={stubby} size={size} onDark={resolvedTheme === "dark"} followPointer={followPointer} />;
}
