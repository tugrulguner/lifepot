import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createSimulation,stepSimulation,type SimulationState} from './world';
import {defaultConfig,hashSetupRequest,lifeConfigSchema,hashReplayPayload} from './setup';
import {deterministicEvolutionDecision,summarizeEcology,type EvolutionLedger} from './decisions';
import {runFreshWithDecisions,runWithDecisionLedger,detectDecisionTriggerForRun,stepWithPlayerEvents,acceptPlayerProposal,createPlayerProposalBinding} from './runtime';
import {createRunEvidence,observeRun} from './run-evidence';
import {ENVIRONMENT_PRESSURES} from './rules';
import {createReplay,decodeReplay,inspectReplayAtGeneration} from './replay';

const answers={world:'A pond',threat:'Drought',reward:'Observe families'};

it('reconstructs the exact recorded state and observed ledger at an inclusive generation without mutating the replay',async()=>{
 const config=defaultConfig(),seed=7,initial=createSimulation({seed,config});
 const run=await runFreshWithDecisions(initial,answers,async summary=>deterministicEvolutionDecision(summary));
 const replay=createReplay({answers,config,seed,requestHash:hashSetupRequest(answers),ledger:run.ledger});
 for(const invalid of [-1,0.5,181,Number.NaN,Number.POSITIVE_INFINITY])expect(()=>inspectReplayAtGeneration(replay,invalid)).toThrow(/generation|outside/i);
 let expected=createSimulation({seed,config}),evidence=createRunEvidence(expected);
 const prefix=run.ledger.filter(decision=>decision.generation<24);
 while(expected.generation<24&&expected.outcome==='running'){
  expected=stepSimulation(expected,prefix.filter(d=>d.generation<=expected.generation).at(-1),prefix);
  evidence=observeRun(evidence,expected);
 }
 const before=JSON.stringify(replay);
 const inspected=inspectReplayAtGeneration(replay,24);
 expect(inspected.state).toStrictEqual(expected);
 expect(inspected.evidence).toStrictEqual(evidence);
 expect(JSON.stringify(replay)).toBe(before);
});

it('inspects a legacy engine recording without substituting current-engine behavior',()=>{
 const legacy=JSON.parse(readFileSync(new URL('./fixtures/ca7-replay.json',import.meta.url),'utf8'));
 const replay=decodeReplay(btoa(JSON.stringify(legacy)));
 const expected=runWithDecisionLedger(createSimulation({seed:replay.seed,config:replay.config,engineVersion:replay.engineVersion}),replay.ledger.filter(decision=>decision.generation<12),12,replay.answers);
 const inspected=inspectReplayAtGeneration(replay,12);
 expect(replay.engineVersion).toBe('lifepot-ca-7');
 expect(inspected.state).toStrictEqual(expected);
});

it('reconstructs player-directed generations with the recorded pressure event and evidence',async()=>{
 const config=defaultConfig(),seed=41,initial=createSimulation({seed,config}),ledger:EvolutionLedger=[];
 const playerEvents=[acceptPlayerProposal({runId:1,state:initial,intent:answers,ledger,playerEvents:[],binding:createPlayerProposalBinding({runId:1,state:initial,intent:answers,ledger}),proposal:{version:1,source:'jev',model:'fixture',usage:{input_tokens:1,output_tokens:1},pressure:'nutrient_bloom',duration:6,evidence:{choice:'nutrient_bloom',confidence:1,probabilities:Object.fromEntries(['unsupported',...ENVIRONMENT_PRESSURES].map(value=>[value,value==='nutrient_bloom'?1:0]))}}})];
 let state:SimulationState=initial,evidence=createRunEvidence(initial),expectedState:SimulationState|undefined,expectedEvidence:ReturnType<typeof createRunEvidence>|undefined;
 while(state.outcome==='running'){
  const trigger=detectDecisionTriggerForRun(state,ledger,playerEvents);
  if(trigger)ledger.push(deterministicEvolutionDecision(summarizeEcology(state,answers,trigger)));
  state=stepWithPlayerEvents(state,ledger,playerEvents);
  evidence=observeRun(evidence,state,playerEvents);
  if(state.generation===8){expectedState=state;expectedEvidence=evidence;}
 }
 const replay=createReplay({answers,config,seed,requestHash:hashSetupRequest(answers),ledger,playerEvents});
 const inspected=inspectReplayAtGeneration(replay,8);
 expect(inspected.state).toStrictEqual(expectedState);
 expect(inspected.evidence).toStrictEqual(expectedEvidence);
 expect(inspected.evidence.playerChanges).toEqual([{acceptedGeneration:0,activatedAt:1,restoredAt:7,pressure:'nutrient_bloom',previousPressure:playerEvents[0].previousPressure}]);
});

it('still rejects replay tampering rather than inspecting a permissive prefix',async()=>{
 const config=defaultConfig(),seed=7,run=await runFreshWithDecisions(createSimulation({seed,config}),answers,async summary=>deterministicEvolutionDecision(summary));
 const replay=createReplay({answers,config,seed,requestHash:hashSetupRequest(answers),ledger:run.ledger});
 const corrupt=structuredClone(replay);
 expect(corrupt.ledger.length).toBeGreaterThan(0);
 corrupt.ledger.at(-1)!.observationHash='eco_future_corruption';
 const {contractHash,...body}=corrupt;expect(contractHash).toBeTruthy();corrupt.contractHash=hashReplayPayload(body);
 expect(()=>inspectReplayAtGeneration(corrupt,2)).toThrow(/invalid|tampered|unsupported|decision/i);
});

it('rejects invalid targets and generations beyond an observed extinction',async()=>{
 const config=lifeConfigSchema.parse({environment:{abundance:'balanced',distribution:'scattered',hazard:'drought',volatility:'stable'},fitness:{survive:.2,replicate:.2,cooperate:.2,explore:.2,adapt:.2},founders:{balance:'balanced',diversity:'varied',preyStrategy:'efficient_grazing',predatorStrategy:'pursuit'},rules:{version:1,species:[{id:'A',role:'grazer',selfInteraction:'cooperative'},{id:'B',role:'hunter',selfInteraction:'territorial'}],interactions:[{pair:'A:B',mode:'b_consumes_a'}],environment:{regeneration:'steady',pressure:'stability',volatility:'stable',intensity:'medium',duration:'persistent'}}});
 const seed=113,initial=createSimulation({seed,config});
 const run=await runFreshWithDecisions(initial,answers,async summary=>deterministicEvolutionDecision(summary));
 expect(run.state.outcome).toBe('extinct');
 const replay=createReplay({answers,config,seed,requestHash:hashSetupRequest(answers),ledger:run.ledger});
 expect(()=>inspectReplayAtGeneration(replay,run.state.generation+1)).toThrow(/outside this recording/);
 expect(inspectReplayAtGeneration(replay,run.state.generation).state).toStrictEqual(run.state);
});

it('keeps evidence descriptions tied to recorded facts and species identity',async()=>{
 const config=defaultConfig(),seed=7,initial=createSimulation({seed,config});
 const run=await runFreshWithDecisions(initial,answers,async summary=>deterministicEvolutionDecision(summary));
 const replay=createReplay({answers,config,seed,requestHash:hashSetupRequest(answers),ledger:run.ledger});
 const inspected=inspectReplayAtGeneration(replay,12);
 expect(inspected.evidence.samples.map(sample=>sample.generation)).toEqual(Array.from({length:13},(_,g)=>g));
});
