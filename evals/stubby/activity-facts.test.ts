import { expect, it } from "vitest";
import { buildContext } from "../../supabase/functions/stubby-scout/v3/context.ts";
import { sooshCandidates } from "../../supabase/functions/stubby-scout/v3/soosh.ts";
import { feasible } from "../../supabase/functions/stubby-scout/v3/feasibility.ts";
import { requirementsFit } from "../../supabase/functions/_shared/personalization.ts";
import { input } from "./fixtures.ts";
it("never assigns zero material cost to an unconfirmed baking idea", () => {
  const ctx=buildContext(input({text:"something at home tonight",profile:{...input().profile,picks:["food-cooking/sourdough"]}}));
  const [c]=sooshCandidates({picks:["food-cooking/sourdough"],pursuits:[]},ctx);
  expect(c.cost).toBeNull();expect(c.timing).toBe("suggested");expect(c.endsAt).toBeNull();
  expect(feasible(c,ctx)).toMatchObject({ok:true,verified:false});
  expect(feasible(c,{...ctx,hardBudget:0})).toEqual({ok:false,reason:"budget"});
});
it("treats drawing resource bundles as alternatives, not a requirement to own everything", () => {
  expect(requirementsFit({required:[],optional:["eraser"],alternatives:[["paper","pen"],["tablet","drawing app"]]},["paper","pen"])).toBe(true);
  expect(requirementsFit({required:[],optional:[],alternatives:[["paper","pen"],["tablet","drawing app"]]},["paper","drawing app"])).toBe(false);
});
it("does not treat owned interest as owned equipment, and rejects unknown duration under a firm limit", () => {
  const ctx=buildContext(input({text:"guitar at home tonight",profile:{...input().profile,picks:["music/guitar"]}}));
  const candidates=sooshCandidates({picks:["music/guitar"],pursuits:[]},ctx);
  expect(candidates).toHaveLength(1);
  {
    expect(candidates[0].cost).toBeNull();expect(feasible(candidates[0],{...ctx,durationMax:10})).toMatchObject({ok:false,reason:"duration"});
  }
});
