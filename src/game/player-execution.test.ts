import {createRunEvidence,observeRun} from './run-evidence';
import {describe,expect,it} from 'vitest';
import {createSimulation,type SimulationState} from './world';
import {defaultConfig} from './setup';
import {ENVIRONMENT_PRESSURES,type EnvironmentRules} from './rules';
import {acceptPlayerProposal,createPlayerProposalBinding,playerProposalAvailability,stepWithPlayerEvents} from './runtime';
import type {PlayerProposal} from './player-proposal';
const intent={world:'pond',threat:'drought',reward:'observe'};
export function proposal(pressure:EnvironmentRules['pressure']):PlayerProposal{return {version:1,source:'jev',model:'test',usage:{input_tokens:1,output_tokens:1},pressure,duration:6,evidence:{choice:pressure,confidence:.7,probabilities:Object.fromEntries(['unsupported',...ENVIRONMENT_PRESSURES].map(k=>[k,k===pressure?1:0]))}}}
function initial(){return createSimulation({seed:41,config:defaultConfig()})}
function accept(state:SimulationState,pressure:EnvironmentRules['pressure']){return acceptPlayerProposal({binding:createPlayerProposalBinding({runId:7,state,intent,ledger:[]}),runId:7,state,intent,ledger:[],playerEvents:[],proposal:proposal(pressure)})}
describe('player-directed deterministic pressure execution',()=>{
 it('executes contrasting proposals for exactly six ticks and restores pressure before the seventh',()=>{
  const state=initial(),before=JSON.stringify(state),a=accept(state,'nutrient_bloom'),b=accept(state,'drought');
  expect(JSON.stringify(state)).toBe(before);
  let bloom=state,drought=state;
  for(let tick=1;tick<=6;tick++){
   bloom=stepWithPlayerEvents(bloom,[],[a]);drought=stepWithPlayerEvents(drought,[],[b]);
   expect(bloom.generation).toBe(tick);expect(bloom.config.rules!.environment.pressure).toBe('nutrient_bloom');expect(drought.config.rules!.environment.pressure).toBe('drought');
   expect(playerProposalAvailability({state:bloom,ledger:[],playerEvents:[a]})).not.toBeNull();
  }
  expect(bloom.stats.resources).toBeGreaterThan(drought.stats.resources);
  bloom=stepWithPlayerEvents(bloom,[],[a]);expect(bloom.generation).toBe(7);expect(bloom.config.rules!.environment.pressure).toBe(state.config.rules!.environment.pressure);
  expect(JSON.stringify(state)).toBe(before);
 });
 it('records actual activation/restoration separately from automatic rules and never claims a future restoration',()=>{
  let state=initial(),evidence=createRunEvidence(state);const event=accept(state,'nutrient_bloom');
  expect(evidence).not.toHaveProperty('playerChanges');
  for(let tick=1;tick<=7;tick++){
   state=stepWithPlayerEvents(state,[],[event]);evidence=observeRun(evidence,state,[event]);
   expect(evidence.playerChanges).toEqual([{acceptedGeneration:0,activatedAt:1,restoredAt:tick>=7?7:null,pressure:'nutrient_bloom',previousPressure:event.previousPressure}]);
   expect(evidence.ruleEvents).toEqual([]);
  }
 });
});
