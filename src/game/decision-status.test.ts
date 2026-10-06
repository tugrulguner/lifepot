import {expect,it} from "vitest";
import {decodeDecisionResponse} from "./decision-status";
import {createSimulation} from "./world";
import {defaultConfig} from "./setup";
import {deterministicEvolutionDecision,summarizeEcology} from "./decisions";
it("keeps failure provenance outside the replay decision contract",()=>{
 const summary=summarizeEcology(createSimulation({seed:7,config:defaultConfig()}),{world:"x",threat:"y",reward:"z"},"stagnation");
 const original=deterministicEvolutionDecision({...summary,generation:12});
 const decoded=decodeDecisionResponse({...original,fallbackReason:"rate_limited",provenance:{outcome:"abstained",reason:"rate_limited"}});
 expect(decoded.decision).toEqual(original);expect(decoded.reason).toBe("rate_limited");
});
