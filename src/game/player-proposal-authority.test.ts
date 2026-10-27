import { describe, expect, it } from "vitest";
import {createPlayerProposalBinding,acceptPlayerProposal} from "./runtime";
import {ENVIRONMENT_PRESSURES} from './rules';
import {deterministicEvolutionDecision,summarizeEcology} from './decisions';
import type {PlayerProposal} from './player-proposal';
import { createSimulation, snapshotSimulation } from "./world";
import { defaultConfig } from "./setup";

const intent = { world: "pond", threat: "drought", reward: "coexist" };
const proposal:PlayerProposal={version:1,source:'jev',model:'test',usage:{input_tokens:1,output_tokens:1},pressure:'nutrient_bloom',duration:6,evidence:{choice:'nutrient_bloom',confidence:.7,probabilities:Object.fromEntries(['unsupported',...ENVIRONMENT_PRESSURES].map(k=>[k,k==='nutrient_bloom'?1:0]))}};
for(const mutation of ['rng','occupied','energy','identity','resources','config','run'] as const)it(`rejects stale authority after ${mutation} changes`,()=>{
 const state=createSimulation({seed:41,config:defaultConfig()}),input={runId:7,state,intent,ledger:[],playerEvents:[]},binding=createPlayerProposalBinding(input);
 if(mutation==='rng')state.rngState++;
 if(mutation==='occupied')state.occupied[0]^=1;
 if(mutation==='energy')state.energy[0]++;
 if(mutation==='identity')state.nextOrganismId++;
 if(mutation==='resources')state.resources[0]++;
 if(mutation==='config')state.config.fitness.adapt=.1234;
 if(mutation==='run')input.runId++;
 expect(()=>acceptPlayerProposal({...input,binding,proposal})).toThrow('Stale');
});
it('refuses no-op pressure, reused authority and the shared eight-record ceiling',()=>{
 const state=createSimulation({seed:41,config:defaultConfig()}),input={runId:7,state,intent,ledger:[],playerEvents:[]},binding=createPlayerProposalBinding(input),before=JSON.stringify(state);
 const accepted=acceptPlayerProposal({...input,binding,proposal});
 expect(JSON.stringify(state)).toBe(before);
 expect(()=>acceptPlayerProposal({...input,binding,proposal,playerEvents:[accepted]})).toThrow();
 const same=state.config.rules!.environment.pressure;
 expect(()=>acceptPlayerProposal({...input,binding,proposal:{...proposal,pressure:same,evidence:{choice:same,confidence:.5,probabilities:Object.fromEntries(['unsupported',...ENVIRONMENT_PRESSURES].map(k=>[k,k===same?1:0]))}}})).toThrow('would not change');
 const decision=deterministicEvolutionDecision(summarizeEcology({...state,generation:12},intent,'resource_shift')),full={...input,ledger:Array(8).fill(decision)};
 expect(()=>acceptPlayerProposal({...full,binding:createPlayerProposalBinding(full),proposal})).toThrow('eight');
});

describe("player-directed proposal authority", () => {
  it("binds a proposal to one exact paused world and the existing decision budget", () => {
    const state = createSimulation({ seed: 41, config: defaultConfig() });
    const before = snapshotSimulation(state);
    const binding = createPlayerProposalBinding({
      runId: 7,
      state,
      intent,
      ledger: [],
    });

    expect(binding).toMatchObject({
      runId: 7,
      generation: state.generation,
      ruleGraphVersion: state.config.rules?.version,
      remainingLedgerEntries: 8,
    });
    expect(binding.worldFingerprint).toMatch(/^world_[a-z0-9]+$/);
    expect(snapshotSimulation(state)).toEqual(before);
  });
});
