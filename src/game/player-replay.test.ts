import {expect,test} from 'vitest';
import {createReplay,decodeReplay,encodeReplay,playReplay} from './replay';
import {createSimulation} from './world';
import {defaultConfig,hashSetupRequest} from './setup';
import {ENVIRONMENT_PRESSURES} from './rules';
import {acceptPlayerProposal,createPlayerProposalBinding,detectDecisionTriggerForRun,stepWithPlayerEvents} from './runtime';
import {deterministicEvolutionDecision,summarizeEcology,type EvolutionLedger} from './decisions';
const answers={world:'pond',threat:'drought',reward:'observe'};
function played(){
 const config=defaultConfig(),initial=createSimulation({seed:41,config}),ledger:EvolutionLedger=[];
 const event=acceptPlayerProposal({runId:1,state:initial,intent:answers,ledger,playerEvents:[],binding:createPlayerProposalBinding({runId:1,state:initial,intent:answers,ledger}),proposal:{version:1,source:'jev',model:'fixture',usage:{input_tokens:1,output_tokens:1},pressure:'nutrient_bloom',duration:6,evidence:{choice:'nutrient_bloom',confidence:.5,probabilities:Object.fromEntries(['unsupported',...ENVIRONMENT_PRESSURES].map(k=>[k,k==='nutrient_bloom'?1:0]))}}});
 const playerEvents=[event];let state=initial;
 while(state.outcome==='running'){
  const trigger=detectDecisionTriggerForRun(state,ledger,playerEvents);if(trigger)ledger.push(deterministicEvolutionDecision(summarizeEcology(state,answers,trigger)));
  state=stepWithPlayerEvents(state,ledger,playerEvents);
 }
 return {config,state,ledger,playerEvents};
}
test('v4 roundtrip reproduces a complete player-authorized run without pretending it is an ecology decision',async()=>{
 const run=played();const replay=createReplay({answers,config:run.config,seed:41,requestHash:hashSetupRequest(answers),ledger:run.ledger,playerEvents:run.playerEvents});
 expect(replay.version).toBe(4);expect(run.ledger.length+run.playerEvents.length).toBeLessThanOrEqual(8);
 const decoded=decodeReplay(encodeReplay(replay));const result=await playReplay(decoded);expect(result.state).toEqual(run.state);
 expect(JSON.stringify(replay)).not.toContain('player_request');
});
