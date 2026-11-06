import type {RunEvidence} from './run-evidence';
import type {LifeConfig} from './world';
import type {SpeciesId} from './rules';
import {describeEvidenceReference} from './run-journey';

export type RecordedMoment={id:string;reference:string;generation:number;description:string;kind:'family'|'species'|'end'};
/** Produce a small chronological list of moments backed by recorded evidence. */
export function getRecordedMoments(evidence:RunEvidence,config:LifeConfig,names:Partial<Record<SpeciesId,string>>={}):RecordedMoment[]{
 const moments:RecordedMoment[]=[];
 const add=(reference:string,kind:RecordedMoment['kind'])=>{
  const fact=describeEvidenceReference(reference,evidence,config,names);
  if(fact&&fact.generation!==undefined&&!moments.some(moment=>moment.id===reference))moments.push({...fact,generation:fact.generation,id:reference,kind});
 };
 for(const event of evidence.lineageExtinction)add(`family:${event.lineage}`,'family');
 for(const event of evidence.firstExtinction)add(`extinction:${event.speciesId}`,'species');
 add('population','end');
 return moments.sort((a,b)=>a.generation-b.generation||a.id.localeCompare(b.id));
}
