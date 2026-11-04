import { describe, expect, it } from "vitest";
import { emptyPersonalization, costFits, priceMaximum } from "./personalization";
import { activityCost, activityScore } from "../../../supabase/functions/_shared/activityFit";
import { atHomePlans, buildPlans, type PlanInput } from "./firstPlan";
import { stubbyPicks } from "./stubbyPicks";
import { ideasFor } from "./ideaMatch";

const guitar={key:"music/guitar",spaceSlug:"music",slug:"guitar",name:"Guitar"};
const now=new Date(2026,10,4,10).getTime();
const input:PlanInput={now,picks:[guitar],windows:[],budget:null,passes:[],events:[],pursuits:[]};
describe("shared meanings on recommendation surfaces",()=>{
 it("does not infer ownership or free materials from a picked interest",()=>{
   expect(activityCost(guitar.key,[])).toBeNull();
   expect(activityCost(guitar.key,["guitar"])).toBe(0);
   expect(atHomePlans({...input,budget:0})).toEqual([]);
   expect(atHomePlans({...input,budget:0,equipment:["guitar"]})).toHaveLength(1);
 });
 it("uses new relationships, experience and motivations in actual ranking",()=>{
   const prefs={...emptyPersonalization(),motivations:["learn" as const],interests:[{key:guitar.key,relationship:"returning" as const,experience:"beginner" as const}]};
   expect(activityScore(guitar.key,prefs)).toBeGreaterThan(activityScore(guitar.key,emptyPersonalization()));
   expect(buildPlans({...input,personalization:prefs})[0].corner.key).toBe(guitar.key);
   const ideas=ideasFor({time:"weekend",spend:"treat",who:"solo"},{personalization:prefs,limit:100});
   const plain=ideasFor({time:"weekend",spend:"treat",who:"solo"},{limit:100});
   expect(ideas.map(i=>i.key)).not.toEqual(plain.map(i=>i.key));
 });
 it("applies an explicit activity ceiling to onboarding and calendar without claiming a pass covers it",()=>{
   const startsAt=now+4*3600000;
   const event={eventId:1,cornerKey:guitar.key,title:"Lesson",startsAt,endsAt:startsAt+3600000,price:"$30",online:true};
   const passes=[{id:"a",kind:"gear" as const,label:"Guitar",place:""}];
   expect(buildPlans({...input,events:[event],activityBudget:20,passes}).some(p=>p.kind==="event")).toBe(false);
   expect(stubbyPicks({...input,events:[event],activityBudget:20,passes,slots:[{key:"one",startMs:startsAt,endMs:startsAt+7200000}],declined:{},taken:new Set()}).size).toBe(0);
   expect(costFits(priceMaximum(event.price),20)).toBe(false);
 });
 it("does not invent an end time to fit an exact calendar stretch",()=>{
   const startsAt=now+4*3600000;
   expect(stubbyPicks({...input,events:[{eventId:1,cornerKey:guitar.key,title:"Lesson",startsAt,online:true,price:"Free"}],slots:[{key:"one",startMs:startsAt,endMs:startsAt+7200000}],declined:{},taken:new Set()}).size).toBe(0);
 });
});
