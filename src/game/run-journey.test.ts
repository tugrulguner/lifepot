import {expect,it} from 'vitest';
import {createSimulation} from './world';
import {defaultConfig} from './setup';
import {createRunEvidence} from './run-evidence';
import {describeEvidenceReference} from './run-journey';

it('describes every supported starting-condition reference without inventing an event generation',()=>{
 const state=createSimulation({seed:7,config:defaultConfig()}),evidence=createRunEvidence(state);
 for(const [prefix,values] of [['environment',state.config.environment],['rules.environment',state.config.rules!.environment]] as const){
  for(const key of Object.keys(values)){
   const fact=describeEvidenceReference(`condition:${prefix}.${key}`,evidence,state.config);
   expect(fact?.description).toContain('Starting condition:');
   expect(fact).not.toHaveProperty('generation');
  }
 }
 expect(describeEvidenceReference('condition:environment.__proto__',evidence,state.config)).toBeNull();
 expect(describeEvidenceReference('condition:rules.environment.missing',evidence,state.config)).toBeNull();
});

it('describes recorded species counts and only a verified species extinction',()=>{
 const state=createSimulation({seed:7,config:defaultConfig()}),evidence=createRunEvidence(state),first=evidence.samples[0];
 evidence.samples=[first,{...first,generation:4,species:first.species.map(item=>item.speciesId==='A'?{...item,population:0}:item)}];
 expect(describeEvidenceReference('species:A',evidence,state.config,{A:'pond snails'})).toEqual({reference:'species:A',description:'pond snails (Species A): 18 at generation 0; 0 at generation 4.',generation:4});
 expect(describeEvidenceReference('extinction:A',evidence,state.config)).toBeNull();
 evidence.firstExtinction=[{speciesId:'A',generation:4}];
 expect(describeEvidenceReference('extinction:A',evidence,state.config,{A:'pond snails'})).toMatchObject({generation:4,description:'pond snails (Species A) first observed extinct at generation 4.'});
});

it('keeps recorded family loss and population endpoint bounded to evidence',()=>{
 const state=createSimulation({seed:7,config:defaultConfig()}),evidence=createRunEvidence(state),first=evidence.samples[0];
 evidence.samples=[first,{...first,generation:8,population:12}];
 evidence.lineageExtinction=[{lineage:18,generation:6},{lineage:25,generation:9}];
 expect(describeEvidenceReference('family:18',evidence,state.config)?.generation).toBe(6);
 expect(describeEvidenceReference('family:25',evidence,state.config)).toBeNull();
 expect(describeEvidenceReference('family:26',evidence,state.config)).toBeNull();
 expect(describeEvidenceReference('population',evidence,state.config)?.description).toContain('12 at generation 8');
});
