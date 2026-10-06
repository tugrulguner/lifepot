import { describe, expect, it } from "vitest";
import { buildRunComparison, reflectionResponseSchema, validateReflection } from "./run-reflection";
import type { LifeConfig } from "./world";

const evidence = { followedFamily:null, samples: [
 { generation: 0, population: 8, prey: 5, predators: 3, resources: 20, births: 0, deaths: 0, kills: 0, species: [{ speciesId:"A", role:"grazer", population:5 },{ speciesId:"B", role:"hunter", population:3 }] },
 { generation: 2, population: 4, prey: 4, predators: 0, resources: 18, births: 1, deaths: 5, kills: 2, species: [{ speciesId:"A", role:"grazer", population:4 },{ speciesId:"B", role:"hunter", population:0 }] },
], peakPopulation: 8, firstExtinction:[{speciesId:"B",generation:2}], lineageExtinction:[], ruleEvents:[], observedRuleVersion:1 };
const config = { environment:{abundance:"balanced",distribution:"scattered",hazard:"drought",volatility:"stable"}, founders:{balance:"balanced",diversity:"varied",preyStrategy:"generalist",predatorStrategy:"ambush"}, fitness:{survive:1,replicate:1,cooperate:1,explore:1,adapt:1}, rules:{version:1,environment:{regeneration:"steady",pressure:"drought",volatility:"stable",intensity:"medium",duration:"persistent"},species:[],interactions:[]} } as unknown as LifeConfig;
describe("run reflection helpers", () => {
 it("aligns species trajectories and names actual config differences", () => {
  const comparison=buildRunComparison({ evidence, config }, { evidence:{...evidence,samples:evidence.samples.map(s=>({...s,species:s.species.filter(x=>x.speciesId!=="B")}))}, config:{...config,environment:{...config.environment,hazard:"toxin"},founders:{...config.founders,balance:"prey_heavy"}} });
  expect(comparison.species).toEqual(expect.arrayContaining([expect.objectContaining({speciesId:"B",before:[3,0],after:[null,null]})]));
  expect(comparison.conditionChanges).toContainEqual({path:"environment.hazard",before:"drought",after:"toxin"});
  expect(comparison.species[0]?.before).toHaveLength(2);
  expect(comparison.species[0]?.after).toHaveLength(2);
  expect(comparison.conditionChanges).toContainEqual({path:"founders.balance",before:"balanced",after:"prey_heavy"});
  expect(comparison.generations).toEqual([0,2]);
  expect(comparison.conditionChanges).not.toContainEqual(expect.objectContaining({path:"rules.species"}));
 });
 it("accepts bounded grounded observations and refuses unknown evidence references", () => {
  const out={observations:[{text:"B reached zero by generation 2.",evidenceRefs:["species:B","extinction:B"]}], nextExperiment:{title:"Reduce drought pressure", rationale:"Drought is configured.", evidenceRefs:["condition:environment.hazard"], changes:[{path:"rules.environment.pressure",value:"stability"}]}, caveat:"Adaptive decisions may differ between runs."};
  expect(reflectionResponseSchema.safeParse(out).success).toBe(true);
  expect(() => validateReflection(out,evidence,config)).not.toThrow();
  expect(() => validateReflection({...out,observations:[{...out.observations[0],evidenceRefs:["invented"]}]},evidence,config)).toThrow();
 });
});
