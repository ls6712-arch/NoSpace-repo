/** Reviewed requirements for specific first steps. Missing entries are unknown, not equipment-free. */
import type { ResourceRequirements } from "../../../supabase/functions/_shared/personalization";
export interface FirstStepFacts {
  atHome: boolean;
  beginner: boolean | null;
  resources: ResourceRequirements & { alternatives?: string[][] };
  costMode: "free" | "owned_resources" | "unknown";
}
const drawing: FirstStepFacts = { atHome: true, beginner: true,
  resources: { required: [], alternatives: [["paper", "pencil"], ["paper", "pen"], ["tablet", "drawing app"]], optional: ["eraser"] }, costMode: "owned_resources" };
const writing: FirstStepFacts = { atHome: true, beginner: true,
  resources: { required: [], alternatives: [["paper", "pen"], ["computer"], ["phone"]], optional: [] }, costMode: "owned_resources" };
const guitar: FirstStepFacts = { atHome: true, beginner: true, resources: { required: [["guitar"]], optional: ["pick"] }, costMode: "owned_resources" };
const reading: FirstStepFacts = { atHome: true, beginner: true, resources: { required: [["book"]], optional: ["bookmark"] }, costMode: "owned_resources" };
export const FIRST_STEP_FACTS: Readonly<Record<string, FirstStepFacts>> = {
  drawing, sketching: drawing, illustration: drawing, guitar,
  writing, "creative-writing": writing, poetry: writing,
  reading, books: reading,
  yoga: { atHome: true, beginner: null, resources: { required: [], optional: ["yoga mat"] }, costMode: "free" },
  stretching: { atHome: true, beginner: true, resources: { required: [], optional: ["yoga mat"] }, costMode: "free" },
  sourdough: { atHome: true, beginner: true, resources: { required: [["flour"], ["water"], ["jar"]], optional: ["kitchen scale"] }, costMode: "unknown" },
  baking: { atHome: true, beginner: true, resources: { required: [["flour"], ["oven"]], optional: ["stand mixer"] }, costMode: "unknown" },
  "watercolor-painting": { atHome: true, beginner: true, resources: { required: [["watercolor paints"], ["brush"], ["watercolor paper"]], optional: [] }, costMode: "unknown" },
  knitting: { atHome: true, beginner: true, resources: { required: [["yarn"], ["knitting needles"]], optional: [] }, costMode: "unknown" },
};
