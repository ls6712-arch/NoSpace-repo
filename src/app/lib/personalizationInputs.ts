import { readPreferenceBundle, readPersonalization } from "./personalizationRemote";
import { fetchCapability } from "./capabilityProfileRemote";
import { emptyCapability } from "./capabilityProfile";
import { emptyPersonalization, normalizePersonalization, humanOnboardingEnabled } from "./personalization";
import type { Pass } from "./tasteModel";
import type { Taste } from "./tasteRemote";
/** Read-only consumers may continue with unknown preferences; editable forms use explicit read states. */
export async function personalizationInputs(userId: string, taste: Taste, passes: readonly Pass[] = []) {
  if(humanOnboardingEnabled){
    try{
      const saved=await readPreferenceBundle(userId);
      const value=normalizePersonalization({picks:saved.taste.picks,windows:saved.taste.windows,monthlyBudget:saved.taste.budget,passes:saved.passes,legacyMotivations:saved.taste.legacyMotivations},saved.value,saved.capability.equipment,saved.capability.perActivityBudget);
      return {value,equipment:value.equipment,perActivityBudget:saved.capability.perActivityBudget,timeZone:saved.capability.timeZone};
    }catch{/* Read-only surfaces fall back to the legacy answers without allowing edits. */}
  }
  const [saved, capability] = await Promise.all([readPersonalization(userId),fetchCapability(undefined,userId).catch(()=>emptyCapability())]);
  const value = saved.status === "ready" || saved.status === "missing" ? saved.value : emptyPersonalization();
  const normalized=normalizePersonalization({picks:taste.picks,windows:taste.windows,monthlyBudget:taste.budget,passes},value,capability.equipment,capability.perActivityBudget);
  return { value:normalized,equipment:normalized.equipment,
    perActivityBudget:capability.perActivityBudget,timeZone:capability.timeZone };
}
