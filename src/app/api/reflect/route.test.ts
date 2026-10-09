import { describe, expect, it, vi } from "vitest";
import { createReflectHandler } from "./route";
import { createSimulation, type LifeConfig } from "@/game/world";
import { createRunEvidence } from "@/game/run-evidence";
import { defaultConfig } from "@/game/setup";
const config:LifeConfig=defaultConfig();
describe("reflection endpoint security",()=>{
 it("accepts complete engine evidence and reserves both budgets before Jev",async()=>{
  const order:string[]=[];const reflection={observations:[{text:"Observed population",evidenceRefs:["population"]}],nextExperiment:{title:"Try scarce food",rationale:"Compare trajectories",evidenceRefs:["population"],changes:[{path:"environment.abundance" as const,value:"scarce"}]},caveat:"Policies can differ"};
  const reflect=vi.fn(async()=>{order.push("reflect");return reflection;});
  const evidence=createRunEvidence(createSimulation({seed:1,config}));
  const handler=createReflectHandler({limit:async key=>{order.push(key);return true;},reflect});
  const response=await handler(new Request("http://localhost/api/reflect",{method:"POST",headers:{"cf-connecting-ip":"1.2.3.4"},body:JSON.stringify({evidence,config})}));
  expect(response.status).toBe(200);expect(order).toEqual(["reflect:1.2.3.4","reflect:global","reflect"]);
 });
 it("reserves IP and global limits before invoking service and strips private question",async()=>{const order:string[]=[];const reflect=vi.fn(async(input:unknown)=>{order.push("reflect");expect(input).not.toHaveProperty("privateQuestion");return {ok:true};});const evidence=createRunEvidence(createSimulation({seed:1,config}));const handler=createReflectHandler({limit:async key=>{order.push(key);return true;},reflect:reflect as never});const response=await handler(new Request("http://localhost/api/reflect",{method:"POST",headers:{"content-type":"application/json","cf-connecting-ip":"1.2.3.4"},body:JSON.stringify({evidence,config,privateQuestion:"secret"})}));expect(response.status).toBe(400);expect(order).toEqual([]);expect(reflect).not.toHaveBeenCalled();});
 it("rejects malformed evidence without invoking service",async()=>{const reflect=vi.fn();const handler=createReflectHandler({limit:async()=>true,reflect:reflect as never});const response=await handler(new Request("http://localhost/api/reflect",{method:"POST",body:JSON.stringify({evidence:{samples:[]},config})}));expect(response.status).toBe(400);expect(reflect).not.toHaveBeenCalled();});
 it("reports only bounded stage and error class when reflection fails",async()=>{const diagnostics:Array<{stage:string;errorClass:string}>=[];const secret="raw provider payload secret";const evidence=createRunEvidence(createSimulation({seed:1,config}));const handler=createReflectHandler({limit:async()=>true,reflect:async()=>{throw new SyntaxError(secret);},diagnostic:event=>diagnostics.push(event)});const response=await handler(new Request("http://localhost/api/reflect",{method:"POST",body:JSON.stringify({evidence,config})}));expect(response.status).toBe(503);expect(diagnostics).toEqual([{stage:"reflection",errorClass:"SyntaxError"}]);expect(JSON.stringify(diagnostics)).not.toContain(secret);});
 it("classifies limiter failure separately without exposing exception text",async()=>{const diagnostics:Array<{stage:string;errorClass:string}>=[];const evidence=createRunEvidence(createSimulation({seed:1,config}));const handler=createReflectHandler({limit:async()=>{throw new Error("private detail");},diagnostic:event=>diagnostics.push(event)});const response=await handler(new Request("http://localhost/api/reflect",{method:"POST",body:JSON.stringify({evidence,config})}));expect(response.status).toBe(503);expect(diagnostics).toEqual([{stage:"rate_limit",errorClass:"Error"}]);});
});
