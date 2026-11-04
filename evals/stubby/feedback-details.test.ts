import { expect, it } from "vitest";
import { buildContext } from "../../supabase/functions/stubby-scout/v3/context.ts";
import { rankCandidates } from "../../supabase/functions/stubby-scout/v3/recommendation.ts";
import { lastingFeedback, validFeedbackDetails } from "../../supabase/functions/_shared/feedback.ts";
import { input, candidate } from "./fixtures.ts";
const learned=[{source:"feedback" as const,title:"Pottery",signal:"down" as const,reason:"activity" as const,scope:"usual" as const}];
it("learns only when the account opted in; today and request feedback expire",()=>{
 expect(buildContext(input({learned})).learned).toEqual([]);
 const capability={...input().capability,consent:{memory:true,onboarding:true,feedback:true}};
 expect(buildContext(input({capability,learned})).learned).toHaveLength(1);
 expect(buildContext(input({capability,learned:[{...learned[0],scope:"request"}]})).learned).toEqual([]);
 expect(lastingFeedback([{reason:"today",scope:"usual"}])).toEqual([]);
 expect(validFeedbackDetails({reason:"today",scope:"usual"})).toBe(false);
});
it("a price rejection does not turn into a hobby rejection",()=>{
 const capability={...input().capability,consent:{memory:true,onboarding:true,feedback:true}};
 const base=rankCandidates([candidate()],buildContext(input({text:"something to do tonight",capability})),[]).recommendations[0].score;
 const price=rankCandidates([candidate()],buildContext(input({text:"something to do tonight",capability,learned:[{...learned[0],reason:"price"}]})),[]).recommendations[0].score;
 const activity=rankCandidates([candidate()],buildContext(input({text:"something to do tonight",capability,learned})),[]).recommendations[0].score;
 expect(price).toBe(base);expect(activity).toBeLessThan(base);
});
