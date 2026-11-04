import { Link, useSearchParams } from "react-router";
import { useAuth } from "../../../context/AuthContext";
import { usePreferenceDraft, type PreferenceQuestion } from "../../../lib/usePreferenceDraft";
import { PreferenceFields, QUESTION_TITLES, MOTIVATION_LABELS, RHYTHM_LABELS, preferenceName } from "../../../components/settings/PreferenceFields";
import { PillButton } from "../../../components/ui/PillButton";
import { useOnboarding } from "../OnboardingContext";
import { ScreenFrame } from "./ScreenFrame";

export function HumanQuestion({question}:{question:PreferenceQuestion}){
 const {user}=useAuth();return <QuestionForm key={user?.id ?? "guest"} userId={user?.id} question={question}/>;
}
function QuestionForm({userId,question}:{userId?:string;question:PreferenceQuestion}){
 const draft=usePreferenceDraft(userId);const {next}=useOnboarding();
 const patch=()=>question==="rhythm"?{rhythm:draft.value.rhythm,durationMax:draft.value.durationMax}:{[question]:draft.value[question]};
 const save=async()=>{if(await draft.save(patch()))next();};
 return <ScreenFrame title={QUESTION_TITLES[question]} intro={question==="interests"?"One is enough. Or explore and see what catches your eye.":"Choose what feels like you. You can change it later."} stickyFooter footer={<>
  {draft.error && <p role="alert">{draft.error}</p>}
  {draft.error && <PillButton className="ob-button min-h-14" variant="outline" onClick={draft.reload}>Try loading again</PillButton>}
  <PillButton className="ob-button min-h-14" data-variant="primary" disabled={draft.status!=="ready" || draft.busy} onClick={()=>void save()}>Next</PillButton>
  {question==="interests" && draft.value.interests.length===0 && <PillButton className="ob-button min-h-14" variant="outline" disabled={draft.busy} onClick={()=>next()}>Help me explore</PillButton>}
  <PillButton className="ob-button min-h-14" data-variant="plain" variant="outline" disabled={draft.busy} onClick={()=>next({reaction:"shrug"})}>Skip for now</PillButton>
 </>}>
  {draft.status==="loading" && <p role="status">Loading your preferences…</p>}
  <fieldset disabled={draft.status!=="ready" || draft.busy}><PreferenceFields question={question} draft={draft}/></fieldset>
 </ScreenFrame>;
}
export function PreferenceReview(){
 const {user}=useAuth();return <ReviewForm key={user?.id ?? "guest"} userId={user?.id}/>;
}
function ReviewForm({userId}:{userId?:string}){
 const draft=usePreferenceDraft(userId);const {next}=useOnboarding();const [params]=useSearchParams();
 const href=(step:string)=>{const p=new URLSearchParams(params);p.set("step",step);return `/onboarding?${p}`;};
 return <ScreenFrame title="Does this feel like you?" intro="Only you can see these preferences. Today’s mood can always be different." footer={<>
  <PillButton className="ob-button min-h-14" data-variant="primary" disabled={draft.busy} onClick={()=>next()}>Find something for me</PillButton>
 </>}>
 {draft.status==="loading" && <p role="status">Loading your preferences…</p>}
 {draft.error && <><p role="alert">{draft.error}</p><button className="ob-link min-h-11" type="button" onClick={draft.reload}>Try loading again</button></>}
 {draft.status==="ready" && <dl className="flex flex-col gap-4">{[
  ["Make room for",draft.value.motivations.map(k=>MOTIVATION_LABELS[k]).join(", "),"yours"],
  ["Interests",draft.value.interests.map(i=>`${preferenceName(i.key)}${i.relationship==="try"?" (want to try)":i.relationship==="returning"?" (returning)":""}${i.experience==="beginner"?" (beginner)":""}`).join(", "),"picks"],
  ["Free time",[...draft.value.rhythm.map(k=>RHYTHM_LABELS[k]),...(draft.value.durationMax?[`About ${draft.value.durationMax} minutes`]:[])].join(", "),"free"],
 ].map(([label,text,step])=><div key={step} className="rounded-control border border-border p-4"><dt className="font-semibold">{label}</dt><dd className="mt-2">{text || "Open to exploring"}</dd><Link className="ob-link inline-flex min-h-11 items-center" to={href(step)}>Edit {label.toLowerCase()}</Link></div>)}</dl>}
 <p className="text-small text-muted-foreground">We’ll ask about cost, resources or an area when a suggestion needs them.</p>
 </ScreenFrame>;
}
