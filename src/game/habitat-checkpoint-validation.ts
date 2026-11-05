import { z } from "zod";
import { assertFixedHabitat, MAX_FIXED_HABITAT_GENERATIONS } from "./fixed-habitat";
import { lifeConfigSchema } from "./setup";
import { validateRuleGraph } from "./rules";
import { setupNamedIntentSchema } from "./setup-review";
import { ENGINE_VERSION, GRID_CELLS, MAX_ENERGY, MAX_SPECIES, TRAIT_COUNT, type SimulationState } from "./world";
import type { HabitatCheckpoint } from "./habitat-checkpoint";

const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const generation = integer.max(MAX_FIXED_HABITAT_GENERATIONS);
const uint32 = integer.max(0xffffffff);
const frame = z.object({ generation, prey: integer.max(GRID_CELLS), predators: integer.max(GRID_CELLS), kills: integer, resources: integer.max(GRID_CELLS * 255), speciesRichness: integer.max(MAX_SPECIES) }).strict();
const stats = z.object({ population: integer.max(GRID_CELLS), prey: integer.max(GRID_CELLS), predators: integer.max(GRID_CELLS), births: integer, deaths: integer, kills: integer, resources: integer.max(GRID_CELLS * 255), maxGeneration: integer.max(65535), lineages: integer.max(GRID_CELLS), speciesRichness: integer.max(MAX_SPECIES) }).strict();
const event = z.object({ kind: z.enum(["birth", "feeding", "death"]), generation, organismId: uint32.min(1), parentId: uint32.optional(), at: integer.max(GRID_CELLS - 1), energy: z.number().finite().min(0).max(MAX_ENERGY), source: z.enum(["resource", "prey"]).optional(), cause: z.enum(["starvation", "age", "predation"]).optional(), targetId: uint32.optional() }).strict();
const sampleSpecies = z.object({ speciesId: z.enum(["A", "B", "C", "D"]), role: z.string().max(32), population: integer.max(GRID_CELLS) }).strict();
const sample = z.object({ generation, population: integer.max(GRID_CELLS), prey: integer.max(GRID_CELLS), predators: integer.max(GRID_CELLS), resources: integer.max(GRID_CELLS * 255), births: integer, deaths: integer, kills: integer, species: z.array(sampleSpecies).min(2).max(4) }).strict();
const evidence = z.object({ samples: z.array(sample).min(1).max(MAX_FIXED_HABITAT_GENERATIONS + 1), followedFamily: z.object({ lineage: uint32.min(1), population: integer.max(GRID_CELLS) }).strict().nullable(), lineageExtinction: z.array(z.object({ lineage: uint32.min(1), generation }).strict()).max(MAX_FIXED_HABITAT_GENERATIONS), firstExtinction: z.array(z.object({ speciesId: z.enum(["A", "B", "C", "D"]), generation }).strict()).max(4), peakPopulation: integer.max(GRID_CELLS), ruleEvents: z.array(z.never()).max(0), observedRuleVersion: integer.min(1), activeRuleIdentity: z.null().optional(), playerChanges: z.array(z.never()).max(0).optional() }).strict();
const stateSchema = z.object({
  engineVersion: z.literal(ENGINE_VERSION), fixedHabitat: z.object({ version: z.literal(1), observationLimit: generation.min(1) }).strict(),
  everPopulatedSlots: z.array(integer.min(1).max(4)).max(4), organismId: z.unknown(), parentId: z.unknown(), nextOrganismId: uint32.min(1), events: z.array(event).max(GRID_CELLS * 4), recentEvents: z.array(event).max(GRID_CELLS * 12), seed: uint32, rngState: uint32, generation, config: lifeConfigSchema,
  activeRuleChange: z.undefined().optional(), appliedRuleChanges: z.array(z.never()).max(0), maintainedRuleChanges: z.array(z.never()).max(0),
  guild: z.unknown(), ruleSpecies: z.unknown(), occupied: z.unknown(), energy: z.unknown(), age: z.unknown(), organismGeneration: z.unknown(), lineage: z.unknown(), species: z.unknown(), strategy: z.unknown(), traits: z.unknown(), resources: z.unknown(), hazards: z.unknown(), history: z.array(frame).min(1).max(31), stats, outcome: z.enum(["running", "extinct", "surviving", "thriving"]),
}).strict();
const namedIntent = setupNamedIntentSchema.extend({ species: z.array(setupNamedIntentSchema.shape.species.element.strict()).min(2).max(4) }).strict();
const setup = z.object({ source: z.enum(["jev", "fallback"]), starter: z.boolean().optional(), model: z.string().max(100).optional(), namedIntent: namedIntent.optional() }).strict();
const timestamp = integer.max(8_640_000_000_000_000);
const checkpointSchema = z.object({ format: z.literal("lifepot-habitat"), version: z.literal(1), id: z.string().uuid(), name: z.string().min(1).max(80), createdAt: timestamp, savedAt: timestamp, parentId: z.string().uuid().nullable(), state: stateSchema, evidence, setup: setup.optional() }).strict();

function validateArrays(state: SimulationState): void {
  const specs = [
    ["organismId", Uint32Array, GRID_CELLS, 0xffffffff], ["parentId", Uint32Array, GRID_CELLS, 0xffffffff],
    ["guild", Uint8Array, GRID_CELLS, 2], ["ruleSpecies", Uint8Array, GRID_CELLS, 4], ["occupied", Uint8Array, GRID_CELLS, 2],
    ["energy", Float32Array, GRID_CELLS, MAX_ENERGY], ["age", Uint16Array, GRID_CELLS, 65535], ["organismGeneration", Uint16Array, GRID_CELLS, 65535],
    ["lineage", Uint32Array, GRID_CELLS, 0xffffffff], ["species", Uint16Array, GRID_CELLS, MAX_SPECIES], ["strategy", Uint8Array, GRID_CELLS, 255],
    ["traits", Uint8Array, GRID_CELLS * TRAIT_COUNT, 255], ["resources", Uint8Array, GRID_CELLS, 255], ["hazards", Uint8Array, GRID_CELLS, 255],
  ] as const;
  for (const [field, constructor, length, max] of specs) {
    const array = state[field];
    if (!(array instanceof constructor)) throw new Error("Invalid checkpoint state array");
    const values = Array.from(array);
    if (array.length !== length || array.byteOffset !== 0 || array.byteLength !== array.buffer.byteLength || values.some(value => !Number.isFinite(value) || value < 0 || value > max) || array.constructor !== constructor) throw new Error("Invalid checkpoint state array");
  }
}

export function validateHabitatCheckpoint(input: unknown): asserts input is HabitatCheckpoint {
  try {
    checkpointSchema.parse(input); // Validate without replacing/normalizing the original object.
    const checkpoint = input as HabitatCheckpoint, state = checkpoint.state, record = checkpoint.evidence;
    assertFixedHabitat(state); validateArrays(state);
    const limit = state.fixedHabitat.observationLimit;
    if (!state.config.rules || state.generation > limit || checkpoint.savedAt < checkpoint.createdAt || checkpoint.parentId === checkpoint.id) throw new Error();
    validateRuleGraph(state.config.rules);
    const names = checkpoint.setup?.namedIntent?.species;
    if (names && (names.length !== state.config.rules.species.length || names.some((item, index) => item.id !== state.config.rules!.species[index].id || item.role !== state.config.rules!.species[index].role))) throw new Error();
    let prey = 0, predators = 0, resources = 0;
    const ids = new Set<number>(), lineages = new Set<number>(), variants = new Set<number>();
    const speciesCounts = state.config.rules.species.map(() => 0);
    for (let index = 0; index < GRID_CELLS; index += 1) {
      resources += state.resources[index];
      if (!state.guild[index]) continue;
      if (!state.organismId[index] || ids.has(state.organismId[index]) || state.organismId[index] >= state.nextOrganismId || state.ruleSpecies[index] < 1 || state.ruleSpecies[index] > speciesCounts.length) throw new Error();
      ids.add(state.organismId[index]); lineages.add(state.lineage[index]); variants.add(state.species[index]);
      speciesCounts[state.ruleSpecies[index] - 1] += 1;
      if (state.guild[index] === 1) prey += 1; else predators += 1;
    }
    if (state.stats.population !== prey + predators || state.stats.prey !== prey || state.stats.predators !== predators || state.stats.resources !== resources || state.stats.lineages !== lineages.size || state.stats.speciesRichness !== variants.size) throw new Error();
    if (state.outcome === "extinct" ? state.stats.population !== 0 : state.stats.population === 0) throw new Error();
    if (state.outcome !== "extinct" && (state.outcome === "running" ? state.generation >= limit : state.generation !== limit)) throw new Error();
    if (record.samples.length !== state.generation + 1 || record.samples.some((item, index) => item.generation !== index || item.population !== item.prey + item.predators || item.species.length !== speciesCounts.length || item.species.some((species, slot) => species.speciesId !== state.config.rules!.species[slot].id || species.role !== state.config.rules!.species[slot].role) || item.species.reduce((sum, species) => sum + species.population, 0) !== item.population)) throw new Error();
    const last = record.samples.at(-1)!;
    for (const key of ["population", "prey", "predators", "resources", "births", "deaths", "kills"] as const) if (last[key] !== state.stats[key]) throw new Error();
    if (last.species.some((species, slot) => species.population !== speciesCounts[slot]) || record.observedRuleVersion !== state.config.rules.version || record.peakPopulation !== Math.max(...record.samples.map(item => item.population))) throw new Error();
    if (record.followedFamily) {
      let count = 0;
      for (let index = 0; index < GRID_CELLS; index += 1) if (state.guild[index] && state.lineage[index] === record.followedFamily.lineage) count += 1;
      if (count !== record.followedFamily.population) throw new Error();
    }
    if (record.lineageExtinction.some(item => item.generation > state.generation) || new Set(record.lineageExtinction.map(item => item.lineage)).size !== record.lineageExtinction.length) throw new Error();
    if (record.firstExtinction.some(item => item.generation < 1 || item.generation > state.generation || record.samples[item.generation].species.find(species => species.speciesId === item.speciesId)?.population !== 0 || !record.samples[item.generation - 1].species.some(species => species.speciesId === item.speciesId && species.population > 0)) || new Set(record.firstExtinction.map(item => item.speciesId)).size !== record.firstExtinction.length) throw new Error();
    if (state.history.length !== Math.min(31, state.generation + 1) || state.history.some((item, index) => item.generation !== state.generation - state.history.length + index + 1)) throw new Error();
    const currentFrame = state.history.at(-1)!;
    for (const key of ["prey", "predators", "kills", "resources", "speciesRichness"] as const) if (currentFrame[key] !== state.stats[key]) throw new Error();
    if (state.events.some(item => item.generation !== state.generation) || state.recentEvents.some(item => item.generation < Math.max(1, state.generation - 2) || item.generation > state.generation)) throw new Error();
  } catch {
    throw new Error("Invalid or unsupported fixed habitat checkpoint state or evidence");
  }
}
