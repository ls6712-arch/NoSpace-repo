import { useId, useState } from "react";
import { allSubHobbies } from "../../data/hobbies";
import { CURATED_CORNERS } from "../../data/curatedCorners";
import { ChoiceChip } from "../onboarding/ChoiceChip";
import { MOTIVATIONS, RHYTHMS, type Personalization } from "../../lib/personalization";
import type { PreferenceDraft, PreferenceQuestion } from "../../lib/usePreferenceDraft";
export const QUESTION_TITLES={
  motivations:"What would you like to make more room for?",
  interests:"What do you already love, or keep meaning to try?",
  rhythm:"What does a little free time look like for you?",
};
export const MOTIVATION_LABELS={make:"Making something",learn:"Learning and getting better",move:"Moving my body",company:"Time with people",personal_time:"Time to myself",explore:"Something new"};
export const RHYTHM_LABELS={small:"A few small moments",morning:"Quiet mornings",evening:"An evening to myself",weekend:"A longer weekend stretch",variable:"It changes week to week"};
export const preferenceName=(key:string)=>allSubHobbies.find(c=>`${c.hobbySlug}/${c.slug}`===key)?.label ?? key.split("/").at(-1)?.replace(/-/g," ") ?? key;
function multi<T extends string>(current:T[],key:T){return current.includes(key)?current.filter(x=>x!==key):[...current,key];}
export function PreferenceFields({question,draft}:{question:PreferenceQuestion;draft:PreferenceDraft}){
 const id=useId();const [query,setQuery]=useState("");
 const {value,setValue}=draft;
 const patch=(p:Partial<Personalization>)=>setValue(v=>({...v,...p}));
 if(question==="motivations")return <div className="grid grid-cols-1 gap-2 tab:grid-cols-2">{MOTIVATIONS.map(k=><ChoiceChip key={k} pressed={value.motivations.includes(k)} onToggle={()=>patch({motivations:multi(value.motivations,k)})}>{MOTIVATION_LABELS[k]}</ChoiceChip>)}</div>;
 if(question==="rhythm")return <div className="flex flex-col gap-4">
  <div className="grid grid-cols-1 gap-2 tab:grid-cols-2">{RHYTHMS.map(k=><ChoiceChip key={k} pressed={value.rhythm.includes(k)} onToggle={()=>patch({rhythm:multi(value.rhythm,k)})}>{RHYTHM_LABELS[k]}</ChoiceChip>)}</div>
  <label htmlFor={`${id}-duration`}>A comfortable amount of time, if you know</label>
  <select className="min-h-11 rounded-control border border-border bg-background p-3" id={`${id}-duration`} value={value.durationMax ?? ""} onChange={e=>patch({durationMax:e.target.value?Number(e.target.value):null})}>
   <option value="">It depends</option>{[15,30,60,120].map(n=><option key={n} value={n}>{n} minutes</option>)}
   {value.durationMax && ![15,30,60,120].includes(value.durationMax) && <option value={value.durationMax}>{value.durationMax} minutes</option>}
  </select><p className="text-small text-muted-foreground">A usual preference. You can ask for something different any day.</p>
 </div>;
 const choices=query.trim()?allSubHobbies.filter(c=>c.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0,24).map(c=>({key:`${c.hobbySlug}/${c.slug}`,name:c.label})):CURATED_CORNERS.slice(0,12).map(c=>({key:`${c.spaceSlug}/${c.slug}`,name:c.name}));
 const selected=new Set(value.interests.map(i=>i.key));
 const options=[...new Map([...choices,...value.interests.map(i=>({key:i.key,name:preferenceName(i.key)}))].map(c=>[c.key,c])).values()];
 return <div className="flex flex-col gap-4">
  <label htmlFor={`${id}-find`}>Find an interest</label><input className="min-h-11 rounded-control border border-border bg-background p-3" id={`${id}-find`} type="search" value={query} maxLength={80} onChange={e=>setQuery(e.target.value)} />
  <div className="grid grid-cols-2 gap-2" aria-label="Interests">{options.map(c=><ChoiceChip key={c.key} pressed={selected.has(c.key)} onToggle={()=>patch({interests:selected.has(c.key)?value.interests.filter(i=>i.key!==c.key):[...value.interests,{key:c.key,relationship:"unspecified",experience:"unspecified"}]})}>{c.name}</ChoiceChip>)}</div>
  {query && choices.length===0 && <p>No matching interests yet. You can explore without choosing.</p>}
  {value.interests.map((interest,n)=><fieldset key={interest.key} className="rounded-control border border-border p-3"><legend>{preferenceName(interest.key)}</legend>
   <label className="flex flex-col gap-2" htmlFor={`${id}-relationship-${n}`}>How does this fit you?</label>
    <select id={`${id}-relationship-${n}`} className="min-h-11 rounded-control border border-border bg-background p-2" value={interest.relationship} onChange={e=>patch({interests:value.interests.map(i=>i.key===interest.key?{...i,relationship:e.target.value as typeof interest.relationship}:i)})}>
     <option value="unspecified">I’m not sure yet</option><option value="enjoy">I already love it</option><option value="try">I want to try it</option><option value="returning">I’m coming back to it</option>
    </select>
   <label className="mt-2 flex min-h-11 items-center gap-2"><input type="checkbox" checked={interest.experience==="beginner"} onChange={e=>patch({interests:value.interests.map(i=>i.key===interest.key?{...i,experience:e.target.checked?"beginner":"unspecified"}:i)})}/>I’m new to this</label>
  </fieldset>)}
 </div>;
}
