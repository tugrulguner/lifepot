import {describe,it,expect} from 'vitest';
import {createSimulation,stepSimulation,indexOf} from './world';
import {defaultConfig} from './setup';
import {deterministicEvolutionDecision,summarizeEcology} from './decisions';
const seed={x:10,y:10,guild:'prey' as const,energy:220,lineage:1,species:1,generation:0,strategy:'early_brood' as const,traits:[128,128,128,128,128] as const};
describe('individual identity and witnessed events',()=>{
 it('records birth ancestry and transferred energy without duplicating identities',()=>{
  const s=createSimulation({seed:10,config:defaultConfig(),initialPopulation:[seed]});
  const n=stepSimulation(s);const births=n.events.filter(e=>e.kind==='birth');expect(births).toHaveLength(1);
  const event=births[0];expect(event.parentId).toBe(s.organismId[indexOf(10,10)]);expect(n.parentId[event.at]).toBe(event.parentId);expect(n.organismId[event.at]).toBe(event.organismId);expect(event.energy).toBeCloseTo(n.energy[event.at]);
  const ids=Array.from(n.organismId).filter(Boolean);expect(new Set(ids).size).toBe(n.stats.population);
  expect(n.events.some(e=>e.kind==='feeding'&&e.source==='resource')).toBe(true);
 });
 it('records actual death and clears identity without carrying old events',()=>{
  const s=createSimulation({seed:1,config:defaultConfig(),initialPopulation:[{...seed,energy:1}]});s.resources.fill(0);s.config.environment.abundance='scarce';
  const n=stepSimulation(s);expect(n.events.filter(e=>e.kind==='death')).toHaveLength(1);expect(n.organismId[indexOf(10,10)]).toBe(0);expect(n.events[0].generation).toBe(1);
 });
 it('keeps identity and event accounting consistent throughout a world',()=>{
  let state=createSimulation({seed:55,config:defaultConfig()});
  for(let tick=0;tick<100&&state.outcome==='running';tick++){
   const next=stepSimulation(state);
   const ids=Array.from(next.organismId).filter(Boolean);
   expect(new Set(ids).size).toBe(next.stats.population);
   expect(next.events.filter(e=>e.kind==='birth').length).toBe(next.stats.births-state.stats.births);
   expect(next.events.filter(e=>e.kind==='death').length).toBe(next.stats.deaths-state.stats.deaths);
   expect(next.stats.population).toBe(state.stats.population+next.stats.births-state.stats.births-next.stats.deaths+state.stats.deaths);
   state=next;
  }
 });
 it('does not hunt an organism that already died of starvation this tick',()=>{
  const config=defaultConfig();config.environment.abundance='scarce';
  const state=createSimulation({seed:1,config,initialPopulation:[{...seed,energy:1},{...seed,x:11,guild:'predator',strategy:'pursuit',ruleSpecies:2,energy:100,lineage:2}]});state.resources.fill(0);
  const next=stepSimulation(state);
  expect(next.stats.deaths).toBe(1);expect(next.stats.kills).toBe(0);
  expect(next.events.filter(e=>e.kind==='death')).toHaveLength(1);
 });
 it('mutation target directs the trait selected for mutation',()=>{
  const targetIndex={metabolism:0,fecundity:1,mobility:2,defense:3,sensing:4} as const;
  for(const [run,target] of Object.entries(targetIndex)){
   let observed=false;
   for(let seedValue=1;seedValue<=120&&!observed;seedValue++){
    const s=createSimulation({seed:seedValue*1877,config:defaultConfig(),initialPopulation:[seed]});s.generation=12;
    const d=deterministicEvolutionDecision(summarizeEcology(s,{world:'food',threat:'heat',reward:'adapt'},'stagnation'));
    delete d.speciesDirectives;d.preyMutationTempo.choice='rapid';d.preyMutationTarget.choice=run as keyof typeof targetIndex;
    const next=stepSimulation(s,d);
    for(const event of next.events.filter(e=>e.kind==='birth')){
      const changed=Array.from({length:5},(_,trait)=>trait).filter(trait=>next.traits[event.at*5+trait]!==seed.traits[trait]);
      if(changed.length){expect(changed).toEqual([target]);observed=true;}
    }
   }
   expect(observed).toBe(true);
  }
 });
});
