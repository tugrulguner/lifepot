import {it,expect} from 'vitest';
import {defaultConfig} from './setup';
import {defaultRuleGraph} from './rules';
import {createSimulation,stepSimulation,indexOf,type OrganismSeed} from './world';
const organism:OrganismSeed={x:10,y:10,guild:'prey',ruleSpecies:1,energy:112,lineage:1,species:1,generation:0,strategy:'early_brood',traits:[128,128,128,128,128]};
function config(){const c=defaultConfig();c.environment={abundance:'rich',distribution:'scattered',hazard:'drought',volatility:'stable'};c.rules=defaultRuleGraph();c.rules.species[0]={id:'A',role:'producer',selfInteraction:'neutral'};c.rules.interactions[0].mode='neutral';c.rules.environment={regeneration:'steady',pressure:'nutrient_bloom',volatility:'stable',intensity:'medium',duration:'persistent'};return c;}
function run(c:ReturnType<typeof config>,o=organism,empty=false){let s=createSimulation({seed:123,config:c,initialPopulation:[o]});if(empty)s.resources.fill(0);let births=0;for(let i=0;i<100&&s.outcome==='running';i++){s=stepSimulation(s);births+=s.events.filter(e=>e.kind==='birth').length;}return {births,population:s.stats.population,generation:s.generation};}
it('measures reproduction under viable versus depleted local conditions',()=>{
 const fertile=run(config());const dry=config();dry.environment.abundance='scarce';dry.rules!.environment.pressure='stability';const depleted=run(dry,{...organism,energy:80},true);
 console.log('REPRODUCTION_REVIEW',JSON.stringify({fertile,depleted}));expect(fertile.births).toBeGreaterThan(0);expect(depleted.births).toBe(0);
});
it('checks whether fecundity changes birth output with other inputs fixed',()=>{
 const low=run(config(),{...organism,traits:[128,0,128,128,128]});const high=run(config(),{...organism,traits:[128,255,128,128,128]});
 console.log('FECUNDITY_REVIEW',JSON.stringify({low,high}));expect(high.births).toBeGreaterThan(low.births);
});
it('compares early-brood eligibility before and after enabling cannibalism without prey to eat',()=>{
 const normal=config();const consumer=config();consumer.rules!.species[0].selfInteraction='cannibalistic';
 const a=stepSimulation(createSimulation({seed:123,config:normal,initialPopulation:[organism]}));const b=stepSimulation(createSimulation({seed:123,config:consumer,initialPopulation:[organism]}));
 console.log('CONSUMER_BRANCH_REVIEW',JSON.stringify({normalBirths:a.stats.births,consumerBirths:b.stats.births,normalEnergy:a.energy[indexOf(10,10)],consumerEnergy:Math.max(...b.energy)}));expect(a.stats.births).toBe(1);expect(b.stats.births).toBe(1);
});
it('lets grazers seek adjacent food and reproduce while preserving identity',()=>{
 const c=config();c.environment.abundance='scarce';c.rules!.environment.pressure='stability';c.rules!.species[0].role='grazer';let s=createSimulation({seed:123,config:c,initialPopulation:[{...organism,energy:80}]});s.resources.fill(75);s.resources[indexOf(10,10)]=0;
 const first=stepSimulation(s);expect(first.organismId[indexOf(10,10)]).toBe(0);expect(Array.from(first.organismId).filter(Boolean)).toEqual([1]);expect(first.events.find(e=>e.kind==='feeding')?.at).not.toBe(indexOf(10,10));
 s=first;for(let i=0;i<50&&s.outcome==='running';i++)s=stepSimulation(s);
 expect(s.stats.births).toBeGreaterThan(0);
});
it('retains grazer food seeking after a consumption rule is added',()=>{
 const c=config();c.environment.abundance='scarce';c.rules!.environment.pressure='stability';c.rules!.species[0]={id:'A',role:'grazer',selfInteraction:'cannibalistic'};
 for(const runSeed of [1,2,3,4,5,123]){
 const s=createSimulation({seed:runSeed,config:c,initialPopulation:[{...organism,energy:80}]});s.resources.fill(0);s.resources[indexOf(11,10)]=75;
 const n=stepSimulation(s);expect(n.organismId[indexOf(11,10)]).toBe(1);expect(n.events.some(e=>e.kind==='feeding'&&e.at===indexOf(11,10))).toBe(true);
 }
});
it('foraging pays movement energy and does not overwrite competing grazers',()=>{
 const c=config();c.rules!.species[0].role='grazer';
 const make=(depleted:boolean)=>{const s=createSimulation({seed:123,config:c,initialPopulation:[{...organism,energy:80}]});s.resources.fill(75);if(depleted)s.resources[indexOf(10,10)]=0;return stepSimulation(s);};
 const stayed=make(false),moved=make(true);
 expect(Math.max(...stayed.energy)-Math.max(...moved.energy)).toBeCloseTo(1.5,4);
 let s=createSimulation({seed:123,config:c,initialPopulation:[{...organism,energy:80},{...organism,x:12,energy:80,lineage:2}]});s.resources.fill(0);s.resources[indexOf(11,10)]=75;
 s=stepSimulation(s);expect(s.stats.population).toBe(2);expect(new Set(Array.from(s.organismId).filter(Boolean)).size).toBe(2);
});
it('fecundity affects hunter births without granting free energy',()=>{
 const c=config();c.rules!.species[0].role='hunter';c.rules!.species[1].role='grazer';
 const trial=(fecundity:number)=>stepSimulation(createSimulation({seed:123,config:c,initialPopulation:[{...organism,guild:'predator',energy:165,strategy:'ambush',traits:[128,fecundity,128,128,128]}]}));
 const low=trial(0),high=trial(255);expect(low.stats.births).toBe(0);expect(high.stats.births).toBe(1);
 expect(Array.from(high.energy).reduce((a,b)=>a+b,0)).toBeCloseTo(Array.from(low.energy).reduce((a,b)=>a+b,0),4);
});
it('keeps nondispersing producers stationary even with adjacent food',()=>{
 const c=config();c.environment.abundance='scarce';c.rules!.environment.pressure='stability';let s=createSimulation({seed:123,config:c,initialPopulation:[{...organism,energy:80}]});s.resources.fill(75);s.resources[indexOf(10,10)]=0;
 let moved=false;for(let i=0;i<100&&s.outcome==='running';i++){s=stepSimulation(s);for(let j=0;j<s.guild.length;j++)if(s.organismId[j]===1&&j!==indexOf(10,10))moved=true;}
 console.log('LOCAL_FOOD_REVIEW',JSON.stringify({births:s.stats.births,population:s.stats.population,moved,neighborFood:s.resources[indexOf(11,10)]}));expect(s.stats.births).toBe(0);expect(moved).toBe(false);expect(s.resources[indexOf(11,10)]).toBeGreaterThan(0);
});
