import {it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {createElement} from "react";
import {RuntimeCouncil} from "./CouncilPanel";
import {defaultConfig} from "@/game/setup";
import {createSimulation} from "@/game/world";
import {summarizeEcology} from "@/game/decisions";
import {runCouncil} from "@/app/api/judge/council-service";
it("discloses corrected rejected usage and the shared one-response allowance",async()=>{
 const config=defaultConfig();config.rules!.council={version:1,members:[{id:"birth_A",responsibility:"birth_policy",scope:"A",activation:"always"},{id:"self_A",responsibility:"self_interaction",scope:"A",activation:"always"}]};const state=createSimulation({seed:1,config});const summary={...summarizeEcology(state,{world:"pond",threat:"drought",reward:"coexist"},"stagnation"),generation:12};let calls=0;const decision=await runCouncil(summary,{async systemOne(request){calls++;return {model:"fixture",usage:{input_tokens:10,output_tokens:2},answers:Object.fromEntries(Object.entries(request.questions).map(([key,q])=>{const options=Object.keys(q.criteria),choice=key==="selectedPatch"?"none":options[0];return [key,{type:"choice",choice,confidence:calls===1?2:1,probabilities:Object.fromEntries(options.map(v=>[v,v===choice?1:0]))}]}))};}});
 const html=renderToStaticMarkup(createElement(RuntimeCouncil,{decision,state,ledger:[],replay:false}));expect(html).toContain("Protocol correction:");expect(html).toContain("one fresh model response");expect(html).toContain("included in total usage");expect(html).toContain("Unrecovered failed-call usage is unavailable");
});
