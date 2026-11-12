import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { fetchCapability } from "../../lib/capabilityProfileRemote";
import type { FeedbackDetails } from "../../lib/stubbyAsk";
import { REJECTION_REASONS } from "../../../../supabase/functions/_shared/feedback";
import { Button } from "../ui/button";
const LABELS={price:"Price",time:"Time",distance:"Distance",activity:"The activity",today:"Just today"};
export function RejectionDetails({onSubmit,onDone}:{onSubmit:(details:FeedbackDetails)=>Promise<boolean>|void;onDone:()=>void}){
 const {user}=useAuth();const [canLearn,setCanLearn]=useState(false);const [usual,setUsual]=useState(false);
 const [busy,setBusy]=useState(false);const [failed,setFailed]=useState(false);
 useEffect(()=>{let live=true;if(user && !user.is_anonymous)void fetchCapability(undefined,user.id).then(c=>{if(live)setCanLearn(c.consent.feedback);}).catch(()=>{});return()=>{live=false;};},[user?.id]);
 const submit=async(reason:FeedbackDetails["reason"])=>{
  setBusy(true);setFailed(false);
  try{const saved=await onSubmit({reason,scope:reason!=="today" && usual && canLearn?"usual":"request"});if(saved===false)setFailed(true);else onDone();}
  catch{setFailed(true);}finally{setBusy(false);}
 };
 return <fieldset disabled={busy} className="mt-3 rounded-control border border-border p-3">
  <legend className="text-small font-semibold">What didn’t fit? Optional</legend>
  <p className="mb-2 text-caption text-muted-foreground">This suggestion only, unless you choose otherwise. Your interests stay as they are.</p>
  {canLearn && <label className="mb-2 flex min-h-11 items-center gap-2 text-small"><input type="checkbox" checked={usual} onChange={e=>setUsual(e.target.checked)}/>This is usually true for me</label>}
  {!canLearn && <p className="mb-2 text-caption text-muted-foreground">Learning from feedback is off. You can turn it on in settings.</p>}
  <div className="flex flex-wrap gap-2">{REJECTION_REASONS.map(k=><Button key={k} variant="outline" className="min-h-11" onClick={()=>void submit(k)}>{LABELS[k]}</Button>)}</div>
  <Button variant="ghost" className="mt-2 min-h-11" onClick={()=>void submit(null)}>Skip reason</Button>
  {failed && <p role="alert" className="text-small">Your feedback wasn’t saved. Try again.</p>}
 </fieldset>;
}
