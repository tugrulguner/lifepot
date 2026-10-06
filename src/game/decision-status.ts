import {z} from "zod";
import {validateEvolutionDecision} from "./decisions";
export const failureReasonSchema=z.enum(["rate_limited","unavailable","invalid_response","missing_credentials","unknown"]);
export type FailureReason=z.infer<typeof failureReasonSchema>;
export const failureLabels:Record<FailureReason,string>={rate_limited:"Model-call rate limit reached",unavailable:"Jev service unavailable",invalid_response:"Jev response could not be validated",missing_credentials:"Jev credentials unavailable",unknown:"No reason supplied by the service"};
export function decodeDecisionResponse(input:unknown){
 const envelope=z.object({fallbackReason:failureReasonSchema.optional(),provenance:z.object({outcome:z.enum(["decided","abstained"]),reason:failureReasonSchema.optional()}).optional()}).passthrough().parse(input);
 const {fallbackReason,provenance,...payload}=envelope;
 return {decision:validateEvolutionDecision(payload),reason:fallbackReason??provenance?.reason};
}
