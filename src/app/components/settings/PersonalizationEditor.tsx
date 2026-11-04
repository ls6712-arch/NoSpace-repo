import { TimeGrid } from "../onboarding/TimeGrid";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { usePreferenceDraft } from "../../lib/usePreferenceDraft";
import { savePrivate } from "../../lib/onboardingRemote";
import type { Plan } from "../../lib/firstPlan";
import { activityFor } from "../../../../supabase/functions/_shared/activityFit";
import { PreferenceFields, QUESTION_TITLES } from "./PreferenceFields";
import { Button } from "../ui/button";

export function PersonalizationEditor(){
 const {user}=useAuth();if(!user || user.is_anonymous)return null;
 return <Editor key={user.id} userId={user.id}/>;
}
function Editor({userId}:{userId:string}){
 const draft=usePreferenceDraft(userId);const [saved,setSaved]=useState(false);
 return <details className="rounded-control border border-border p-4"><summary className="min-h-11 cursor-pointer font-semibold">Your preferences</summary>
  <p className="mb-4 text-small text-muted-foreground">Private, and always editable. Skip keeps your answers. Remove an answer and save to clear it.</p>
  {draft.error && <p role="alert">{draft.error}</p>}
  {draft.status==="loading" && <p role="status">Loading your preferences…</p>}
  <button className="min-h-11 underline" type="button" disabled={draft.busy} onClick={()=>{setSaved(false);draft.reload();}}>Reload saved answers</button>
  {draft.status==="ready" && <fieldset disabled={draft.busy} className="flex flex-col gap-6">
    {(["motivations","interests","rhythm"] as const).map(question=><fieldset key={question} className="flex flex-col gap-3"><legend className="mb-3 font-semibold">{QUESTION_TITLES[question]}</legend><PreferenceFields question={question} draft={draft}/></fieldset>)}
    <fieldset><legend>Usual free times</legend><TimeGrid windows={draft.windows} onToggle={key=>draft.setWindows(w=>w.includes(key)?w.filter(x=>x!==key):[...w,key])}/><Button variant="outline" onClick={()=>draft.setWindows([])}>Clear usual free times</Button></fieldset>
    <Button onClick={()=>void draft.save({windows:draft.windows,motivations:draft.value.motivations,interests:draft.value.interests,rhythm:draft.value.rhythm,durationMax:draft.value.durationMax}).then(ok=>setSaved(ok))}>Save preferences</Button>
    {saved && <p role="status">Your preferences are saved.</p>}
  </fieldset>}
 </details>;
}
export function ContextualPreferences({plan,onSaved}:{plan:Plan;onSaved:()=>void}){
 const {user}=useAuth();if(!user)return null;
 return <ContextForm key={user.id+plan.id} userId={user.id} plan={plan} onSaved={onSaved}/>;
}
function ContextForm({userId,plan,onSaved}:{userId:string;plan:Plan;onSaved:()=>void}){
 const draft=usePreferenceDraft(userId);const [area,setArea]=useState("");const [placeTouched,setPlaceTouched]=useState(false);
 const [message,setMessage]=useState<string|null>(null);
 const facts=activityFor(plan.corner.key)?.facts;
 const needsResources=!!(facts && (facts.resources.required.length || facts.resources.alternatives?.length));
 const physical=plan.kind!=="at-home" && plan.where!=="Online";
 const save=async()=>{
   const ok=await draft.save({capability:draft.capability,...(needsResources?{resourceMode:"explicit" as const}:{})});
   if(!ok)return;
   if(physical && placeTouched){const result=await savePrivate(userId,{area:area.trim() || null});if(result.error){setMessage(result.error);return;}}
   setMessage("Your preferences are saved.");onSaved();
 };
 return <details className="rounded-control border border-border p-4"><summary className="min-h-11 cursor-pointer font-semibold">Make this fit you better</summary>
  <p className="mb-3 text-small">You can leave any of this open. Costs and availability still need checking with a host.</p>
  {draft.error && <p role="alert">{draft.error}</p>}{message && <p role="status">{message}</p>}
  {draft.status==="failed" && <Button variant="outline" onClick={draft.reload}>Try loading again</Button>}
  <fieldset disabled={draft.status!=="ready" || draft.busy} className="flex flex-col gap-4">
   <label className="flex flex-col gap-2">Time zone<input aria-label="Time zone" className="min-h-11 rounded-control border border-border bg-background p-3" value={draft.capability.timeZone} maxLength={80} onChange={e=>draft.setCapability(c=>({...c,timeZone:e.target.value}))}/></label>
   <label className="flex flex-col gap-2">Usual budget for one activity in dollars<input aria-label="Usual budget for one activity in dollars" type="number" min={0} max={10000} step="0.01" className="min-h-11 rounded-control border border-border bg-background p-3" value={draft.capability.perActivityBudget ?? ""} onChange={e=>draft.setCapability(c=>({...c,perActivityBudget:e.target.value===""?null:Number(e.target.value)}))}/></label>
   {needsResources && <label className="flex flex-col gap-2">What do you already have for this?<textarea aria-label="What do you already have for this?" rows={3} className="rounded-control border border-border bg-background p-3" maxLength={2400} value={draft.capability.equipment.join("\n")} onChange={e=>draft.setCapability(c=>({...c,equipment:e.target.value.split("\n").map(x=>x.trim()).filter(Boolean)}))}/><span className="text-small text-muted-foreground">One resource per line. Save an empty list to remove saved resources.</span></label>}
   {physical && <label className="flex flex-col gap-2">An area that works for you, if you like<input className="min-h-11 rounded-control border border-border bg-background p-3" value={area} maxLength={120} onChange={e=>{setArea(e.target.value);setPlaceTouched(true);}}/></label>}
   <Button onClick={()=>void save()}>Update suggestions</Button>
  </fieldset>
 </details>;
}
