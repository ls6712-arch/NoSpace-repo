import { Stubby } from "../../components/stubby/Stubby";
import { useOnboarding } from "./OnboardingContext";

/** Stubby as the flow drives it: its state comes from the flow, and it goes dark on cobalt and navy. */
export function StepStubby({ size = 120, followPointer = false }: { size?: number; followPointer?: boolean }) {
  const { stubby, tone } = useOnboarding();
  return <Stubby state={stubby} size={size} onDark={tone !== "platform"} followPointer={followPointer} />;
}
