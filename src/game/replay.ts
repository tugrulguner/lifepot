import {z} from 'zod';
import {DEFAULT_GENERATIONS,ENGINE_VERSION,LEGACY_ENGINE_VERSION,type EngineVersion,createSimulation,snapshotSimulation,stepSimulation,type LifeConfig,type SimulationState} from './world';
import type {EvolutionLedger} from './decisions';
import {runWithDecisionLedger,runWithPlayerEvents,validateEvolutionLedger} from './runtime';
import {playerEventSchema,validatePlayerEvents,type AcceptedPlayerEvent} from './player-proposal';
import {canonicalAnswers,hashReplayPayload,hashSetupRequest,lifeConfigSchema,setupAnswersSchema,type SetupAnswers} from './setup';
const base=z.object({version:z.literal(3),engineVersion:z.enum([LEGACY_ENGINE_VERSION,ENGINE_VERSION]),answers:setupAnswersSchema,config:lifeConfigSchema,seed:z.number().int().min(0).max(0xffffffff),requestHash:z.string().regex(/^setup_[a-z0-9]+$/),ledger:z.array(z.unknown()).max(8),contractHash:z.string().regex(/^replay_[a-z0-9]+$/)}).strict();
const playerBase=base.extend({version:z.literal(4),engineVersion:z.literal(ENGINE_VERSION),playerEvents:z.array(playerEventSchema).min(1).max(8)}).strict();
type Common={engineVersion:EngineVersion;answers:SetupAnswers;config:LifeConfig;seed:number;requestHash:string;ledger:EvolutionLedger;contractHash:string};
export type ReplayData=Common&({version:3;playerEvents?:never}|{version:4;playerEvents:AcceptedPlayerEvent[]});
type ReplayInput={answers:SetupAnswers;config:LifeConfig;seed:number;requestHash:string;ledger:EvolutionLedger;engineVersion?:EngineVersion;playerEvents?:AcceptedPlayerEvent[]};
function body(v:Omit<Common,'contractHash'>&{version:3|4;playerEvents?:AcceptedPlayerEvent[]}){
 const common={version:v.version,engineVersion:v.engineVersion,answers:canonicalAnswers(v.answers),config:v.config,seed:v.seed>>>0,requestHash:v.requestHash,ledger:v.ledger};
 return v.version===4?{...common,playerEvents:v.playerEvents}:common;
}
function validate(input:unknown):{replay:ReplayData;state:SimulationState}{
 try{
  const p=z.discriminatedUnion('version',[base,playerBase]).parse(input),ledger=validateEvolutionLedger(p.ledger);
  const r=(p.version===4?{...p,ledger,playerEvents:validatePlayerEvents(p.playerEvents)}:{...p,ledger}) as ReplayData;
  if(r.requestHash!==hashSetupRequest(r.answers)||r.contractHash!==hashReplayPayload(body(r)))throw new Error('tampered');
  const initial=createSimulation({seed:r.seed,config:r.config,engineVersion:r.engineVersion});
  const state=r.version===4?runWithPlayerEvents(initial,ledger,r.playerEvents,r.answers):runWithDecisionLedger(initial,ledger,DEFAULT_GENERATIONS,r.answers);
  return {replay:r,state};
 }catch{throw new Error('Invalid, tampered, or unsupported LifePot replay')}
}
export function createReplay(input:ReplayInput):ReplayData{
 const events=input.playerEvents?.length?validatePlayerEvents(input.playerEvents):undefined;
 const b=body({version:events?4:3,engineVersion:input.engineVersion??ENGINE_VERSION,answers:input.answers,config:lifeConfigSchema.parse(input.config),seed:input.seed,requestHash:input.requestHash,ledger:validateEvolutionLedger(input.ledger),...(events?{playerEvents:events}:{})});
 if(b.requestHash!==hashSetupRequest(b.answers))throw new Error('Invalid request hash');return validate({...b,contractHash:hashReplayPayload(b)}).replay;
}
function enc(text:string){const bytes=new TextEncoder().encode(text);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,' ').trim()}
function dec(text:string){const b=text.replaceAll('-','+').replaceAll('_','/');const binary=atob(b.padEnd(Math.ceil(b.length/4)*4,'='));return new TextDecoder().decode(Uint8Array.from(binary,c=>c.charCodeAt(0)))}
export function encodeReplay(input:ReplayData){return enc(JSON.stringify(validate(input).replay))}
export function decodeReplay(payload:string){try{return validate(JSON.parse(dec(payload))).replay}catch{throw new Error('Invalid or unsupported LifePot replay')}}
export async function playReplay(input:ReplayData,_interpreter?:(...args:never[])=>unknown){void _interpreter;const {replay,state}=validate(input);return {replay,state,snapshot:snapshotSimulation(state)}}
// Counterfactual only; supported v3 records retain the original explicit behavior.
export function replayCounterfactual(input:ReplayData){
 if(input.version!==3)throw new Error('Player-directed recordings are not supported by this counterfactual');
 const replay=base.parse(input),ledger=validateEvolutionLedger(replay.ledger);let state=createSimulation({seed:replay.seed,config:replay.config,engineVersion:ENGINE_VERSION});
 while(state.outcome==='running'&&state.generation<DEFAULT_GENERATIONS){const active=ledger.filter(d=>d.generation<=state.generation).at(-1);state=stepSimulation(state,active,ledger)}return state;
}
