import { expect, it, vi } from "vitest";
import { runCouncil, type CouncilClient } from "./council-service";
import { createSimulation } from "@/game/world";
import { defaultConfig } from "@/game/setup";
import { summarizeEcology } from "@/game/decisions";

function summary() {
 const config=defaultConfig();config.rules!.council={version:1,members:[{id:"birth_A",responsibility:"birth_policy",scope:"A",activation:"always"},{id:"self_A",responsibility:"self_interaction",scope:"A",activation:"always"}]};
 return {...summarizeEcology(createSimulation({seed:1,config}),{world:"pond",threat:"drought",reward:"coexist"},"stagnation"),generation:12};
}
function client(corruptStage:number):CouncilClient {
 return {async systemOne(request){return {model:"fixture",usage:{input_tokens:1,output_tokens:1},answers:Object.fromEntries(Object.entries(request.questions).map(([key,q])=>{const keys=Object.keys(q.criteria),selected=key==="selectedPatch"?"none":keys[0];return [key,{type:"choice",choice:selected,confidence:(("selectedPatch" in request.questions)?1:2)===corruptStage?2:1,probabilities:Object.fromEntries(keys.map(k=>[k,k===selected?1:0]))}]}))};}};
}
it.each([[1,"orchestrator"],[2,"specialists"]] as const)("identifies a failure in %s without logging provider values",async(call,stage)=>{
 const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});
 try {await expect(runCouncil(summary(),client(call))).rejects.toThrow();expect(warn).toHaveBeenCalledWith("lifepot.runtime.council_failure",expect.objectContaining({stage,generation:12,code:"schema",issues:expect.arrayContaining([expect.objectContaining({code:"too_big"})])}));const logged=JSON.stringify(warn.mock.calls);expect(logged).not.toContain("probabilities");expect(logged).not.toContain("fixture");expect(logged).not.toContain("pond");}finally{warn.mockRestore();}
});
it("bounds diagnostic volume for a malformed provider response",async()=>{
 const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});const base=client(1);
 try{await expect(runCouncil(summary(),{async systemOne(request){const raw=await base.systemOne(request) as {answers:Record<string,{probabilities:Record<string,number>}>};for(const answer of Object.values(raw.answers))for(const key of Object.keys(answer.probabilities))answer.probabilities[key]=2;return raw;}})).rejects.toThrow();expect(warn.mock.calls[0][1].issues.length).toBeLessThanOrEqual(12);}finally{warn.mockRestore();}
});
it.each(["probability_sum","selection_mismatch"] as const)("identifies %s separately without exposing values",async(reason)=>{
 const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});const base=client(0);
 try{await expect(runCouncil(summary(),{async systemOne(request){const raw=await base.systemOne(request) as {answers:Record<string,{choice:string;probabilities:Record<string,number>}>};const a=raw.answers.activation;const other=Object.keys(a.probabilities).find(key=>key!==a.choice)!;if(reason==="probability_sum")a.probabilities[a.choice]=.5;else {a.probabilities[a.choice]=.3;a.probabilities[other]=.7;}return raw;}})).rejects.toThrow();expect(warn).toHaveBeenCalledWith("lifepot.runtime.council_failure",expect.objectContaining({issues:expect.arrayContaining([expect.objectContaining({reason})])}));}finally{warn.mockRestore();}
});
it("does not turn a successful council into diagnostic noise",async()=>{
 const warn=vi.spyOn(console,"warn").mockImplementation(()=>{});
 try{const result=await runCouncil(summary(),client(0));expect(result.source).toBe("jev");expect(warn).not.toHaveBeenCalled();}finally{warn.mockRestore();}
});
