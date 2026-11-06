import {expect,it} from 'vitest';
import {createSimulation} from './world';
import {defaultConfig} from './setup';
import {createRunEvidence} from './run-evidence';
import {getRecordedMoments} from './recorded-moments';

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
