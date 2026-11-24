import { validateSpeciesDirectives } from "./decisions";
import type {
  EvolutionDecision,
  EnvironmentPressure,
  MutationTempo,
  PredatorStrategy,
  PreyStrategy,
} from "./decisions";
import {
  TROPHIC_CAPABILITIES,
  applyRulePatch,
  defaultRuleGraph,
  ruleChangeDue,
  validateRuleGraph,
  type PairInteraction,
  type SpeciesPair,
  type TrophicRole,
  type WorldRuleGraph,
} from "./rules";

export const GRID_SIZE = 50,
  GRID_CELLS = 2500,
  TRAIT_COUNT = 5,
  DEFAULT_GENERATIONS = 180,
  MAX_ENERGY = 255,
  MAX_SPECIES = 32;
// ca-9 is the current mechanics contract. ca-7 and ca-8 remain executable so that
// previously recorded replays reproduce exactly; they never receive new mechanics.
export const ENGINE_VERSION = "lifepot-ca-9";
export const CA8_ENGINE_VERSION = "lifepot-ca-8";
export const LEGACY_ENGINE_VERSION = "lifepot-ca-7";
export const SUPPORTED_ENGINE_VERSIONS = [LEGACY_ENGINE_VERSION, CA8_ENGINE_VERSION, ENGINE_VERSION] as const;
export type EngineVersion = (typeof SUPPORTED_ENGINE_VERSIONS)[number];
/**
 * Contracts that carry fixed habitats, saved habitat checkpoints and player-directed events.
 * Those features arrived with ca-8; a world saved under ca-8 keeps running under ca-8.
 */
export const FEATURE_ENGINE_VERSIONS = [CA8_ENGINE_VERSION, ENGINE_VERSION] as const;
export function supportsHabitatFeatures(version: EngineVersion) {
  return version !== LEGACY_ENGINE_VERSION;
}
/** Largest variant label: 32 hash buckets before ca-9, one phenotype class per rule species from ca-9. */
export function maxVariantLabel(version: EngineVersion) {
  return usesCa9Mechanics(version) ? 4 * 3125 : MAX_SPECIES;
}
/** True for the mechanics introduced with ca-9 (everything newer than the two recorded legacy contracts). */
export function usesCa9Mechanics(version: EngineVersion) {
  return version !== LEGACY_ENGINE_VERSION && version !== CA8_ENGINE_VERSION;
}
// ca-9 tuning constants, kept together so a mechanics review can read them in one place.
export const CA9 = {
  baseGrowth: { rich: 3.75, balanced: 2.5, scarce: 1.25 } as const,
  founders: [24, 6, 10] as const,
  baseIntake: 15,
  preyHazardDivisor: 10,
  consumerHazardDivisor: 20,
  metabolismUpkeep: 1,
  mobilityUpkeep: 0.5,
  armoredAttackCost: [6, 8] as const,
  swarmAttackCostPerAlly: 2.5,
  armoredMaintenance: 1.25,
  omnivorePredationShare: 0.8,
  mutationStep: { slow: 8, steady: 12, rapid: 16 } as const,
} as const;
export type ResourceAbundance = "scarce" | "balanced" | "rich";
export type ResourceDistribution = "clustered" | "scattered" | "seasonal";
export type Hazard = "drought" | "toxin" | "heat" | "crowding";
export type Volatility = "stable" | "pulsing" | "chaotic";
export type FitnessKey = "survive" | "replicate" | "cooperate" | "explore" | "adapt";
export type FitnessConfig = Record<FitnessKey, number>;
export type GuildName = "prey" | "predator";
export type LifeConfig = {
  environment: {
    abundance: ResourceAbundance;
    distribution: ResourceDistribution;
    hazard: Hazard;
    volatility: Volatility;
  };
  fitness: FitnessConfig;
  founders: {
    balance: "prey_heavy" | "balanced" | "predator_heavy";
    diversity: "focused" | "varied";
    preyStrategy: PreyStrategy;
    predatorStrategy: PredatorStrategy;
  };
  rules?: WorldRuleGraph;
};
export type OrganismSeed = {
  x: number;
  y: number;
  guild: GuildName;
  ruleSpecies?: number;
  energy: number;
  lineage: number;
  species: number;
  generation: number;
  strategy: PreyStrategy | PredatorStrategy;
  traits: readonly [number, number, number, number, number];
};
export type ResourceSeed = { x: number; y: number; amount: number };
export type EcologyFrame = {
  generation: number;
  prey: number;
  predators: number;
  kills: number;
  resources: number;
  speciesRichness: number;
};
export type SimulationStats = {
  population: number;
  prey: number;
  predators: number;
  births: number;
  deaths: number;
  kills: number;
  resources: number;
  maxGeneration: number;
  lineages: number;
  speciesRichness: number;
};
export type SimulationOutcome = "running" | "extinct" | "surviving" | "thriving";
export type OrganismEvent = {
  kind: "birth" | "feeding" | "death";
  generation: number;
  organismId: number;
  parentId?: number;
  at: number;
  energy: number;
  source?: "resource" | "prey";
  cause?: "starvation" | "age" | "predation";
  targetId?: number;
};
export type SimulationState = {
  engineVersion: EngineVersion;
  fixedHabitat?: { version: 1; observationLimit: number };
  everPopulatedSlots: number[];
  organismId: Uint32Array;
  parentId: Uint32Array;
  nextOrganismId: number;
  events: OrganismEvent[];
  recentEvents: OrganismEvent[];
  seed: number;
  rngState: number;
  generation: number;
  config: LifeConfig;
  activeRuleChange?: {
    sourceGeneration: number;
    activatedAt: number;
    revertAt: number | null;
    previousRules: WorldRuleGraph;
  };
  appliedRuleChanges: number[];
  maintainedRuleChanges: number[];
  guild: Uint8Array;
  ruleSpecies: Uint8Array;
  occupied: Uint8Array;
  energy: Float32Array;
  age: Uint16Array;
  organismGeneration: Uint16Array;
  lineage: Uint32Array;
  species: Uint16Array;
  strategy: Uint8Array;
  traits: Uint8Array;
  resources: Uint8Array;
  hazards: Uint8Array;
  history: EcologyFrame[];
  stats: SimulationStats;
  outcome: SimulationOutcome;
};
export type CreateSimulationOptions = {
  seed: number;
  config: LifeConfig;
  engineVersion?: EngineVersion;
  fixedHabitat?: { version: 1; observationLimit: number };
  initialPopulation?: readonly OrganismSeed[];
  initialResources?: readonly ResourceSeed[];
};
export const MAX_FIXED_HABITAT_GENERATIONS = 1800;
function validateFixedHabitatContract(value: unknown): asserts value is { version: 1; observationLimit: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid fixed habitat contract");
  const contract = value as { version?: unknown; observationLimit?: unknown };
  const keys = Object.keys(contract);
  if (
    keys.length !== 2 ||
    !keys.every((key) => key === "version" || key === "observationLimit") ||
    contract.version !== 1 ||
    typeof contract.observationLimit !== "number" ||
    !Number.isInteger(contract.observationLimit) ||
    contract.observationLimit < 1 ||
    contract.observationLimit > MAX_FIXED_HABITAT_GENERATIONS
  )
    throw new Error("Invalid fixed habitat observation contract");
}
export function getSimulationObservationLimit(state: SimulationState): number {
  if (state.fixedHabitat === undefined) return DEFAULT_GENERATIONS;
  validateFixedHabitatContract(state.fixedHabitat);
  if (
    !supportsHabitatFeatures(state.engineVersion) ||
    state.activeRuleChange ||
    state.appliedRuleChanges.length ||
    state.maintainedRuleChanges.length
  )
    throw new Error("Fixed habitats cannot contain unsupported engines or adaptive rule changes");
  return state.fixedHabitat.observationLimit;
}
const PREY = ["efficient_grazing", "early_brood", "armored", "swarming", "dispersal"] as const;
const PRED = ["ambush", "pursuit", "pack_hunting", "efficient_kill", "brood_hunting"] as const;
export function strategyCode(value: PreyStrategy | PredatorStrategy) {
  const p = (PREY as readonly string[]).indexOf(value);
  return p >= 0 ? p : (PRED as readonly string[]).indexOf(value) + PREY.length;
}
export function strategyName(code: number, guild: number): PreyStrategy | PredatorStrategy {
  return guild === 1 ? (PREY[code] ?? PREY[0]) : (PRED[code - PREY.length] ?? PRED[0]);
}
export function indexOf(x: number, y: number) {
  return (((y % GRID_SIZE) + GRID_SIZE) % GRID_SIZE) * GRID_SIZE + (((x % GRID_SIZE) + GRID_SIZE) % GRID_SIZE);
}
function rand(s: number): [number, number] {
  let x = s | 0 || 0x6d2b79f5;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const n = x >>> 0;
  return [n / 0x100000000, n];
}
const dirs = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;
// The toroidal neighborhood never changes, so it is tabulated once.
const NEIGHBORS = new Int16Array(GRID_CELLS * 8);
for (let i = 0; i < GRID_CELLS; i++) {
  const x = i % GRID_SIZE,
    y = Math.floor(i / GRID_SIZE);
  dirs.forEach(([dx, dy], k) => {
    NEIGHBORS[i * 8 + k] = indexOf(x + dx, y + dy);
  });
}
function neighbors(i: number): number[] {
  const o = i * 8;
  return [
    NEIGHBORS[o],
    NEIGHBORS[o + 1],
    NEIGHBORS[o + 2],
    NEIGHBORS[o + 3],
    NEIGHBORS[o + 4],
    NEIGHBORS[o + 5],
    NEIGHBORS[o + 6],
    NEIGHBORS[o + 7],
  ];
}
// Stateless hash in [0, 1). Used where a per-cell deterministic fraction is needed
// without advancing the shared PRNG stream.
function unitHash(a: number, b: number, c: number) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35) ^ c;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 0x100000000;
}
// ca-9 variant label: a coarse phenotype class (five levels per trait, centered on the
// founder value 128) within a rule species. It changes only when inherited traits have
// drifted into a different band, so "living variants" counts distinguishable phenotypes
// rather than hash buckets.
export function phenotypeClass(traits: ArrayLike<number>, index: number, ruleSlot: number) {
  let code = 0;
  for (let t = TRAIT_COUNT - 1; t >= 0; t--)
    code = code * 5 + Math.min(4, Math.floor((traits[index * TRAIT_COUNT + t] + 32) / 64));
  return 1 + (Math.max(1, ruleSlot) - 1) * 3125 + code;
}
export function resourceCap(c: LifeConfig) {
  return c.environment.abundance === "scarce" ? 75 : c.environment.abundance === "rich" ? 235 : 150;
}
function fillResources(a: Uint8Array, c: LifeConfig, seed: number) {
  let r = seed;
  const cap = resourceCap(c);
  for (let i = 0; i < GRID_CELLS; i++) {
    let q;
    [q, r] = rand(r);
    const x = i % 50,
      y = Math.floor(i / 50);
    const factor =
      c.environment.distribution === "clustered"
        ? (Math.floor(x / 8) + Math.floor(y / 8) * 3 + seed) % 5 <= 1
          ? 1
          : 0.12
        : c.environment.distribution === "seasonal"
          ? 0.2 + (0.8 * (Math.sin(x / 7 + y / 9) + 1)) / 2
          : 0.55;
    a[i] = Math.round(cap * (0.2 + 0.7 * q) * factor);
  }
  return r;
}
/**
 * Founders seeded for one rule species. ca-9 seeds a wider basal base under fewer hunters:
 * this is a versioned starting condition, not an empirically calibrated trophic ratio.
 */
export function founderCount(
  role: TrophicRole,
  balance: LifeConfig["founders"]["balance"],
  engineVersion: EngineVersion = ENGINE_VERSION,
) {
  const [basal, hunter, other] = usesCa9Mechanics(engineVersion) ? CA9.founders : ([18, 8, 10] as const);
  const base = role === "producer" || role === "grazer" ? basal : role === "hunter" ? hunter : other;
  const predatorGuild = role === "hunter" || role === "omnivore";
  const scale = predatorGuild
    ? balance === "predator_heavy"
      ? 1.5
      : balance === "prey_heavy"
        ? 0.65
        : 1
    : balance === "prey_heavy"
      ? 1.3
      : balance === "predator_heavy"
        ? 0.8
        : 1;
  return Math.max(3, Math.round(base * scale));
}
function defaultPopulation(config: LifeConfig, seed: number, engineVersion: EngineVersion): OrganismSeed[] {
  const rules = config.rules ?? defaultRuleGraph(),
    out: OrganismSeed[] = [];
  const occupied = new Set<number>();
  let rng = seed >>> 0,
    lineage = 1;
  for (const [slot, speciesRule] of rules.species.entries()) {
    const guild: GuildName = speciesRule.role === "hunter" || speciesRule.role === "omnivore" ? "predator" : "prey";
    const count = founderCount(speciesRule.role, config.founders.balance, engineVersion);
    for (let member = 0; member < count; member += 1) {
      let q: number, index: number;
      do {
        [q, rng] = rand(rng);
        index = Math.floor(q * GRID_CELLS);
      } while (occupied.has(index));
      occupied.add(index);
      const variance = config.founders.diversity === "varied" ? ((member * 29 + slot * 17) % 61) - 30 : 0;
      out.push({
        x: index % GRID_SIZE,
        y: Math.floor(index / GRID_SIZE),
        guild,
        ruleSpecies: slot + 1,
        energy: guild === "prey" ? 112 : 135,
        lineage: lineage++,
        species: slot + 1,
        generation: 0,
        strategy: guild === "prey" ? config.founders.preyStrategy : config.founders.predatorStrategy,
        traits: [128 + variance, 128 - variance, 128 + (variance >> 1), 128, 128],
      });
    }
  }
  return out;
}
function totals(state: SimulationState): SimulationStats {
  let prey = 0,
    predators = 0,
    resources = 0;
  const lineages = new Set<number>(),
    species = new Set<number>();
  for (let i = 0; i < GRID_CELLS; i++) {
    resources += state.resources[i];
    if (state.guild[i] === 1) prey++;
    if (state.guild[i] === 2) predators++;
    if (state.guild[i]) {
      lineages.add(state.lineage[i]);
      species.add(state.species[i]);
    }
  }
  return {
    ...state.stats,
    population: prey + predators,
    prey,
    predators,
    resources,
    lineages: lineages.size,
    speciesRichness: species.size,
  };
}
export function createSimulation(o: CreateSimulationOptions): SimulationState {
  if (o.fixedHabitat !== undefined) {
    validateFixedHabitatContract(o.fixedHabitat);
    if (!supportsHabitatFeatures(o.engineVersion ?? ENGINE_VERSION))
      throw new Error("Fixed habitats require the ca8 engine or later");
  }
  const config = { ...structuredClone(o.config), rules: validateRuleGraph(o.config.rules ?? defaultRuleGraph()) };
  const engineVersion = o.engineVersion ?? ENGINE_VERSION;
  const guild = new Uint8Array(GRID_CELLS),
    ruleSpecies = new Uint8Array(GRID_CELLS),
    energy = new Float32Array(GRID_CELLS),
    age = new Uint16Array(GRID_CELLS),
    organismGeneration = new Uint16Array(GRID_CELLS),
    lineage = new Uint32Array(GRID_CELLS),
    species = new Uint16Array(GRID_CELLS),
    strategy = new Uint8Array(GRID_CELLS),
    traits = new Uint8Array(GRID_CELLS * 5),
    resources = new Uint8Array(GRID_CELLS),
    hazards = new Uint8Array(GRID_CELLS);
  const rngState = fillResources(resources, config, o.seed >>> 0);
  for (const v of o.initialResources ?? [])
    resources[indexOf(v.x, v.y)] = Math.max(0, Math.min(255, Math.round(v.amount)));
  const pop = o.initialPopulation ?? defaultPopulation(config, o.seed, engineVersion);
  for (const v of pop) {
    const i = indexOf(v.x, v.y);
    guild[i] = v.guild === "prey" ? 1 : 2;
    ruleSpecies[i] = Math.max(
      1,
      Math.min(
        config.rules.species.length,
        v.ruleSpecies ?? (v.guild === "prey" ? 1 : Math.min(2, config.rules.species.length)),
      ),
    );
    energy[i] = Math.max(0, Math.min(MAX_ENERGY, v.energy));
    lineage[i] = v.lineage;
    species[i] = Math.max(1, Math.min(MAX_SPECIES, v.species));
    organismGeneration[i] = v.generation;
    strategy[i] = strategyCode(v.strategy);
    for (let t = 0; t < 5; t++) traits[i * 5 + t] = Math.max(0, Math.min(255, v.traits[t]));
    if (usesCa9Mechanics(engineVersion)) species[i] = phenotypeClass(traits, i, ruleSpecies[i]);
  }
  const occupied = guild.slice(),
    organismId = new Uint32Array(GRID_CELLS),
    parentId = new Uint32Array(GRID_CELLS);
  let nextOrganismId = 1;
  for (let i = 0; i < GRID_CELLS; i++) if (guild[i]) organismId[i] = nextOrganismId++;
  const state: SimulationState = {
    engineVersion,
    ...(o.fixedHabitat ? { fixedHabitat: { ...o.fixedHabitat } } : {}),
    everPopulatedSlots: [
      ...new Set(pop.map((v) => v.ruleSpecies ?? (v.guild === "prey" ? 1 : Math.min(2, config.rules!.species.length)))),
    ],
    organismId,
    parentId,
    nextOrganismId,
    events: [],
    recentEvents: [],
    seed: o.seed >>> 0,
    rngState,
    generation: 0,
    config,
    appliedRuleChanges: [],
    maintainedRuleChanges: [],
    guild,
    ruleSpecies,
    occupied,
    energy,
    age,
    organismGeneration,
    lineage,
    species,
    strategy,
    traits,
    resources,
    hazards,
    history: [],
    stats: {
      population: 0,
      prey: 0,
      predators: 0,
      births: 0,
      deaths: 0,
      kills: 0,
      resources: 0,
      maxGeneration: 0,
      lineages: 0,
      speciesRichness: 0,
    },
    outcome: pop.length ? "running" : "extinct",
  };
  state.stats = totals(state);
  state.history = [
    {
      generation: 0,
      prey: state.stats.prey,
      predators: state.stats.predators,
      kills: 0,
      resources: state.stats.resources,
      speciesRichness: state.stats.speciesRichness,
    },
  ];
  return state;
}
function copy(s: SimulationState, n: SimulationState, a: number, b: number) {
  n.organismId[b] = s.organismId[a];
  n.parentId[b] = s.parentId[a];
  n.guild[b] = s.guild[a];
  n.ruleSpecies[b] = s.ruleSpecies[a];
  n.occupied[b] = s.guild[a];
  n.energy[b] = s.energy[a];
  n.age[b] = s.age[a];
  n.organismGeneration[b] = s.organismGeneration[a];
  n.lineage[b] = s.lineage[a];
  n.species[b] = s.species[a];
  n.strategy[b] = s.strategy[a];
  for (let t = 0; t < 5; t++) n.traits[b * 5 + t] = s.traits[a * 5 + t];
}
function pressureEffect(
  d: EvolutionDecision | undefined,
  generation: number,
): { pressure: EnvironmentPressure; power: number } {
  if (!d) return { pressure: "stability", power: 0 };
  const duration = d.environmentIntensity.choice === "low" ? 6 : d.environmentIntensity.choice === "medium" ? 12 : 18;
  if (generation > d.generation + duration) return { pressure: "stability", power: 0 };
  return {
    pressure: d.environmentPressure.choice,
    power: d.environmentIntensity.choice === "low" ? 0.45 : d.environmentIntensity.choice === "medium" ? 0.8 : 1.2,
  };
}
function scheduledActivationState(state: SimulationState) {
  const prior = state.history.reduce(
    (best, frame) =>
      Math.abs(frame.generation - (state.generation - 12)) < Math.abs(best.generation - (state.generation - 12))
        ? frame
        : best,
    state.history[0],
  );
  const delta = state.stats.population - (prior.prey + prior.predators);
  const activeSlots = new Set<number>();
  for (let i = 0; i < GRID_CELLS; i++) if (state.guild[i]) activeSlots.add(state.ruleSpecies[i]);
  return {
    resourceBand:
      state.stats.resources / GRID_CELLS < resourceCap(state.config) * 0.28
        ? ("low" as const)
        : state.stats.resources / GRID_CELLS > resourceCap(state.config) * 0.7
          ? ("high" as const)
          : ("balanced" as const),
    populationBand:
      delta <= -Math.max(5, prior.prey * 0.25)
        ? ("crash" as const)
        : delta >= Math.max(8, prior.prey * 0.3)
          ? ("boom" as const)
          : ("stable" as const),
    speciesEmerged: state.stats.speciesRichness > prior.speciesRichness,
    speciesExtinct:
      state.engineVersion === LEGACY_ENGINE_VERSION
        ? activeSlots.size < state.config.rules!.species.length
        : state.everPopulatedSlots.some((slot) => !activeSlots.has(slot)),
    predationHigh: state.stats.kills - prior.kills >= Math.max(3, state.stats.prey * 0.16),
  };
}
function scheduledDuration(value: "short" | "medium" | "long" | "persistent") {
  return value === "short" ? 6 : value === "medium" ? 12 : value === "long" ? 24 : null;
}
function updateScheduledRules(
  previous: SimulationState,
  next: SimulationState,
  decisions: readonly EvolutionDecision[],
) {
  if (
    next.activeRuleChange?.revertAt !== null &&
    next.activeRuleChange &&
    next.generation > next.activeRuleChange.revertAt
  ) {
    const version = next.config.rules!.version + 1;
    next.config.rules = validateRuleGraph({ ...next.activeRuleChange.previousRules, version });
    next.activeRuleChange = undefined;
  }
  if (next.activeRuleChange && next.activeRuleChange.revertAt !== null) return;
  const decision = decisions.find(
    (candidate) =>
      candidate.scheduledRuleChange &&
      !next.appliedRuleChanges.includes(candidate.generation) &&
      candidate.generation < next.generation &&
      ruleChangeDue(candidate.scheduledRuleChange, next.generation, scheduledActivationState(previous)),
  );
  const change = decision?.scheduledRuleChange;
  if (
    !decision ||
    !change ||
    decision.ruleGraphVersion === undefined ||
    decision.ruleGraphVersion > next.config.rules!.version
  )
    return;
  const previousRules = structuredClone(next.config.rules!);
  const patched = applyRulePatch(next.config.rules!, change.patch);
  const environmental = change.patch.kind === "environment";
  const intensity = environmental ? decision.environmentIntensity.choice : patched.environment.intensity;
  const temporalChange =
    environmental && (intensity !== previousRules.environment.intensity || change.transition !== "abrupt");
  if (patched.version === previousRules.version && !temporalChange) {
    next.appliedRuleChanges = [...next.appliedRuleChanges, decision.generation];
    next.maintainedRuleChanges = [...next.maintainedRuleChanges, decision.generation];
    return;
  }
  if (patched.version === previousRules.version) patched.version++;
  next.config.rules = validateRuleGraph({ ...patched, environment: { ...patched.environment, intensity } });
  const duration = scheduledDuration(change.duration);
  next.activeRuleChange = {
    sourceGeneration: decision.generation,
    activatedAt: next.generation,
    revertAt: duration === null ? null : next.generation + duration - 1,
    previousRules,
  };
  next.appliedRuleChanges = [...next.appliedRuleChanges, decision.generation];
}
function graphPressureEffect(
  state: SimulationState,
  decision: EvolutionDecision | undefined,
): { pressure: EnvironmentPressure; power: number } {
  if (decision && decision.source !== "fallback" && !decision.council && !decision.scheduledRuleChange)
    return pressureEffect(decision, state.generation);
  const environment = state.config.rules!.environment,
    initialDuration = scheduledDuration(environment.duration);
  if (!state.activeRuleChange && initialDuration !== null && state.generation > initialDuration)
    return { pressure: "stability", power: 0 };
  let power = environment.intensity === "low" ? 0.45 : environment.intensity === "medium" ? 0.8 : 1.2;
  const change = decision?.scheduledRuleChange;
  if (change && state.activeRuleChange?.sourceGeneration === decision.generation) {
    const elapsed = Math.max(0, state.generation - state.activeRuleChange.activatedAt);
    if (change.transition === "ramp") power *= Math.min(1, (elapsed + 1) / 4);
    else if (change.transition === "pulse") power *= 0.45 + 0.55 * ((Math.sin((elapsed * Math.PI) / 3) + 1) / 2);
  }
  return { pressure: environment.pressure, power };
}
function axisDistance(a: number, b: number) {
  const direct = Math.abs(a - b);
  return Math.min(direct, GRID_SIZE - direct);
}
function pairMode(
  state: SimulationState,
  leftSlot: number,
  rightSlot: number,
): { mode: PairInteraction; actorIsA: boolean } | null {
  if (!leftSlot || !rightSlot || leftSlot === rightSlot) return null;
  const left = state.config.rules!.species[leftSlot - 1]?.id,
    right = state.config.rules!.species[rightSlot - 1]?.id;
  if (!left || !right) return null;
  const actorIsA = left < right,
    pair = (actorIsA ? `${left}:${right}` : `${right}:${left}`) as SpeciesPair;
  const interaction = state.config.rules!.interactions.find((candidate) => candidate.pair === pair);
  return interaction ? { mode: interaction.mode, actorIsA } : null;
}
function slotConsumes(state: SimulationState, actorSlot: number, targetSlot: number) {
  if (!actorSlot || !targetSlot) return false;
  if (actorSlot === targetSlot) return state.config.rules!.species[actorSlot - 1]?.selfInteraction === "cannibalistic";
  const relation = pairMode(state, actorSlot, targetSlot);
  if (!relation) return false;
  return relation.mode === (relation.actorIsA ? "a_consumes_b" : "b_consumes_a");
}
function slotIsConsumer(state: SimulationState, slot: number) {
  const species = state.config.rules!.species[slot - 1];
  if (!species) return false;
  if (species.role === "hunter" || species.role === "omnivore" || species.selfInteraction === "cannibalistic")
    return true;
  return state.config.rules!.interactions.some(
    (interaction) =>
      (interaction.pair.startsWith(`${species.id}:`) && interaction.mode === "a_consumes_b") ||
      (interaction.pair.endsWith(`:${species.id}`) && interaction.mode === "b_consumes_a"),
  );
}
// The directed feeding graph resolved to rule slots once per step. Slot 0 (empty) never feeds.
type TrophicWeb = { consumes: boolean[][]; consumer: boolean[] };
function trophicWeb(state: SimulationState): TrophicWeb {
  const count = state.config.rules!.species.length;
  const consumes: boolean[][] = [],
    consumer: boolean[] = [];
  for (let actor = 0; actor <= count; actor++) {
    consumer.push(slotIsConsumer(state, actor));
    const row: boolean[] = [];
    for (let target = 0; target <= count; target++) row.push(slotConsumes(state, actor, target));
    consumes.push(row);
  }
  return { consumes, consumer };
}
function canConsume(state: SimulationState, web: TrophicWeb, actor: number, target: number) {
  return web.consumes[state.ruleSpecies[actor]]?.[state.ruleSpecies[target]] === true;
}
function isGraphConsumer(state: SimulationState, web: TrophicWeb, index: number) {
  return web.consumer[state.ruleSpecies[index]] === true;
}
// Defensive phenotypes pay maintenance every tick; their effects use the frozen neighborhood.
function defenseMechanics(state: SimulationState, index: number) {
  const strategy = strategyName(state.strategy[index], state.guild[index]);
  const ca9 = usesCa9Mechanics(state.engineVersion);
  if (strategy === "armored") {
    const [base, scale] = ca9 ? CA9.armoredAttackCost : [12, 12];
    return {
      maintenance: ca9 ? CA9.armoredMaintenance : 2,
      hazardMultiplier: 0.45,
      attackCost: base + (state.traits[index * 5 + 3] / 255) * scale,
    };
  }
  if (strategy === "swarming") {
    const allies = Math.min(
      4,
      neighbors(index).filter((other) => state.guild[other] && state.ruleSpecies[other] === state.ruleSpecies[index])
        .length,
    );
    return {
      maintenance: 1,
      hazardMultiplier: 1 - allies * 0.12,
      attackCost: allies * (ca9 ? CA9.swarmAttackCostPerAlly : 4),
    };
  }
  return { maintenance: 0, hazardMultiplier: 1, attackCost: 0 };
}
// Resource units an organism can take in one feeding, before its metabolism trait scales it.
// ca-9 narrows the gap between efficient grazing and every other strategy (18 vs 12 became
// 18 vs 15): at 12 the other strategies grew too slowly to outlast their first hunters.
function basalIntake(engineVersion: EngineVersion, strategy: PreyStrategy | PredatorStrategy) {
  if (strategy === "efficient_grazing") return 18;
  return usesCa9Mechanics(engineVersion) ? CA9.baseIntake : 12;
}
// Local foraging is a grazer capability, not a rescue or a change of species.
// Reserve only cells empty in both snapshots so movers cannot overwrite births.
function grazerDestination(state: SimulationState, next: SimulationState, actor: number) {
  if (next.config.rules!.species[state.ruleSpecies[actor] - 1]?.role !== "grazer" || state.traits[actor * 5 + 2] === 0)
    return actor;
  const strategy = strategyName(state.strategy[actor], state.guild[actor]);
  const intake = Math.round(basalIntake(state.engineVersion, strategy) * (0.7 + (state.traits[actor * 5] / 255) * 0.5));
  if (next.resources[actor] >= intake) return actor;
  const candidates = neighbors(actor).filter(
    (i) => !state.guild[i] && !next.guild[i] && next.resources[i] > next.resources[actor] + 2,
  );
  candidates.sort((a, b) => next.resources[b] - next.resources[a] || a - b);
  return candidates[0] ?? actor;
}
function feedBasal(
  state: SimulationState,
  next: SimulationState,
  actor: number,
  destination: number,
  strategy: PreyStrategy | PredatorStrategy,
) {
  const role = next.config.rules!.species[state.ruleSpecies[actor] - 1]?.role;
  if (!role || !TROPHIC_CAPABILITIES[role].basalFeeding) return 0;
  const consumed = Math.min(
    next.resources[destination],
    Math.round(basalIntake(state.engineVersion, strategy) * (0.7 + (state.traits[actor * 5] / 255) * 0.5)),
  );
  next.resources[destination] -= consumed;
  if (consumed > 0)
    next.events.push({
      kind: "feeding",
      generation: next.generation,
      organismId: state.organismId[actor],
      at: destination,
      energy: consumed * 0.8,
      source: "resource",
    });
  return consumed * 0.8;
}
function interactionDelta(state: SimulationState, index: number) {
  let delta = 0;
  const slot = state.ruleSpecies[index],
    self = state.config.rules!.species[slot - 1]?.selfInteraction,
    cooperation = 0.5 + state.config.fitness.cooperate * 2.5;
  for (const other of neighbors(index)) {
    if (!state.guild[other]) continue;
    if (state.ruleSpecies[other] === slot) {
      if (self === "cooperative") delta += 1.2 * cooperation;
      else if (self === "territorial") delta -= 1.8;
      continue;
    }
    const relation = pairMode(state, slot, state.ruleSpecies[other]);
    if (relation?.mode === "mutualism") delta += 2.4 * cooperation;
    else if (relation?.mode === "competition") delta -= 3;
    else if (relation?.mode === "avoidance") delta -= 0.6;
  }
  return delta;
}
// Nearest edible organism within a Chebyshev radius; ties resolve to the lowest cell index.
// Only the (2r+1)² window is visited: beyond it nothing can qualify.
function nearestEdible(state: SimulationState, web: TrophicWeb, from: number, radius: number) {
  const x = from % GRID_SIZE,
    y = Math.floor(from / GRID_SIZE);
  let best = -1,
    bestDistance = Infinity;
  const consider = (i: number, distance: number) => {
    if (!state.guild[i] || i === from || !canConsume(state, web, from, i)) return;
    if (distance <= radius && (distance < bestDistance || (distance === bestDistance && i < best))) {
      best = i;
      bestDistance = distance;
    }
  };
  if (radius * 2 + 1 >= GRID_SIZE) {
    for (let i = 0; i < GRID_CELLS; i++)
      consider(i, Math.max(axisDistance(x, i % GRID_SIZE), axisDistance(y, Math.floor(i / GRID_SIZE))));
    return best;
  }
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++) consider(indexOf(x + dx, y + dy), Math.max(Math.abs(dx), Math.abs(dy)));
  return best;
}
function stepToward(state: SimulationState, from: number, target: number) {
  const tx = target % GRID_SIZE,
    ty = Math.floor(target / GRID_SIZE);
  return (
    neighbors(from)
      .filter((i) => !state.guild[i] || i === target)
      .sort((a, b) => {
        const ad = Math.max(axisDistance(a % GRID_SIZE, tx), axisDistance(Math.floor(a / GRID_SIZE), ty));
        const bd = Math.max(axisDistance(b % GRID_SIZE, tx), axisDistance(Math.floor(b / GRID_SIZE), ty));
        return ad - bd || a - b;
      })[0] ?? from
  );
}
// Higher fecundity permits earlier reproduction, but the same parental fraction
// then funds a smaller newborn. No energy is created by this trait.
function reproductionThreshold(state: SimulationState, index: number, strategy: PreyStrategy | PredatorStrategy) {
  const base =
    state.guild[index] === 1 ? (strategy === "early_brood" ? 104 : 135) : strategy === "brood_hunting" ? 145 : 175;
  return base - state.config.fitness.replicate * 32 - ((state.traits[index * 5 + 1] - 128) / 128) * 24;
}
function birth(
  parent: number,
  target: number,
  n: SimulationState,
  rng: number,
  d: EvolutionDecision | undefined,
  childEnergy: number,
): number {
  copy(n, n, parent, target);
  n.parentId[target] = n.organismId[parent];
  n.organismId[target] = n.nextOrganismId++;
  n.events.push({
    kind: "birth",
    generation: n.generation,
    organismId: n.organismId[target],
    parentId: n.organismId[parent],
    at: target,
    energy: childEnergy,
  });
  n.age[target] = 0;
  n.organismGeneration[target] = Math.min(65535, n.organismGeneration[parent] + 1);
  const globalDecision = d?.speciesDirectives === undefined ? d : undefined;
  const guild = n.guild[parent];
  const speciesId = n.config.rules!.species[n.ruleSpecies[parent] - 1]?.id;
  const directive = d?.speciesDirectives?.find((item) => item.species === speciesId);
  const tempo: MutationTempo | undefined =
    directive?.mutationTempo.choice ??
    (guild === 1 ? globalDecision?.preyMutationTempo.choice : globalDecision?.predatorMutationTempo.choice);
  const baseRate = tempo === "rapid" ? 0.28 : tempo === "steady" ? 0.12 : 0.035,
    rate = Math.min(0.5, baseRate + n.config.fitness.adapt * 0.18);
  let q;
  [q, rng] = rand(rng);
  if (q < rate) {
    [q, rng] = rand(rng);
    const mutationTarget =
      directive?.mutationTarget.choice ??
      (guild === 1 ? globalDecision?.preyMutationTarget.choice : globalDecision?.predatorMutationTarget.choice);
    const t =
      n.engineVersion === LEGACY_ENGINE_VERSION || !mutationTarget
        ? Math.floor(q * TRAIT_COUNT)
        : ({ metabolism: 0, fecundity: 1, mobility: 2, defense: 3, sensing: 4 } as const)[mutationTarget];
    [q, rng] = rand(rng);
    const ca9 = usesCa9Mechanics(n.engineVersion);
    // ca-9: tempo sets the size of an undirected step as well as its frequency.
    const step = ca9 ? CA9.mutationStep[tempo === "rapid" ? "rapid" : tempo === "steady" ? "steady" : "slow"] : 6;
    const proposal = n.traits[parent * 5 + t] + (q < 0.5 ? -step : step);
    n.traits[target * 5 + t] = proposal < 0 || proposal > 255 ? n.traits[parent * 5 + t] : proposal;
    n.species[target] = ca9
      ? phenotypeClass(n.traits, target, n.ruleSpecies[target])
      : 1 + ((n.species[parent] * 31 + t * 17 + n.traits[target * 5 + t]) % MAX_SPECIES);
  }
  const chosen =
    directive?.strategy.choice ??
    (guild === 1 ? globalDecision?.preyStrategy.choice : globalDecision?.predatorStrategy.choice);
  if (chosen) n.strategy[target] = strategyCode(chosen);
  return rng;
}
export function stepSimulation(
  s: SimulationState,
  d?: EvolutionDecision,
  scheduleLedger: readonly EvolutionDecision[] = d ? [d] : [],
  pressureOverride?: { pressure: EnvironmentPressure; power: number },
): SimulationState {
  const observationLimit = getSimulationObservationLimit(s);
  if (s.fixedHabitat && (d || scheduleLedger.length || pressureOverride))
    throw new Error("Fixed habitats do not accept adaptive decisions or active rule changes");
  if (s.outcome !== "running" || s.generation >= observationLimit) return s;
  if (d) validateSpeciesDirectives(d, s.config.rules!);
  const n: SimulationState = {
    ...s,
    everPopulatedSlots: s.everPopulatedSlots.slice(),
    organismId: new Uint32Array(GRID_CELLS),
    parentId: new Uint32Array(GRID_CELLS),
    events: [],
    generation: s.generation + 1,
    config: structuredClone(s.config),
    activeRuleChange: s.activeRuleChange ? structuredClone(s.activeRuleChange) : undefined,
    appliedRuleChanges: s.appliedRuleChanges.slice(),
    maintainedRuleChanges: s.maintainedRuleChanges.slice(),
    guild: new Uint8Array(GRID_CELLS),
    ruleSpecies: new Uint8Array(GRID_CELLS),
    occupied: new Uint8Array(GRID_CELLS),
    energy: new Float32Array(GRID_CELLS),
    age: new Uint16Array(GRID_CELLS),
    organismGeneration: new Uint16Array(GRID_CELLS),
    lineage: new Uint32Array(GRID_CELLS),
    species: new Uint16Array(GRID_CELLS),
    strategy: new Uint8Array(GRID_CELLS),
    traits: new Uint8Array(GRID_CELLS * 5),
    resources: s.resources.slice(),
    hazards: new Uint8Array(GRID_CELLS),
    history: s.history.slice(),
    stats: { ...s.stats },
    outcome: "running",
  };
  let rng = s.rngState,
    births = 0,
    deaths = 0,
    kills = 0;
  const consumedCells = new Uint8Array(GRID_CELLS),
    processedConsumers = new Uint8Array(GRID_CELLS);
  const ca9 = usesCa9Mechanics(s.engineVersion),
    web = trophicWeb(s);
  updateScheduledRules(s, n, scheduleLedger);
  const environmentalDecision = n.activeRuleChange
    ? (scheduleLedger.find((candidate) => candidate.generation === n.activeRuleChange!.sourceGeneration) ?? d)
    : d;
  const effect = pressureOverride ?? graphPressureEffect(n, environmentalDecision),
    cap = resourceCap(n.config);
  for (let i = 0; i < GRID_CELLS; i++) {
    const environment = n.config.rules!.environment,
      wave =
        environment.volatility === "stable"
          ? 0.5
          : environment.volatility === "pulsing"
            ? 0.5 + 0.5 * Math.sin((n.generation + (i % 13)) / 7)
            : ((Math.imul(i ^ n.generation ^ s.seed, 2654435761) >>> 0) & 255) / 255;
    // ca-9 base rates are the ca-8 rates scaled so that an unmodified stable world regrows
    // exactly what the rounded ca-8 world did (3 / 2 / 1 per cell); only modifiers differ.
    const abundance = n.config.environment.abundance;
    let growth = ca9 ? CA9.baseGrowth[abundance] : abundance === "rich" ? 4 : abundance === "scarce" ? 1 : 2;
    if (environment.regeneration === "pulsed") growth *= 0.35 + wave * 1.3;
    else if (environment.regeneration === "depletion_feedback")
      growth *= 0.35 + 1.65 * (1 - n.resources[i] / Math.max(1, cap));
    if (effect.pressure === "nutrient_bloom") growth *= 1 + effect.power * 2;
    if (effect.pressure === "drought") growth *= 1 - effect.power * 0.55;
    if (effect.pressure === "fragmentation" && ((i % GRID_SIZE) % 10 < 2 || Math.floor(i / GRID_SIZE) % 10 < 2))
      growth *= Math.max(0, 1 - effect.power * 0.85);
    // Resources are whole units. ca-7/ca-8 rounded each cell's growth, which erased most
    // modifiers (for example 0.9 and 1.4 both became 1, and anything under 0.5 became 0).
    // ca-9 keeps the whole part and grants the fractional part as a deterministic per-cell
    // chance, so the world-wide mean regrowth equals the computed rate.
    const amount = Math.max(0, growth * (0.6 + 0.4 * wave));
    const grown = ca9
      ? Math.floor(amount) + (unitHash(i, n.generation, s.seed) < amount - Math.floor(amount) ? 1 : 0)
      : Math.round(amount);
    n.resources[i] = Math.min(cap, n.resources[i] + grown);
    let hazard =
      n.config.environment.hazard === "toxin"
        ? 24
        : n.config.environment.hazard === "heat"
          ? 20
          : n.config.environment.hazard === "crowding"
            ? 11
            : 14;
    if (effect.pressure === "toxin_wave") hazard *= (i + n.generation * 7) % 19 < 6 ? 1 + effect.power * 1.8 : 0.55;
    else if (effect.pressure === "heat_wave") hazard *= 1 + effect.power;
    else if (effect.pressure === "stability") hazard *= 0.65;
    n.hazards[i] = Math.min(255, Math.round(hazard * (0.6 + 0.5 * wave)));
  }
  for (let i = 0; i < GRID_CELLS; i++) {
    if (!s.guild[i] || isGraphConsumer(s, web, i)) continue;
    const destination = grazerDestination(s, n, i);
    copy(s, n, i, destination);
    n.age[destination] = s.age[i] + 1;
    const strat = strategyName(s.strategy[i], s.guild[i]),
      def = s.traits[i * 5 + 3] / 255;
    const gain = feedBasal(s, n, i, destination, strat);
    const defense = defenseMechanics(s, i);
    const social = interactionDelta(s, i);
    // ca-9 gives the metabolism and mobility traits a price: a higher value raises upkeep,
    // in exchange for more intake per feeding (metabolism) or cheaper movement (mobility).
    const metabolismTrait = (s.traits[i * 5] - 128) / 128,
      mobilityTrait = (s.traits[i * 5 + 2] - 128) / 128;
    const traitUpkeep = ca9 ? metabolismTrait * CA9.metabolismUpkeep + mobilityTrait * CA9.mobilityUpkeep : 0;
    const moveCost = destination === i ? 0 : ca9 ? Math.max(0.5, 1.5 - mobilityTrait) : 1.5;
    let cost =
      4 +
      traitUpkeep +
      moveCost +
      defense.maintenance +
      (n.hazards[destination] / (ca9 ? CA9.preyHazardDivisor : 22)) *
        defense.hazardMultiplier *
        (1 - def * 0.5) *
        (1 - n.config.fitness.survive * 0.45) -
      (s.engineVersion === LEGACY_ENGINE_VERSION ? social : Math.min(social, 3));
    if (s.engineVersion !== LEGACY_ENGINE_VERSION) cost = Math.max(1, cost);
    if (s.config.environment.hazard === "crowding") cost += neighbors(i).filter((x) => s.guild[x]).length * 0.25;
    n.energy[destination] = Math.min(MAX_ENERGY, s.energy[i] + gain - cost);
    if (n.energy[destination] <= 0 || n.age[destination] > 190) {
      n.events.push({
        kind: "death",
        generation: n.generation,
        organismId: s.organismId[i],
        at: destination,
        energy: Math.max(0, n.energy[destination]),
        cause: n.energy[destination] <= 0 ? "starvation" : "age",
      });
      n.guild[destination] = n.occupied[destination] = 0;
      n.energy[destination] = 0;
      deaths++;
      continue;
    }
    const empty = neighbors(destination).filter((x) => !s.guild[x] && !n.guild[x]);
    const threshold = reproductionThreshold(n, destination, strat);
    if (empty.length && n.energy[destination] >= threshold) {
      let q;
      [q, rng] = rand(rng);
      const target = empty[Math.floor(q * empty.length)];
      const child = n.energy[destination] * 0.38;
      n.energy[destination] -= child;
      rng = birth(destination, target, n, rng, d, child);
      n.energy[target] = child;
      births++;
    } else if (empty.length && strat === "dispersal") {
      let q;
      [q, rng] = rand(rng);
      if (q < 0.08 + n.config.fitness.explore * 0.42) {
        const target = empty[Math.floor(q * empty.length * 13) % empty.length];
        copy(n, n, destination, target);
        n.guild[destination] = n.occupied[destination] = 0;
        n.ruleSpecies[destination] = 0;
        n.energy[destination] = 0;
      }
    }
  }
  for (let i = 0; i < GRID_CELLS; i++) {
    if (!s.guild[i] || !isGraphConsumer(s, web, i) || consumedCells[i]) continue;
    processedConsumers[i] = 1;
    const strat = strategyName(s.strategy[i], s.guild[i]);
    const role = s.config.rules!.species[s.ruleSpecies[i] - 1]?.role;
    const metabolismTrait = (s.traits[i * 5] - 128) / 128,
      mobilityTrait = (s.traits[i * 5 + 2] - 128) / 128;
    const sensing = 1 + Math.round(s.traits[i * 5 + 4] / 85);
    const baseRadius =
      strat === "pursuit" ? sensing + 3 : strat === "pack_hunting" ? sensing + 2 : strat === "ambush" ? 1 : sensing + 1;
    // ca-9: mobility widens or narrows the search by up to two cells (ambush stays local).
    const radius = ca9 && strat !== "ambush" ? Math.max(1, baseRadius + Math.round(mobilityTrait * 2)) : baseRadius;
    let target = nearestEdible(s, web, i, radius);
    const local = neighbors(i).filter((x) => !consumedCells[x] && canConsume(s, web, i, x));
    if (local.length) {
      target = local[0];
      if (strat === "brood_hunting")
        target = local.reduce((a, b) => (s.organismGeneration[b] > s.organismGeneration[a] ? b : a));
    }
    if (target >= 0 && consumedCells[target]) target = -1;
    let destination = i;
    if (target >= 0) destination = stepToward(s, i, target);
    else {
      destination = grazerDestination(s, n, i);
      const empty = neighbors(i).filter((x) => !s.guild[x] && !n.guild[x]);
      if (destination === i && empty.length && (strat !== "ambush" || n.generation % 2 === 0)) {
        let q;
        [q, rng] = rand(rng);
        destination = empty[Math.floor(q * empty.length)];
      }
    }
    let caught =
      destination !== i &&
      !consumedCells[destination] &&
      canConsume(s, web, i, destination) &&
      ((n.guild[destination] !== 0 && n.organismId[destination] === s.organismId[destination]) ||
        (s.guild[destination] !== 0 && isGraphConsumer(s, web, destination) && !processedConsumers[destination]));
    if (n.guild[destination] && !caught) {
      const alt = neighbors(i).find((x) => !s.guild[x] && !n.guild[x]);
      destination = alt ?? i;
      caught = false;
    }
    const attackCost = caught ? defenseMechanics(s, destination).attackCost : 0;
    if (caught && s.energy[i] <= attackCost) {
      destination = i;
      caught = false;
    }
    const capturedEnergy = caught
      ? n.guild[destination] && n.organismId[destination] === s.organismId[destination]
        ? n.energy[destination]
        : s.energy[destination]
      : 0;
    // ca-9: metabolism scales the captured share (±10%), and a generalist omnivore keeps less.
    const predationYield =
      (strat === "efficient_kill" ? 0.8 : strat === "pack_hunting" ? 0.61 : 0.69) *
      (ca9 ? (1 + metabolismTrait * 0.1) * (role === "omnivore" ? CA9.omnivorePredationShare : 1) : 1);
    const predationGain = caught
      ? s.engineVersion === LEGACY_ENGINE_VERSION
        ? strat === "efficient_kill"
          ? 72
          : strat === "pack_hunting"
            ? 62
            : 55
        : Math.min(capturedEnergy * predationYield, MAX_ENERGY)
      : 0;
    if (caught) {
      consumedCells[destination] = 1;
      n.events.push({
        kind: "death",
        generation: n.generation,
        organismId: s.organismId[destination],
        at: destination,
        energy: s.engineVersion === LEGACY_ENGINE_VERSION ? s.energy[destination] : capturedEnergy,
        cause: "predation",
      });
      n.events.push({
        kind: "feeding",
        generation: n.generation,
        organismId: s.organismId[i],
        targetId: s.organismId[destination],
        at: destination,
        energy: predationGain,
        source: "prey",
      });
    }
    copy(s, n, i, destination);
    if (destination !== i) {
      n.guild[i] = n.occupied[i] = 0;
      n.ruleSpecies[i] = 0;
      n.energy[i] = 0;
    }
    n.age[destination] = s.age[i] + 1;
    let gain = feedBasal(s, n, i, destination, strat);
    if (caught) {
      kills++;
      deaths++;
      gain += predationGain;
    }
    const metabolism =
      (strat === "ambush" ? 4.5 : strat === "pursuit" ? 8 : 6) +
      (ca9 ? metabolismTrait * CA9.metabolismUpkeep + mobilityTrait * CA9.mobilityUpkeep : 0) +
      (destination !== i && n.config.rules!.species[s.ruleSpecies[i] - 1]?.role === "grazer" ? 1.5 : 0);
    n.energy[destination] = Math.min(
      MAX_ENERGY,
      s.energy[i] +
        gain -
        metabolism -
        (caught ? attackCost : 0) -
        defenseMechanics(s, i).maintenance -
        (n.hazards[destination] / (ca9 ? CA9.consumerHazardDivisor : 45)) *
          defenseMechanics(s, i).hazardMultiplier *
          (1 - n.config.fitness.survive * 0.45) +
        (s.engineVersion === LEGACY_ENGINE_VERSION ? interactionDelta(s, i) : Math.min(interactionDelta(s, i), 3)),
    );
    if (n.energy[destination] <= 0 || n.age[destination] > 165) {
      n.events.push({
        kind: "death",
        generation: n.generation,
        organismId: s.organismId[i],
        at: destination,
        energy: Math.max(0, n.energy[destination]),
        cause: n.energy[destination] <= 0 ? "starvation" : "age",
      });
      n.guild[destination] = n.occupied[destination] = 0;
      n.ruleSpecies[destination] = 0;
      n.energy[destination] = 0;
      deaths++;
      continue;
    }
    const empty = neighbors(destination).filter((x) => !s.guild[x] && !n.guild[x]);
    const threshold = reproductionThreshold(n, destination, strat);
    if (empty.length && n.energy[destination] >= threshold) {
      let q;
      [q, rng] = rand(rng);
      const t = empty[Math.floor(q * empty.length)];
      const child = n.energy[destination] * (s.guild[i] === 1 ? 0.38 : 0.34);
      n.energy[destination] -= child;
      rng = birth(destination, t, n, rng, d, child);
      n.energy[t] = child;
      births++;
    }
  }
  for (let i = 0; i < GRID_CELLS; i++)
    if (!n.guild[i]) {
      n.organismId[i] = 0;
      n.parentId[i] = 0;
    }
  n.recentEvents = [...s.recentEvents.filter((e) => e.generation > n.generation - 3), ...n.events];
  n.rngState = rng;
  n.stats.births += births;
  n.stats.deaths += deaths;
  n.stats.kills += kills;
  let deepest = n.stats.maxGeneration;
  for (let i = 0; i < GRID_CELLS; i++) if (n.organismGeneration[i] > deepest) deepest = n.organismGeneration[i];
  n.stats.maxGeneration = deepest;
  n.stats = totals(n);
  n.history.push({
    generation: n.generation,
    prey: n.stats.prey,
    predators: n.stats.predators,
    kills: n.stats.kills,
    resources: n.stats.resources,
    speciesRichness: n.stats.speciesRichness,
  });
  if (n.history.length > 31) n.history.shift();
  const populated = new Set(n.everPopulatedSlots);
  for (let i = 0; i < GRID_CELLS; i++) if (n.ruleSpecies[i] > 0 && n.guild[i] > 0) populated.add(n.ruleSpecies[i]);
  n.everPopulatedSlots = [...populated];
  if (n.stats.population === 0) n.outcome = "extinct";
  else if (n.generation >= observationLimit)
    n.outcome = n.stats.prey >= 50 && n.stats.predators > 0 ? "thriving" : "surviving";
  return n;
}
export function runSimulation(initial: SimulationState, generations = DEFAULT_GENERATIONS) {
  let s = initial;
  const limit = getSimulationObservationLimit(s);
  const target = Math.min(limit, s.generation + Math.max(0, Math.floor(generations)));
  while (s.generation < target && s.outcome === "running") s = stepSimulation(s);
  if (s.outcome === "running" && (!s.fixedHabitat || s.generation >= limit))
    s = { ...s, outcome: s.stats.prey >= 50 && s.stats.predators > 0 ? "thriving" : "surviving" };
  return s;
}
export function snapshotSimulation(s: SimulationState) {
  return {
    organismId: Array.from(s.organismId),
    parentId: Array.from(s.parentId),
    nextOrganismId: s.nextOrganismId,
    events: s.events,
    engineVersion: s.engineVersion,
    seed: s.seed,
    rngState: s.rngState,
    generation: s.generation,
    outcome: s.outcome,
    stats: s.stats,
    guild: Array.from(s.guild),
    ruleSpecies: Array.from(s.ruleSpecies),
    energy: Array.from(s.energy),
    age: Array.from(s.age),
    organismGeneration: Array.from(s.organismGeneration),
    lineage: Array.from(s.lineage),
    species: Array.from(s.species),
    strategy: Array.from(s.strategy),
    traits: Array.from(s.traits),
    resources: Array.from(s.resources),
    hazards: Array.from(s.hazards),
    history: s.history,
  };
}
