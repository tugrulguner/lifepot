import {expect,it} from 'vitest';
import {createSimulation} from './world';
import {defaultConfig} from './setup';
import {createRunEvidence} from './run-evidence';
import {getRecordedMoments} from './recorded-moments';
import {describeEvidenceReference} from './run-journey';

it('carries a living followed family into a next-trial observation without inventing extinction',()=>{
 const state=createSimulation({seed:7,config:defaultConfig()}),evidence=createRunEvidence(state);
 evidence.followedFamily={lineage:25,population:3};
 const fact=describeEvidenceReference('family-observation:25',evidence,state.config);
 expect(fact).toEqual({reference:'family-observation:25',description:'Founder lineage #25: 3 living members at generation 0.',generation:0});
 expect(getRecordedMoments(evidence,state.config)).toContainEqual({...fact,id:'family-observation:25',kind:'family'});
 expect(describeEvidenceReference('family:25',evidence,state.config)).toBeNull();
 expect(describeEvidenceReference('family-observation:26',evidence,state.config)).toBeNull();
 for(const population of [0,-1,1.5,NaN,state.stats.population+1]){
  evidence.followedFamily={lineage:25,population};
  expect(describeEvidenceReference('family-observation:25',evidence,state.config)).toBeNull();
 }
});

it('orders only recorded family/species losses and the final observed endpoint without mutating evidence',()=>{
 const state=createSimulation({seed:7,config:defaultConfig()}),evidence=createRunEvidence(state),first=evidence.samples[0];
 const latest={...first,generation:40,population:9,species:first.species.map(item=>item.speciesId==='A'?{...item,population:0}:item)};
 evidence.samples=[first,{...first,generation:22},{...first,generation:38,species:latest.species},{...latest,generation:40}];
 evidence.firstExtinction=[{speciesId:'A',generation:38}];
 evidence.lineageExtinction=[{lineage:18,generation:22},{lineage:25,generation:42}];
 evidence.followedFamily={lineage:25,population:0};
 const before=JSON.stringify(evidence);
 const moments=getRecordedMoments(evidence,state.config,{A:'pond snails'});
 expect(moments.map(moment=>[moment.id,moment.kind,moment.generation])).toEqual([
  ['family:18','family',22],['extinction:A','species',38],['population','end',40],
 ]);
 expect(moments[1].description).toContain('pond snails (Species A)');
 expect(JSON.stringify(evidence)).toBe(before);
});
