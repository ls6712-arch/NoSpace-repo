/** A reason explains a rejected suggestion; it never edits lasting interests or hard constraints. */
export const REJECTION_REASONS=["price","time","distance","activity","today"] as const;
export type RejectionReason=typeof REJECTION_REASONS[number];
export interface FeedbackDetails { reason:RejectionReason|null; scope:"request"|"usual" }
export function validFeedbackDetails(value:unknown):value is FeedbackDetails {
 if(!value || typeof value!=="object")return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).every(k=>["reason","scope"].includes(k)) && (v.reason===null || REJECTION_REASONS.includes(v.reason as RejectionReason)) && ["request","usual"].includes(v.scope as string) && !(v.reason==="today" && v.scope!=="request");
}
/** Old rows with no scope retain legacy meanings; migrated and new temporary rows are excluded. */
export function lastingFeedback<T extends {scope?:string;reason?:string|null}>(rows:readonly T[]):T[]{
 return rows.filter(r=>r.scope!=="request" && r.reason!=="today");
}
