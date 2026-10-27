import {sha256} from '@noble/hashes/sha2.js';
import {DEFAULT_GENERATIONS,ENGINE_VERSION,stepSimulation,type SimulationState} from './world';
import {applyRulePatch} from './rules';
import {validatePlayerEvents,validatePlayerProposal,type PlayerProposal,type AcceptedPlayerEvent} from './player-proposal';
import {validateSpeciesDirectives,detectEvolutionTrigger,deterministicEvolutionDecision,observationHash,summarizeEcology,validateEvolutionDecision,type EcologySummary,type EvolutionDecision,type EvolutionLedger} from './decisions';
import type {SetupAnswers} from './setup';
export type {AcceptedPlayerEvent} from './player-proposal';
export type EvolutionDecider=(summary:EcologySummary)=>Promise<unknown>;
function fingerprint(value:unknown){
 const text=JSON.stringify(value,(_key,v)=>ArrayBuffer.isView(v)?Array.from(v as unknown as ArrayLike<number>):v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 return Array.from(sha256(new TextEncoder().encode(text)),b=>b.toString(16).padStart(2,'0')).join('');
}
export function worldFingerprint(state:SimulationState){return `world_${fingerprint(state)}`}
export type PlayerProposalBinding={runId:number;generation:number;ruleGraphVersion:number;remainingLedgerEntries:number;worldFingerprint:string;stateFingerprint:string;ledgerFingerprint:string;token:string};
type AuthorityInput={runId:number;state:SimulationState;intent:SetupAnswers;ledger:readonly EvolutionDecision[];playerEvents?:readonly AcceptedPlayerEvent[]};
export function createPlayerProposalBinding(input:AuthorityInput):PlayerProposalBinding{
 const stateFingerprint=fingerprint(input.state),ledgerFingerprint=fingerprint({ledger:input.ledger,playerEvents:input.playerEvents??[],intent:input.intent});
 return {runId:input.runId,generation:input.state.generation,ruleGraphVersion:input.state.config.rules!.version,remainingLedgerEntries:Math.max(0,8-input.ledger.length-(input.playerEvents?.length??0)),worldFingerprint:worldFingerprint(input.state),stateFingerprint,ledgerFingerprint,token:fingerprint({runId:input.runId,stateFingerprint,ledgerFingerprint})};
}
export function playerInterventionPending(state:SimulationState,events:readonly AcceptedPlayerEvent[]){return events.some(e=>e.acceptedGeneration<=state.generation&&state.generation<e.generation+6)}
function pendingAdaptivePatch(state:SimulationState,ledger:readonly EvolutionDecision[]){return Boolean(state.activeRuleChange)||ledger.some(d=>d.generation<=state.generation&&d.scheduledRuleChange&&!state.appliedRuleChanges.includes(d.generation))}
export function playerProposalAvailability(input:Pick<AuthorityInput,'state'|'ledger'|'playerEvents'>):string|null{
 const {state,ledger,playerEvents=[]}=input;
 if(state.outcome!=='running'||state.generation>=DEFAULT_GENERATIONS)return 'This world has finished.';
 if(state.engineVersion!==ENGINE_VERSION)return 'Older engines are replay-only for player changes.';
 if(ledger.length+playerEvents.length>=8)return 'All eight shared decision slots are used.';
 if(playerInterventionPending(state,playerEvents))return 'Wait for the accepted player change to restore its previous pressure.';
 if(pendingAdaptivePatch(state,ledger))return 'An adaptive rule change is queued or active. Wait until it finishes.';
 if(detectEvolutionTrigger(state,ledger)&&!ledger.some(d=>d.generation===state.generation))return 'Wait for the current ecological decision.';
 return null;
}
export function acceptPlayerProposal(input:AuthorityInput&{binding:PlayerProposalBinding;proposal:PlayerProposal}):AcceptedPlayerEvent{
 const current=createPlayerProposalBinding(input);
 if(current.token!==input.binding.token)throw new Error('Stale player proposal binding');
 const unavailable=playerProposalAvailability(input);if(unavailable)throw new Error(unavailable);
 const proposal=validatePlayerProposal(input.proposal),pressure=input.state.config.rules!.environment.pressure;
 if(proposal.pressure===pressure)throw new Error('Player proposal would not change pressure');
 return {actor:'player',generation:current.generation+1,acceptedGeneration:current.generation,worldFingerprint:current.worldFingerprint,ruleGraphVersion:current.ruleGraphVersion,previousPressure:pressure,proposal};
}
export function validateEvolutionLedger(input:unknown):EvolutionLedger{if(!Array.isArray(input)||input.length>8)throw new Error('Invalid evolution decision ledger');const ledger=input.map(validateEvolutionDecision);for(let i=1;i<ledger.length;i++)if(ledger[i].generation-ledger[i-1].generation<12)throw new Error('Invalid evolution decision ledger order or cooldown');return ledger;}
export function activeDecisionForGeneration(ledger:readonly EvolutionDecision[],generation:number){let active:EvolutionDecision|undefined;for(const d of ledger){if(d.generation>generation)break;active=d;}return active;}
function exactDecision(state:SimulationState,intent:SetupAnswers,trigger:ReturnType<typeof detectEvolutionTrigger>,candidate:EvolutionDecision){if(!trigger)throw new Error('No trigger');const summary=summarizeEcology(state,intent,trigger);if(candidate.generation!==state.generation||candidate.trigger!==trigger||candidate.observationHash!==observationHash(summary.observation)||candidate.ruleGraphVersion!==state.config.rules?.version)throw new Error('Decision does not match frozen observation or rule graph');validateSpeciesDirectives(candidate,state.config.rules!);return candidate;}
export function detectDecisionTriggerForRun(state:SimulationState,ledger:readonly EvolutionDecision[],playerEvents:readonly AcceptedPlayerEvent[]=[]){
 if(playerInterventionPending(state,playerEvents)||ledger.length+playerEvents.filter(e=>e.acceptedGeneration<=state.generation).length>=8)return null;
 return detectEvolutionTrigger(state,ledger);
}
// New player events enter as explicit inputs, never forged ecological decisions.
// Old recordings call stepSimulation without an override and remain unchanged.
export function stepWithPlayerEvents(state:SimulationState,ledger:readonly EvolutionDecision[],input:readonly AcceptedPlayerEvent[]):SimulationState{
 if(!input.length)return stepSimulation(state,activeDecisionForGeneration(ledger,state.generation),ledger);
 const events=validatePlayerEvents(input);
 if(state.engineVersion!==ENGINE_VERSION||events.length+ledger.length>8)throw new Error('Invalid player event engine or shared budget');
 if(state.outcome!=='running')return state;
 const nextGeneration=state.generation+1,starting=events.find(e=>e.generation===nextGeneration);
 let prepared=state;
 if(starting){
  if(starting.worldFingerprint!==worldFingerprint(state)||starting.ruleGraphVersion!==state.config.rules!.version||starting.previousPressure!==state.config.rules!.environment.pressure||pendingAdaptivePatch(state,ledger))throw new Error('Player event does not match its accepted world');
  prepared={...state,config:{...state.config,rules:applyRulePatch(state.config.rules!,{kind:'environment',field:'pressure',value:starting.proposal.pressure})}};
 }
 const ending=events.find(e=>e.generation+6===nextGeneration);
 if(ending)prepared={...prepared,config:{...prepared.config,rules:applyRulePatch(prepared.config.rules!,{kind:'environment',field:'pressure',value:ending.previousPressure})}};
 const active=events.find(e=>e.generation<=nextGeneration&&nextGeneration<e.generation+6);
 const intensity=prepared.config.rules!.environment.intensity;
 return stepSimulation(prepared,activeDecisionForGeneration(ledger,state.generation),ledger,active?{pressure:active.proposal.pressure,power:intensity==='low'?.45:intensity==='medium'?.8:1.2}:undefined);
}
export function advanceUntilDecisionTrigger(state:SimulationState,ledger:readonly EvolutionDecision[],maxSteps:number,onStep?:(state:SimulationState)=>void,playerEvents:readonly AcceptedPlayerEvent[]=[]):SimulationState{
 let next=state;for(let i=0;i<Math.max(0,Math.floor(maxSteps))&&next.outcome==='running';i++){
  const past=ledger.filter(d=>d.generation<=next.generation),trigger=detectDecisionTriggerForRun(next,past,playerEvents);
  if(trigger&&!past.some(d=>d.generation===next.generation))break;
  next=stepWithPlayerEvents(next,past,playerEvents);onStep?.(next);
 }return next;
}
export const advanceUntilDecisionEpoch=advanceUntilDecisionTrigger;
export async function runFreshWithDecisions(initial:SimulationState,intent:SetupAnswers,decide:EvolutionDecider,generations=DEFAULT_GENERATIONS):Promise<{state:SimulationState;ledger:EvolutionLedger}>{let state=initial;const ledger:EvolutionLedger=[];const target=Math.min(DEFAULT_GENERATIONS,state.generation+Math.max(0,Math.floor(generations)));while(state.generation<target&&state.outcome==='running'){const trigger=detectEvolutionTrigger(state,ledger);if(trigger){const summary=summarizeEcology(state,intent,trigger);let decision:EvolutionDecision;try{decision=exactDecision(state,intent,trigger,validateEvolutionDecision(await decide(summary)));}catch{decision=deterministicEvolutionDecision(summary);}ledger.push(decision);}state=stepSimulation(state,activeDecisionForGeneration(ledger,state.generation),ledger);}return{state,ledger};}
export function runWithDecisionLedger(initial:SimulationState,input:unknown,generations=DEFAULT_GENERATIONS,intent:SetupAnswers={world:'replay',threat:'replay',reward:'replay'}):SimulationState{const ledger=validateEvolutionLedger(input);let state=initial,index=0;const accepted:EvolutionLedger=[];const target=Math.min(DEFAULT_GENERATIONS,state.generation+Math.max(0,Math.floor(generations)));while(state.generation<target&&state.outcome==='running'){const trigger=detectEvolutionTrigger(state,accepted);if(trigger){const decision=ledger[index];if(!decision)throw new Error(`Replay is missing ${trigger} decision at generation ${state.generation}`);exactDecision(state,intent,trigger,decision);accepted.push(decision);index++;}else if(ledger[index]?.generation===state.generation)throw new Error('Replay decision is reordered or has no canonical trigger');state=stepSimulation(state,activeDecisionForGeneration(accepted,state.generation),accepted);}if(index!==ledger.length)throw new Error('Replay contains unreachable or reordered decisions');return state;}
export function runWithPlayerEvents(initial:SimulationState,input:unknown,eventInput:unknown,intent:SetupAnswers):SimulationState{
 const ledger=validateEvolutionLedger(input),events=validatePlayerEvents(eventInput);if(!events.length||ledger.length+events.length>8)throw new Error('Invalid player replay budget');
 let state=initial,index=0,eventIndex=0;const accepted:EvolutionLedger=[],acceptedEvents:AcceptedPlayerEvent[]=[];
 while(state.outcome==='running'&&state.generation<DEFAULT_GENERATIONS){
  const trigger=detectDecisionTriggerForRun(state,accepted,acceptedEvents);
  if(trigger){const decision=ledger[index];if(!decision)throw new Error('Player replay is missing an ecological decision');exactDecision(state,intent,trigger,decision);accepted.push(decision);index++}
  else if(ledger[index]?.generation===state.generation)throw new Error('Unexpected ecological decision in player replay');
  if(events[eventIndex]?.acceptedGeneration===state.generation){
   const event=events[eventIndex];const reason=playerProposalAvailability({state,ledger:accepted,playerEvents:acceptedEvents});if(reason)throw new Error(reason);
   acceptedEvents.push(event);eventIndex++;
  }
  state=stepWithPlayerEvents(state,accepted,acceptedEvents);
 }
 if(index!==ledger.length||eventIndex!==events.length)throw new Error('Player replay contains unreachable decisions or events');return state;
}
