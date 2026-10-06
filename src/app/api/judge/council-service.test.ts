import {runFreshWithDecisions,runWithDecisionLedger} from "@/game/runtime";
import {snapshotSimulation,stepSimulation} from "@/game/world";
import {validateSpeciesDirectives,validateEvolutionDecision} from "@/game/decisions";
import {createCallBudget} from "./route";
import {decideEvolution} from "./service";
import {defaultConfig} from "@/game/setup";
import {expect,it} from "vitest";
import {selectCouncil,runCouncil} from "./council-service";
import {defaultRuleGraph} from "@/game/rules";
import {createSimulation} from "@/game/world";
import {summarizeEcology} from "@/game/decisions";
const intent={world:"rich",threat:"heat",reward:"adapt"};
it("replays council provenance without inference and rejects changed authority",async()=>{const config=defaultConfig();config.rules!.council=(await selectCouncil(config.rules!,intent,client())).manifest;const initial=createSimulation({seed:1,config}),live=client();const fresh=await runFreshWithDecisions(initial,intent,s=>runCouncil(s,live),50);expect(fresh.ledger.some(d=>d.council)).toBe(true);const count=live.calls;expect(snapshotSimulation(runWithDecisionLedger(initial,fresh.ledger,50,intent))).toEqual(snapshotSimulation(fresh.state));expect(live.calls).toBe(count);const tampered=structuredClone(fresh.ledger.find(d=>d.council)!);tampered.council!.members[0].scope="D";expect(()=>validateSpeciesDirectives(tampered,config.rules!)).toThrow();});
it("counts actual downstream calls and atomically abstains on exhausted quota",async()=>{const rules=defaultRuleGraph();rules.council=(await selectCouncil(rules,intent,client("4"))).manifest;const summary={...summarizeEcology(createSimulation({seed:1,config:defaultConfig()}),intent,"stagnation"),rules,generation:12};const model=client(),reserve=createCallBudget(1);const result=await decideEvolution({kind:"evolution",summary},{apiKey:"test",client:model,beforeCall:()=>reserve("ip")});expect(model.calls).toBe(1);expect(result.source).toBe("fallback");expect(result.speciesDirectives).toEqual([]);expect(result.scheduledRuleChange).toBeUndefined();});
it("accepts identical scoped evidence after Zod reorders probability keys, but rejects changed values",async()=>{
 const rules=defaultRuleGraph();rules.council=(await selectCouncil(rules,intent,client("4"))).manifest;
 const summary={...summarizeEcology(createSimulation({seed:1,config:defaultConfig()}),intent,"stagnation"),rules,generation:12};
 const model=client();
 const decision=await runCouncil(summary,{async systemOne(request){const response=await model.systemOne(request);for(const answer of Object.values(response.answers))answer.probabilities=Object.fromEntries(Object.entries(answer.probabilities).reverse());return response;}});
 expect(()=>validateSpeciesDirectives(decision,rules)).not.toThrow();
 const keyOrder=structuredClone(decision);
 keyOrder.council!.manifest={members:keyOrder.council!.manifest.members,version:1};
 keyOrder.scheduledRuleChange!.patch={value:"cooperative",species:"A",kind:"self"};
 keyOrder.usage={output_tokens:decision.usage!.output_tokens,input_tokens:decision.usage!.input_tokens};
 expect(()=>validateSpeciesDirectives(keyOrder,rules)).not.toThrow();
 const extra=structuredClone(decision);Object.assign(extra.speciesDirectives![0].strategy.probabilities,{invented:0});
 expect(()=>validateSpeciesDirectives(extra,rules)).toThrow("Council directive mismatch");
 const differentProbability=structuredClone(decision);Object.assign(differentProbability.speciesDirectives![0].strategy.probabilities,{[differentProbability.speciesDirectives![0].strategy.choice]:.9});
 expect(()=>validateSpeciesDirectives(differentProbability,rules)).toThrow("Council directive mismatch");
 const changed=structuredClone(decision);changed.speciesDirectives![0].strategy.confidence=.9;
 expect(()=>validateSpeciesDirectives(changed,rules)).toThrow("Council directive mismatch");
 const reordered=structuredClone(decision);reordered.speciesDirectives!.reverse();
 expect(()=>validateSpeciesDirectives(reordered,rules)).toThrow("Council directive mismatch");
});
it("binds reordered environmental evidence and executes the council schedule exactly once",async()=>{
 const config=defaultConfig(),rules=config.rules!;rules.council=(await selectCouncil(rules,intent,client("6"))).manifest;
 let state={...createSimulation({seed:1,config}),generation:12};
 const model=client(),decision=await runCouncil(summarizeEcology(state,intent,"stagnation"),{async systemOne(request){
  const response=await model.systemOne(request);
  for(const [key,answer] of Object.entries(response.answers)){
   const selected=key==="selectedPatch"?"environment":key==="activation"?"after_6":key.endsWith("__value")&&"drought" in answer.probabilities?"drought":answer.choice;
   answer.choice=selected;answer.probabilities=Object.fromEntries(Object.keys(answer.probabilities).reverse().map(k=>[k,k===selected?1:0]));
  }
  return response;
 }});
 expect(()=>validateSpeciesDirectives(decision,rules)).not.toThrow();
 for(const key of ["ruleActivation","ruleDuration","ruleTransition","environmentPressure","environmentIntensity"] as const){const changed=structuredClone(decision);changed[key]!.confidence=.9;expect(()=>validateSpeciesDirectives(changed,rules)).toThrow(/Reconciliation mismatch|Environment evidence mismatch/);}
 while(state.generation<17)state=stepSimulation(state,decision,[decision]);
 expect(state.config.rules!.version).toBe(1);
 state=stepSimulation(state,decision,[decision]);
 expect(state.config.rules!.version).toBe(2);expect(state.config.rules!.environment.pressure).toBe("drought");
 while(state.generation<24)state=stepSimulation(state,decision,[decision]);
 expect(state.config.rules!.version).toBe(3);expect(state.config.rules!.environment.pressure).toBe("stability");
 state=stepSimulation(state,decision,[decision]);
 expect(state.config.rules!.version).toBe(3);expect(state.appliedRuleChanges).toEqual([12]);
});
it("runs the orchestrator before one scoped specialist batch and omits inactive scopes",async()=>{
 const config=defaultConfig(),rules=config.rules!;rules.council=(await selectCouncil(rules,intent,client("6"))).manifest;
 rules.council.members.find(m=>m.id==="environment")!.activation="resource_shift";
 const summary={...summarizeEcology(createSimulation({seed:1,config}),intent,"stagnation"),generation:12};
 const model=client(),started:string[]=[];
 const decision=await runCouncil(summary,{async systemOne(request){
  const response=await model.systemOne(request);
  if("selectedPatch" in request.questions){const a=response.answers.activate_self_B;a.choice="skip";a.probabilities={active:0,skip:1};return response;}
  const state=request.state as {manifest:{members:unknown[]};orchestrator:{id:string};summary:unknown;authorities:{id:string}[]};
  expect(state.orchestrator.id).toBe("runtime_orchestrator");expect(state.summary).toEqual(summary);expect(state.manifest.members).toEqual(rules.council!.members);
  started.push(...state.authorities.map(authority=>authority.id));return response;
 }});
 expect(started).toEqual(["birth_A","self_A","birth_B","pair_A_B"]);
 expect(decision.council!.calls).toBe(2);expect(model.calls).toBe(2);
 expect(()=>validateSpeciesDirectives(decision,rules)).not.toThrow();
});
it("asks birth specialists for tradeoffs, never beneficial targeted mutations",async()=>{
 const rules=defaultRuleGraph();rules.council=(await selectCouncil(rules,intent,client("4"))).manifest;
 const summary={...summarizeEcology(createSimulation({seed:1,config:defaultConfig()}),intent,"stagnation"),rules,generation:12};
 const model=client();let births=0;
 await runCouncil(summary,{async systemOne(request){
  if(Object.keys(request.questions).some(key=>key.endsWith("__mutationTarget"))){births++;const key=Object.keys(request.questions).find(k=>k.endsWith("__strategy"))!,target=Object.keys(request.questions).find(k=>k.endsWith("__mutationTarget"))!,tempo=Object.keys(request.questions).find(k=>k.endsWith("__mutationTempo"))!;expect(JSON.stringify(request.questions[key])).toContain("cost tradeoffs");expect(JSON.stringify(request.questions[target])).toContain("legacy");expect(JSON.stringify(request.questions[target])).toContain("does not direct");expect(JSON.stringify(request.questions[tempo])).toContain("not guarantee");}
  return model.systemOne(request);
 }});
 expect(births).toBeGreaterThan(0);
});
function client(count="2",bad=false){let calls=0;return {get calls(){return calls},async systemOne(request:{questions:Record<string,{criteria:Record<string,unknown>}>}){calls++;const answers=Object.fromEntries(Object.entries(request.questions).map(([id,q])=>{const keys=Object.keys(q.criteria);const choice=id==="count"?count:id==="selectedPatch"?keys.find(k=>k!=="none")??keys[0]:keys[0];return [id,{type:"choice",choice,confidence:1,probabilities:Object.fromEntries(keys.map(k=>[k,k===choice?1:0]))}]}));if(bad&&calls>1)answers.illegal=answers[Object.keys(answers)[0]];return {model:"test-jev",usage:{input_tokens:10,output_tokens:2},answers};}}}
it("uses one namespaced specialist batch and records actual provider calls",async()=>{const rules=defaultRuleGraph();rules.council=(await selectCouncil(rules,intent,client("4"))).manifest;const summary={...summarizeEcology(createSimulation({seed:1,config:defaultConfig()}),intent,"stagnation"),rules,generation:12};const model=client();const decision=await runCouncil(summary,model);expect(model.calls).toBe(2);expect(decision.council?.calls).toBe(2);expect(decision.council?.batching).toEqual({mode:"batched",providerCalls:1});expect(decision.usage?.input_tokens).toBe(20);expect(decision.council?.batchUsage).toEqual({input_tokens:10,output_tokens:2});expect(()=>validateSpeciesDirectives(decision,rules)).not.toThrow();});
it("keeps inactive councils to one provider call and validates legacy provenance without batch markers",async()=>{const rules=defaultRuleGraph();rules.council=(await selectCouncil(rules,intent,client("4"))).manifest;const summary={...summarizeEcology(createSimulation({seed:1,config:defaultConfig()}),intent,"stagnation"),rules,generation:12};const model=client();const noActive=await runCouncil(summary,{async systemOne(request){const response=await model.systemOne(request);if("selectedPatch" in request.questions){const patch=response.answers.selectedPatch;patch.choice="none";patch.probabilities={...Object.fromEntries(Object.keys(patch.probabilities).map(key=>[key,key==="none"?1:0]))};for(const [key,value] of Object.entries(response.answers))if(key.startsWith("activate_")){value.choice="skip";value.probabilities={active:0,skip:1};}}return response;}});expect(model.calls).toBe(1);expect(noActive.council?.calls).toBe(1);expect(noActive.council?.batching).toBeUndefined();const batched=await runCouncil(summary,client());const legacy=structuredClone(batched);delete legacy.council!.batching;delete legacy.council!.batchUsage;legacy.council!.calls=1+legacy.council!.members.length;for(const member of legacy.council!.members)member.usage={input_tokens:10,output_tokens:2};legacy.usage={input_tokens:legacy.council!.orchestrator.usage.input_tokens+legacy.council!.members.length*10,output_tokens:legacy.council!.orchestrator.usage.output_tokens+legacy.council!.members.length*2};expect(()=>validateSpeciesDirectives(legacy,rules)).not.toThrow();});
it("selects differing model-chosen counts then orchestrates scoped parallel specialists",async()=>{const rules=defaultRuleGraph();const a=client("2"),b=client("4");const two=await selectCouncil(rules,intent,a),four=await selectCouncil(rules,intent,b);expect(two.manifest.members).toHaveLength(2);expect(four.manifest.members).toHaveLength(4);rules.council=four.manifest;const summary={...summarizeEcology(createSimulation({seed:1,config:{...createSimulation({seed:1,config:defaultConfig()}).config,rules}}),intent,"stagnation"),generation:12};const live=client();const decision=await runCouncil(summary,live);expect(decision.council?.calls).toBe(live.calls);expect(decision.usage?.input_tokens).toBe(live.calls*10);expect(decision.council?.members).toHaveLength(4);});
it("rejects a complete council when any specialist returns cross-scope keys",async()=>{const rules=defaultRuleGraph();rules.council=(await selectCouncil(rules,intent,client())).manifest;const summary={...summarizeEcology(createSimulation({seed:1,config:defaultConfig()}),intent,"stagnation"),rules,generation:12};await expect(runCouncil(summary,client("2",true))).rejects.toThrow();});

it("preserves typed runtime fallback cause without adding it to the strict decision ledger",async()=>{const rules=defaultRuleGraph();rules.council=(await selectCouncil(rules,intent,client())).manifest;const summary={...summarizeEcology(createSimulation({seed:1,config:defaultConfig()}),intent,"stagnation"),rules,generation:12};const result=await decideEvolution({kind:"evolution",summary},{apiKey:"test",client:{async systemOne(){throw new Error("429 rate limit exceeded");}}});expect(result.source).toBe("fallback");expect(result.fallbackReason).toBe("rate_limited");expect(()=>{const {fallbackReason:reason,...ledger}=result;void reason;validateEvolutionDecision(ledger);}).not.toThrow();});
