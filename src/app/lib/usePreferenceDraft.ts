import { useEffect, useRef, useState } from "react";
import { emptyPersonalization, normalizePersonalization, type Personalization } from "./personalization";
import { emptyCapability } from "./capabilityProfile";
import { readPreferenceBundle, savePersonalization } from "./personalizationRemote";
import { fetchPasses, fetchTaste, EMPTY_TASTE } from "./tasteRemote";

/** An editable form never turns a failed read into an empty account. Key forms by userId. */
export function usePreferenceDraft(userId?: string) {
  const [value,setValue]=useState(emptyPersonalization);
  const [capability,setCapability]=useState(emptyCapability);
  const [status,setStatus]=useState<"loading"|"ready"|"failed">("loading");
  const [error,setError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [reloadKey,reload]=useState(0);
  const revision=useRef(0);
  const saving=useRef(false);
  const owner=useRef(userId); owner.current=userId;
  useEffect(()=>{
    let live=true;
    setStatus("loading");setError(null);setValue(emptyPersonalization());setCapability(emptyCapability());
    if(!userId){setStatus("failed");setError("Log in to save your preferences.");return;}
    void Promise.all([readPreferenceBundle(userId),fetchTaste(userId,{strict:true}),fetchPasses(userId,{strict:true})])
      .then(([saved,taste,passes])=>{
        if(!live)return;
        revision.current=saved.revision;
        const normalized=normalizePersonalization(taste ? {picks:taste.picks,windows:taste.windows,monthlyBudget:taste.budget,passes}: {picks:EMPTY_TASTE.picks,windows:[],monthlyBudget:null,passes:[]},saved.value,saved.capability.equipment,saved.capability.perActivityBudget);
        setValue({...saved.value,interests:normalized.interests});
        setCapability({...saved.capability,equipment:normalized.equipment});setStatus("ready");
      }).catch(e=>{if(live){setError(e instanceof Error?e.message:"Your preferences couldn’t load.");setStatus("failed");}});
    return()=>{live=false;};
  },[userId,reloadKey]);
  const save=async(changes:Parameters<typeof savePersonalization>[2])=>{
    if(!userId || status!=="ready" || saving.current)return false;
    const expected=userId;saving.current=true;setBusy(true);setError(null);
    try {
      const result=await savePersonalization(expected,revision.current,changes);
      if(owner.current!==expected)return false;
      revision.current=result.revision;setValue(result.value);
      if(changes.capability)setCapability(changes.capability);
      return true;
    } catch(e){if(owner.current===expected)setError(e instanceof Error?e.message:"Your changes weren’t saved.");return false;}
    finally {saving.current=false;if(owner.current===expected)setBusy(false);}
  };
  return {value,setValue,capability,setCapability,status,error,busy,save,reload:()=>reload(k=>k+1)};
}
export type PreferenceDraft=ReturnType<typeof usePreferenceDraft>;
export type PreferenceQuestion="motivations"|"interests"|"rhythm";
export type PreferencePatch=Partial<Pick<Personalization,"motivations"|"interests"|"rhythm"|"durationMax">>;
