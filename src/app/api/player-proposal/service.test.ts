import { describe, expect, it, vi } from "vitest";
import { createPlayerProposalService } from "./service";
import { defaultConfig } from "@/game/setup";
import { ENVIRONMENT_PRESSURES } from "@/game/rules";

const config = defaultConfig();
const wire = () => ({model:'fixture',usage:{input_tokens:1,output_tokens:1},answers:{pressure:{type:'choice',choice:'drought',confidence:.4,probabilities:Object.fromEntries(['unsupported',...ENVIRONMENT_PRESSURES].map(k=>[k,k==='drought'?1:0]))}}});
for(const kind of ['palette','sum','maximum','usage','unknown_answer'] as const)it(`rejects malformed provider ${kind} evidence`,async()=>{
 const raw=wire();
 if(kind==='palette'){delete raw.answers.pressure.probabilities.stability;raw.answers.pressure.probabilities['stability,unsupported']=0;}
 if(kind==='sum')raw.answers.pressure.probabilities.drought=.4;
 if(kind==='maximum'){raw.answers.pressure.probabilities.drought=.4;raw.answers.pressure.probabilities.stability=.6;}
 if(kind==='usage')raw.usage.input_tokens=-1;
 if(kind==='unknown_answer')Object.assign(raw.answers,{foreign:raw.answers.pressure});
 const service=createPlayerProposalService({client:{systemOne:async()=>raw}}),reserve=vi.fn(async()=>{});
 expect(await service({request:'Temporarily reduce nutrients',generation:0,config},reserve)).toEqual({error:'invalid_response'});expect(reserve).toHaveBeenCalledTimes(1);
});
it('does not invoke the provider after a denied reservation',async()=>{
 const provider=vi.fn(async()=>wire());const service=createPlayerProposalService({client:{systemOne:provider}});
 expect(await service({request:'Temporarily reduce nutrients',generation:0,config},async()=>{throw new Error('rate limit exceeded')})).toEqual({error:'rate_limited'});expect(provider).not.toHaveBeenCalled();
});
describe("player proposal service", () => {
  it("makes a genuine named choice across supported temporary pressures", async () => {
    const client = { systemOne: vi.fn(async (request: { questions: { pressure: { criteria: Record<string, string> } }; state: { current_pressure: string } }) => {
      const criteria = request.questions.pressure.criteria;
      const keys = Object.keys(criteria);
      const selected = request.state.current_pressure === "drought" ? "nutrient_bloom" : "drought";
      return { model: "jev-fixture", usage: { input_tokens: 12, output_tokens: 3 }, answers: { pressure: { type: "choice", choice: selected, confidence: .8, probabilities: Object.fromEntries(keys.map(k => [k, k === selected ? .8 : .2 / (keys.length - 1)])) } } };
    }) };
    const service = createPlayerProposalService({ client: client as never });
    const request = { request: "Try nutrient abundance", generation: 20, config: { ...config, rules: { ...config.rules!, environment: { ...config.rules!.environment, pressure: "drought" } } } };
    const result = await service(request, async () => {});
    expect(result).toMatchObject({ outcome: "proposed" });
    expect(client.systemOne).toHaveBeenCalledTimes(1);
    expect(Object.keys(client.systemOne.mock.calls[0][0].questions.pressure.criteria)).toEqual(["unsupported", ...ENVIRONMENT_PRESSURES]);
  });
});
