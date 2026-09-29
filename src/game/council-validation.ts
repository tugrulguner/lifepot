import {councilApplicable,validateCouncilManifest,type CouncilRecord} from "./council";
import {ACTIVATIONS,DURATIONS,TRANSITIONS,PAIR_INTERACTIONS,SELF_INTERACTIONS,ENVIRONMENT_PRESSURES,INTENSITIES,type WorldRuleGraph} from "./rules";
import {PREY_STRATEGIES,PREDATOR_STRATEGIES,MUTATION_TARGETS,MUTATION_TEMPOS,type EvolutionDecision} from "./decisions";
// Zod enum records reorder probability keys; evidence equality is structural,
// not serialization equality. Array order and every key/value remain binding.
function same(a:unknown,b:unknown):boolean {
 if(a===b)return true;
 if(a===null||b===null||typeof a!=="object"||typeof b!=="object")return false;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>same(value,b[index]));
 const left=a as Record<string,unknown>,right=b as Record<string,unknown>,keys=Object.keys(left);
 return keys.length===Object.keys(right).length&&keys.every(key=>Object.hasOwn(right,key)&&same(left[key],right[key]));
}
function palette(r:CouncilRecord,key:string,options:readonly string[]){if(!r.evidence[key]||Object.keys(r.evidence[key].probabilities).sort().join()!==[...options].sort().join())throw new Error("Invalid council evidence palette");}
export function validateCouncilDecision(d:EvolutionDecision,rules:WorldRuleGraph){
 if(d.source==="fallback"){if(d.council||d.scheduledRuleChange||d.speciesDirectives?.length)throw new Error("Fallback must abstain");return;}
 const c=d.council;if(!c||!rules.council||!same(c.manifest,rules.council))throw new Error("Council authority mismatch");
 const manifest=validateCouncilManifest(c.manifest,rules),eligible=manifest.members.filter(m=>councilApplicable(m,d.trigger)),o=c.orchestrator;
 if(o.id!=="runtime_orchestrator"||o.scope!=="world"||o.responsibility!=="coordination")throw new Error("Invalid orchestrator");
 palette(o,"selectedPatch",["none",...eligible.filter(m=>m.responsibility!=="birth_policy").map(m=>m.id)]);palette(o,"activation",ACTIVATIONS);palette(o,"duration",DURATIONS);palette(o,"transition",TRANSITIONS);
 for(const m of eligible)palette(o,`activate_${m.id}`,["active","skip"]);
 if(Object.keys(o.evidence).length!==4+eligible.length||c.selectedPatch!==o.evidence.selectedPatch.choice)throw new Error("Invalid orchestration");
 const active=eligible.filter(m=>o.evidence[`activate_${m.id}`].choice==="active");
 if(c.calls!==1+active.length||c.members.length!==active.length)throw new Error("Incomplete council");
 for(const [index,m] of active.entries()){const r=c.members[index];if(r.id!==m.id||r.scope!==m.scope||r.responsibility!==m.responsibility)throw new Error("Cross-scope council result");
 if(m.responsibility==="birth_policy"){const role=rules.species.find(s=>s.id===m.scope)!.role;palette(r,"strategy",role==="hunter"||role==="omnivore"?PREDATOR_STRATEGIES:PREY_STRATEGIES);palette(r,"mutationTarget",MUTATION_TARGETS);palette(r,"mutationTempo",MUTATION_TEMPOS);if(Object.keys(r.evidence).length!==3)throw new Error("Extra birth authority");}
 else {palette(r,"value",m.responsibility==="environment"?ENVIRONMENT_PRESSURES:m.responsibility==="relationship"?PAIR_INTERACTIONS:SELF_INTERACTIONS);if(m.responsibility==="environment")palette(r,"intensity",INTENSITIES);if(Object.keys(r.evidence).length!==(m.responsibility==="environment"?2:1))throw new Error("Extra patch authority");}}
 const expected=rules.species.flatMap(s=>{const r=c.members.find(m=>m.responsibility==="birth_policy"&&m.scope===s.id);return r?[{species:s.id,strategy:r.evidence.strategy,mutationTarget:r.evidence.mutationTarget,mutationTempo:r.evidence.mutationTempo}]:[];});
 if(!same(expected,d.speciesDirectives))throw new Error("Council directive mismatch");
 const selected=c.members.find(m=>m.id===c.selectedPatch),p=d.scheduledRuleChange?.patch;
 if(c.selectedPatch==="none"){if(p)throw new Error("Unauthorized patch");}else{if(!selected||!p)throw new Error("Missing selected patch");const expectedPatch=selected.responsibility==="environment"?{kind:"environment",field:"pressure",value:selected.evidence.value.choice}:selected.responsibility==="relationship"?{kind:"pair",pair:selected.scope,mode:selected.evidence.value.choice}:{kind:"self",species:selected.scope,value:selected.evidence.value.choice};if(!same(p,expectedPatch)||!same(d.ruleActivation,o.evidence.activation)||!same(d.ruleDuration,o.evidence.duration)||!same(d.ruleTransition,o.evidence.transition))throw new Error("Reconciliation mismatch");if(selected.responsibility==="environment"&&(!same(d.environmentPressure,selected.evidence.value)||!same(d.environmentIntensity,selected.evidence.intensity)))throw new Error("Environment evidence mismatch");}
 const usage=[o,...c.members].reduce((s,r)=>({input_tokens:s.input_tokens+r.usage.input_tokens,output_tokens:s.output_tokens+r.usage.output_tokens}),{input_tokens:0,output_tokens:0});if(!same(usage,d.usage)||d.model!==o.model)throw new Error("Council usage mismatch");
}
