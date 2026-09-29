import { z } from "zod";
import type { WorldRuleGraph } from "./rules";
export const COUNCIL_ACTIVATIONS=["always","resource_shift","population_change","predation_spike","speciation","stagnation"] as const;
export const councilMemberSchema=z.object({id:z.string().max(40),responsibility:z.enum(["birth_policy","self_interaction","relationship","environment"]),scope:z.string().max(20),activation:z.enum(COUNCIL_ACTIVATIONS)}).strict();
export const councilManifestSchema=z.object({version:z.literal(1),members:z.array(councilMemberSchema).min(2).max(6)}).strict();
export type CouncilManifest=z.infer<typeof councilManifestSchema>;
export type CouncilMember=CouncilManifest["members"][number];
export const councilEvidenceSchema=z.object({choice:z.string().max(80),confidence:z.number().min(0).max(1),probabilities:z.record(z.string().max(80),z.number().min(0).max(1))}).strict().superRefine((a,c)=>{const values=Object.values(a.probabilities);if(!values.length||Math.abs(values.reduce((s,v)=>s+v,0)-1)>.011||a.probabilities[a.choice]!==Math.max(...values))c.addIssue({code:"custom",message:"Invalid council distribution"});});
export const councilRecordSchema=z.object({id:z.string().max(40),responsibility:z.string().max(40),scope:z.string().max(20),model:z.string().min(1).max(100),usage:z.object({input_tokens:z.number().int().nonnegative(),output_tokens:z.number().int().nonnegative()}).strict(),evidence:z.record(z.string().max(80),councilEvidenceSchema)}).strict();
export const councilProvenanceSchema=z.object({manifest:councilManifestSchema,orchestrator:councilRecordSchema,members:z.array(councilRecordSchema).max(6),selectedPatch:z.string().max(40),calls:z.number().int().min(1).max(7)}).strict();
export type CouncilRecord=z.infer<typeof councilRecordSchema>;
export type CouncilProvenance=z.infer<typeof councilProvenanceSchema>;
export function councilRegistry(rules:WorldRuleGraph):Omit<CouncilMember,"activation">[]{return [...rules.species.flatMap(s=>[{id:`birth_${s.id}`,responsibility:"birth_policy" as const,scope:s.id},{id:`self_${s.id}`,responsibility:"self_interaction" as const,scope:s.id}]),...rules.interactions.map(p=>({id:`pair_${p.pair.replace(":","_")}`,responsibility:"relationship" as const,scope:p.pair})),{id:"environment",responsibility:"environment" as const,scope:"environment"}];}
export function validateCouncilManifest(input:unknown,rules:WorldRuleGraph):CouncilManifest{const m=councilManifestSchema.parse(input),registry=councilRegistry(rules);if(new Set(m.members.map(x=>x.id)).size!==m.members.length||m.members.some(x=>!registry.some(r=>r.id===x.id&&r.scope===x.scope&&r.responsibility===x.responsibility)))throw new Error("Invalid council scope or duplicate responsibility");return m;}
export function councilApplicable(member:CouncilMember,trigger:string){return member.activation==="always"||member.activation===trigger||(member.activation==="population_change"&&(trigger==="prey_crash"||trigger==="predator_crash"));}
