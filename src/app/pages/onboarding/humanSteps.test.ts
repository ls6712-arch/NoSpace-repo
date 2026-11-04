import { afterEach, expect, it, vi } from "vitest";
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules();});
it("puts the human questions and summary before useful suggestions, then photos and invites",async()=>{
 vi.stubEnv("VITE_HUMAN_ONBOARDING","true");vi.resetModules();
 const {ONBOARDING_STEPS,COUNTED_STEPS,nextStep,resolveStep,backTarget}=await import("./steps");
 expect(COUNTED_STEPS).toEqual(["yours","picks","free"]);
 expect(ONBOARDING_STEPS.indexOf("plan")).toBeLessThan(ONBOARDING_STEPS.indexOf("card"));
 expect(nextStep("birthday")).toBe("yours");expect(nextStep("free")).toBe("review");
 expect(resolveStep(null,"where",true)).toBe("yours");expect(backTarget("free",true)).toBe("picks");
 expect(resolveStep("review",null,false)).toBe("code");
});
