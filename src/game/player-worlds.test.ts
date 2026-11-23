// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from 'vitest';
import {IDBFactory} from 'fake-indexeddb';
import {saveWorld,exportWorld,deleteWorld,importWorld,listWorlds} from './my-worlds';
import {createReplay,playReplay} from './replay';
import {defaultConfig,hashSetupRequest} from './setup';
import {ENVIRONMENT_PRESSURES} from './rules';
import {acceptPlayerProposal,createPlayerProposalBinding,detectDecisionTriggerForRun,stepWithPlayerEvents} from './runtime';
import {deterministicEvolutionDecision,summarizeEcology,type EvolutionLedger} from './decisions';
import {createSimulation} from './world';
const answers={world:'pond',threat:'drought',reward:'observe'};
beforeEach(()=>vi.stubGlobal('indexedDB',new IDBFactory()));
function run(){
 const config=defaultConfig(),seed=41,initial=createSimulation({seed,config}),ledger:EvolutionLedger=[];
 const event=acceptPlayerProposal({runId:1,state:initial,intent:answers,ledger,playerEvents:[],binding:createPlayerProposalBinding({runId:1,state:initial,intent:answers,ledger}),proposal:{version:1,source:'jev',model:'fixture',usage:{input_tokens:1,output_tokens:1},pressure:'nutrient_bloom',duration:6,evidence:{choice:'nutrient_bloom',confidence:.5,probabilities:Object.fromEntries(['unsupported',...ENVIRONMENT_PRESSURES].map(k=>[k,k==='nutrient_bloom'?1:0]))}}});
 const events=[event];let state=initial;
 while(state.outcome==='running'){const trigger=detectDecisionTriggerForRun(state,ledger,events);if(trigger)ledger.push(deterministicEvolutionDecision(summarizeEcology(state,answers,trigger)));state=stepWithPlayerEvents(state,ledger,events);}
 return {config,seed,state,ledger,events};
}
it('saves, exports, deletes, imports and reopens a real v4 player-directed world',async()=>{
 const r=run(), replay=createReplay({answers,config:r.config,seed:r.seed,requestHash:hashSetupRequest(answers),ledger:r.ledger,playerEvents:r.events});
 if(replay.version!==4)throw new Error("Expected v4");const result=await playReplay(replay);let evidence=(await import('./run-evidence')).createRunEvidence(createSimulation({seed:r.seed,config:r.config}));let state=createSimulation({seed:r.seed,config:r.config});while(state.outcome==='running'){state=stepWithPlayerEvents(state,replay.ledger,replay.playerEvents);evidence=(await import('./run-evidence')).observeRun(evidence,state,replay.playerEvents);}const record=await saveWorld({replay,evidence,outcome:result.state.outcome as 'surviving'|'thriving'|'extinct',stopReason:result.state.outcome==='extinct'?'World empty':'Observation horizon reached',parentId:null,policy:'recorded'},'Directed world');
 const exported=exportWorld(record);expect(exported).not.toContain('privateQuestion');await deleteWorld(record.id);const imported=await importWorld(exported);
 expect(imported.id).toBe(record.id);expect((await listWorlds()).map(x=>x.id)).toEqual([record.id]);expect((await playReplay(imported.replay)).state).toEqual(result.state);
},30000);
it('rejects forged player-change metadata and a modified world fingerprint',async()=>{
 const r=run(),replay=createReplay({answers,config:r.config,seed:r.seed,requestHash:hashSetupRequest(answers),ledger:r.ledger,playerEvents:r.events});if(replay.version!==4)throw new Error("Expected v4");const result=await playReplay(replay);
 const {createRunEvidence,observeRun}=await import('./run-evidence');let evidence=createRunEvidence(createSimulation({seed:r.seed,config:r.config}));let state=createSimulation({seed:r.seed,config:r.config});
 while(state.outcome==='running'){state=stepWithPlayerEvents(state,replay.ledger,replay.playerEvents);evidence=observeRun(evidence,state,replay.playerEvents);}
 const record=await saveWorld({replay,evidence,outcome:result.state.outcome as 'surviving'|'thriving'|'extinct',stopReason:result.state.outcome==='extinct'?'World empty':'Observation horizon reached',parentId:null,policy:'recorded'},'Directed');const tampered=JSON.parse(exportWorld(record));await deleteWorld(record.id);
 const forged=structuredClone(tampered);forged.evidence.playerChanges[0].acceptedGeneration=9;await expect(importWorld(JSON.stringify(forged))).rejects.toThrow(/invalid/i);
 const badReplay=structuredClone(replay);badReplay.playerEvents[0].worldFingerprint='world_'+'0'.repeat(64); // envelope deliberately remains unchanged
 const changed=structuredClone(tampered);changed.replay=JSON.stringify({...badReplay,contractHash:replay.contractHash});await expect(importWorld(JSON.stringify(changed))).rejects.toThrow(/invalid/i);
 expect(await listWorlds()).toEqual([]);
},30000);
