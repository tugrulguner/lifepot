import type {RunEvidence} from './run-evidence';
import type {LifeConfig} from './world';
import type {SpeciesId} from './rules';
import {conditionLabel,conditionValue} from './condition-labels';

export type EvidenceDescription={reference:string;description:string;generation?:number};

const validGeneration=(value:number)=>Number.isInteger(value)&&value>=0;
const identity=(id:SpeciesId,names:Partial<Record<SpeciesId,string>>)=>{
 const name=names[id]?.trim();return name?`${name} (Species ${id})`:`Species ${id}`;
};

/** Resolve only claims directly supported by recorded samples or event ledgers. */
export function describeEvidenceReference(reference:string,evidence:RunEvidence,config:LifeConfig,names:Partial<Record<SpeciesId,string>>={}):EvidenceDescription|null{
 const condition=/^condition:(environment\.(?:hazard|abundance|distribution|volatility)|rules\.environment\.(?:pressure|intensity|duration|volatility|regeneration))$/.exec(reference);
 if(condition){
  const path=condition[1],value=path.split('.').reduce((current,key)=>current&&typeof current==='object'&&Object.hasOwn(current,key)?(current as Record<string,unknown>)[key]:undefined,config as unknown);
  if(typeof value!=='string')return null;
  // A configured starting setting is not an event at generation zero.
  return {reference,description:`Starting condition: ${conditionLabel(path)}: ${conditionValue(path,value)}.`};
 }
 const samples=evidence.samples;
 if(!samples.length||samples.some(sample=>!validGeneration(sample.generation)||!Number.isFinite(sample.population)))return null;
 const first=samples[0],last=samples.at(-1)!;
 if(reference==='population')return {reference,description:`Population: ${first.population} at generation ${first.generation}; ${last.population} at generation ${last.generation}.`,generation:last.generation};
 const trajectory=/^species:([A-D])$/.exec(reference);
 if(trajectory){
  const id=trajectory[1] as SpeciesId;
  if(!evidence.samples.every(sample=>sample.species.some(item=>item.speciesId===id)))return null;
  const start=first.species.find(item=>item.speciesId===id),end=last.species.find(item=>item.speciesId===id);
  if(!start||!end||!Number.isFinite(start.population)||!Number.isFinite(end.population))return null;
  return {reference,description:`${identity(id,names)}: ${start.population} at generation ${first.generation}; ${end.population} at generation ${last.generation}.`,generation:last.generation};
 }
 const extinction=/^extinction:([A-D])$/.exec(reference);
 if(extinction){
  const id=extinction[1] as SpeciesId,event=evidence.firstExtinction.find(item=>item.speciesId===id);
  if(!event||!validGeneration(event.generation)||event.generation>last.generation)return null;
  const at=samples.findIndex(sample=>sample.generation===event.generation),speciesAt=samples[at]?.species.find(item=>item.speciesId===id);
  const prior=samples[at-1]?.species.find(item=>item.speciesId===id);
  if(!speciesAt||speciesAt.population!==0||!prior||prior.population<=0||last.species.find(item=>item.speciesId===id)?.population!==0)return null;
  return {reference,description:`${identity(id,names)} first observed extinct at generation ${event.generation}.`,generation:event.generation};
 }
 const family=/^family:([1-9]\d*)$/.exec(reference);
 if(family){
  const lineage=Number(family[1]),event=evidence.lineageExtinction.find(item=>item.lineage===lineage);
  if(!event||!validGeneration(event.generation)||event.generation>last.generation)return null;
  return {reference,description:`Founder lineage #${lineage} first observed extinct at generation ${event.generation}.`,generation:event.generation};
 }
 const pressure=/^pressure:(\d+)$/.exec(reference);
 if(pressure&&evidence.playerChanges){
  const generation=Number(pressure[1]),change=evidence.playerChanges.find(item=>item.activatedAt===generation);
  if(change)return {reference,description:`Player-recorded environmental pressure changed to ${change.pressure} at generation ${generation}; it restores ${change.previousPressure} at generation ${change.restoredAt??'not yet recorded'}.`,generation};
 }
 const rule=/^rule:(\d+)$/.exec(reference);
 if(rule){
  const generation=Number(rule[1]),event=evidence.ruleEvents.find(item=>item.generation===generation);
  if(event)return {reference,description:event.kind==='activated'?`Recorded rule change from decision generation ${event.sourceGeneration} activated at generation ${event.generation}${event.revertAt===null?'; no reversion is recorded.':`; scheduled to revert at generation ${event.revertAt}.`}`:`Recorded rule change reverted at generation ${event.generation}.`,generation};
 }
 return null;
}
