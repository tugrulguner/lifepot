import { z } from "zod";
import type { RunEvidence } from "./run-evidence";
import type { LifeConfig } from "./world";
export type RunComparisonInput = { evidence: RunEvidence; config: LifeConfig };
export function buildRunComparison(before: RunComparisonInput, after: RunComparisonInput) {
 const series=(run:RunComparisonInput,id:string,generations:number[])=>(generations.map(g=>run.evidence.samples.find(s=>s.generation===g)?.species.find(x=>x.speciesId===id)?.population ?? null));
 const generations=[...new Set([...before.evidence.samples.map(s=>s.generation),...after.evidence.samples.map(s=>s.generation)])].sort((a,b)=>a-b);
 const ids=[...new Set([...before.evidence.samples.flatMap(s=>s.species.map(x=>x.speciesId)),...after.evidence.samples.flatMap(s=>s.species.map(x=>x.speciesId))])].sort();
 const flatten=(v:unknown,p=""):Array<{path:string;before:unknown}>=>{if(v&&typeof v==="object"&&!Array.isArray(v))return Object.keys(v).sort().flatMap(k=>flatten((v as Record<string,unknown>)[k],p?`${p}.${k}`:k));return [{path:p,before:v}]};
 const left=flatten(before.config);
 const right=new Map(flatten(after.config).map(x=>[x.path,x.before]));
 const conditionChanges=left.flatMap(x=>{const b=right.get(x.path);return x.path!=="rules.version"&&right.has(x.path)&&JSON.stringify(b)!==JSON.stringify(x.before)?[{path:x.path,before:x.before,after:b}]:[]});
 return { generations, before:before.evidence.samples.map(s=>({generation:s.generation,population:s.population})), after:after.evidence.samples.map(s=>({generation:s.generation,population:s.population})), species:ids.map(speciesId=>({speciesId,role:before.evidence.samples.flatMap(s=>s.species).find(x=>x.speciesId===speciesId)?.role??after.evidence.samples.flatMap(s=>s.species).find(x=>x.speciesId===speciesId)?.role??"unknown",before:series(before,speciesId,generations),after:series(after,speciesId,generations)})), conditionChanges };
}
const boundedText=z.string().trim().min(1).max(240);
export const reflectionResponseSchema=z.object({observations:z.array(z.object({text:boundedText,evidenceRefs:z.array(z.string().max(100)).min(1).max(5)}).strict()).min(1).max(4),nextExperiment:z.object({title:boundedText,rationale:boundedText,evidenceRefs:z.array(z.string().max(100)).min(1).max(5),changes:z.array(z.object({path:z.enum(["rules.environment.pressure","rules.environment.intensity","rules.environment.duration","rules.environment.volatility","rules.environment.regeneration","environment.hazard","environment.abundance","environment.volatility"]),value:z.string().max(40)}).strict()).min(1).max(2)}).strict(),caveat:boundedText,metadata:z.object({source:z.enum(["typesafe","deterministic"]),model:z.string().max(100).optional(),usage:z.object({input_tokens:z.number().int().nonnegative(),output_tokens:z.number().int().nonnegative()}).strict().optional()}).strict().optional()}).strict();
export type RunReflection=z.infer<typeof reflectionResponseSchema>;
const allowedValues:Record<string,string[]>={"rules.environment.pressure":["stability","drought","toxin_wave","heat_wave","fragmentation","nutrient_bloom"],"rules.environment.intensity":["low","medium","high"],"rules.environment.duration":["short","medium","long","persistent"],"rules.environment.regeneration":["steady","pulsed","depletion_feedback"],"rules.environment.volatility":["stable","pulsing","chaotic"],"environment.hazard":["drought","toxin","heat","crowding"],"environment.abundance":["scarce","balanced","rich"],"environment.volatility":["stable","pulsing","chaotic"]};
export function validateReflection(input:unknown,evidence:RunEvidence,config:LifeConfig):RunReflection {
 const result=reflectionResponseSchema.parse(input);
 const refs=new Set(["population",...evidence.samples.flatMap(s=>s.species.map(x=>`species:${x.speciesId}`)),...evidence.firstExtinction.map(x=>`extinction:${x.speciesId}`),...evidence.lineageExtinction.map(x=>`family:${x.lineage}`),...Object.keys(config.environment).map(x=>`condition:environment.${x}`),...Object.keys(config.rules?.environment??{}).map(x=>`condition:rules.environment.${x}`)]);
 for(const item of [...result.observations,result.nextExperiment])for(const ref of item.evidenceRefs)if(!refs.has(ref))throw new Error("Reflection references unsupported evidence");
 for(const change of result.nextExperiment.changes){if(!allowedValues[change.path]?.includes(change.value))throw new Error("Unsupported condition change");const current=change.path.split(".").reduce((v,k)=>v&&typeof v==="object"?(v as Record<string,unknown>)[k]:undefined,config as unknown);if(current===change.value)throw new Error("Condition change must differ from current setting");}
 return result;
}
