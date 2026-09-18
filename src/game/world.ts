export const GRID_SIZE = 50;
export const GRID_CELLS = GRID_SIZE * GRID_SIZE;
export const TRAIT_COUNT = 5;
export const ENGINE_VERSION = "lifepot-ca-1";
export const DEFAULT_GENERATIONS = 180;

export type ResourceAbundance = "scarce" | "balanced" | "rich";
export type ResourceDistribution = "clustered" | "scattered" | "seasonal";
export type Hazard = "drought" | "toxin" | "heat" | "crowding" | "predator";
export type Volatility = "stable" | "pulsing" | "chaotic";
export type FitnessKey = "survive" | "replicate" | "cooperate" | "explore" | "adapt";
export type FitnessConfig = Record<FitnessKey, number>;
export type LifeConfig = {
  environment: { abundance: ResourceAbundance; distribution: ResourceDistribution; hazard: Hazard; volatility: Volatility };
  fitness: FitnessConfig;
};
export type OrganismSeed = { x: number; y: number; energy: number; lineage: number; generation: number; traits: readonly [number, number, number, number, number] };
export type ResourceSeed = { x: number; y: number; amount: number };
export type SimulationStats = { population: number; births: number; deaths: number; maxGeneration: number; lineages: number };
export type SimulationOutcome = "running" | "extinct" | "surviving" | "thriving";
export type SimulationState = {
  seed: number; rngState: number; generation: number; config: LifeConfig;
  occupied: Uint8Array; energy: Float32Array; age: Uint16Array; organismGeneration: Uint16Array; lineage: Uint32Array; traits: Uint8Array;
  resources: Uint8Array; hazards: Uint8Array; stats: SimulationStats; outcome: SimulationOutcome;
};
export type CreateSimulationOptions = { seed: number; config: LifeConfig; initialPopulation?: readonly OrganismSeed[]; initialResources?: readonly ResourceSeed[] };

export function indexOf(x: number, y: number): number {
  const nx = ((x % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
  const ny = ((y % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
  return ny * GRID_SIZE + nx;
}

function random(state: number): [number, number] {
  let x = state | 0 || 0x6d2b79f5;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  const next = x >>> 0;
  return [next / 0x1_0000_0000, next];
}

function resourceCapacity(config: LifeConfig): number {
  return config.environment.abundance === "scarce" ? 70 : config.environment.abundance === "rich" ? 230 : 145;
}

function volatilityAt(config: LifeConfig, generation: number, index: number, seed: number): number {
  if (config.environment.volatility === "stable") return 0.35;
  if (config.environment.volatility === "pulsing") return 0.5 + 0.5 * Math.sin((generation + (index % 11)) * Math.PI / 9);
  const mixed = Math.imul((generation + 1) ^ seed ^ index, 0x45d9f3b) >>> 0;
  return (mixed & 255) / 255;
}

function fillResources(resources: Uint8Array, config: LifeConfig, seed: number): number {
  let rng = seed || 0x6d2b79f5;
  const cap = resourceCapacity(config);
  for (let i = 0; i < GRID_CELLS; i += 1) {
    let roll: number; [roll, rng] = random(rng);
    if (config.environment.distribution === "clustered") {
      const x = i % GRID_SIZE; const y = Math.floor(i / GRID_SIZE);
      const cluster = ((Math.floor(x / 8) + Math.floor(y / 8) * 3 + seed) % 5) <= 1;
      resources[i] = cluster ? Math.round(cap * (0.55 + roll * 0.45)) : Math.round(cap * roll * 0.12);
    } else if (config.environment.distribution === "seasonal") {
      const band = (Math.sin((i % GRID_SIZE) / 7 + Math.floor(i / GRID_SIZE) / 9) + 1) / 2;
      resources[i] = Math.round(cap * (0.15 + 0.7 * band) * (0.65 + roll * 0.35));
    } else resources[i] = Math.round(cap * (0.25 + roll * 0.55));
  }
  return rng;
}

const DEFAULT_TRAITS = [128, 128, 128, 128, 128] as const;
function defaultPopulation(): OrganismSeed[] {
  const result: OrganismSeed[] = [];
  for (let y = 23; y <= 26; y += 1) for (let x = 22; x <= 27; x += 1) result.push({ x, y, energy: 105, lineage: result.length + 1, generation: 0, traits: DEFAULT_TRAITS });
  return result;
}

export function createSimulation(options: CreateSimulationOptions): SimulationState {
  const occupied = new Uint8Array(GRID_CELLS); const energy = new Float32Array(GRID_CELLS);
  const age = new Uint16Array(GRID_CELLS); const organismGeneration = new Uint16Array(GRID_CELLS);
  const lineage = new Uint32Array(GRID_CELLS); const traits = new Uint8Array(GRID_CELLS * TRAIT_COUNT);
  const resources = new Uint8Array(GRID_CELLS); const hazards = new Uint8Array(GRID_CELLS);
  const rngState = fillResources(resources, options.config, options.seed >>> 0);
  for (const item of options.initialResources ?? []) resources[indexOf(item.x, item.y)] = Math.max(0, Math.min(255, Math.round(item.amount)));
  const population = options.initialPopulation ?? defaultPopulation();
  for (const organism of population) {
    const i = indexOf(organism.x, organism.y); occupied[i] = 1; energy[i] = organism.energy;
    organismGeneration[i] = organism.generation; lineage[i] = organism.lineage >>> 0;
    for (let trait = 0; trait < TRAIT_COUNT; trait += 1) traits[i * TRAIT_COUNT + trait] = Math.max(0, Math.min(255, organism.traits[trait]));
  }
  return { seed: options.seed >>> 0, rngState, generation: 0, config: structuredClone(options.config), occupied, energy, age, organismGeneration, lineage, traits, resources, hazards, stats: { population: population.length, births: 0, deaths: 0, maxGeneration: 0, lineages: new Set(population.map((item) => item.lineage)).size }, outcome: population.length ? "running" : "extinct" };
}

const DIRECTIONS = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] as const;
function neighbors(index: number): number[] {
  const x = index % GRID_SIZE; const y = Math.floor(index / GRID_SIZE);
  return DIRECTIONS.map(([dx, dy]) => indexOf(x + dx, y + dy));
}

function copyOrganism(state: SimulationState, target: SimulationState, from: number, to: number): void {
  target.occupied[to] = 1; target.energy[to] = state.energy[from]; target.age[to] = state.age[from];
  target.organismGeneration[to] = state.organismGeneration[from]; target.lineage[to] = state.lineage[from];
  for (let t = 0; t < TRAIT_COUNT; t += 1) target.traits[to * TRAIT_COUNT + t] = state.traits[from * TRAIT_COUNT + t];
}

function environmentHazard(state: SimulationState, index: number): number {
  const pulse = volatilityAt(state.config, state.generation + 1, index, state.seed);
  if (state.config.environment.hazard === "predator") {
    const generation = state.generation + 1;
    const hunterX = (state.seed + generation * 3) % GRID_SIZE;
    const hunterY = (state.seed * 7 + generation * 2) % GRID_SIZE;
    const x = index % GRID_SIZE; const y = Math.floor(index / GRID_SIZE);
    const dx = Math.min(Math.abs(x - hunterX), GRID_SIZE - Math.abs(x - hunterX));
    const dy = Math.min(Math.abs(y - hunterY), GRID_SIZE - Math.abs(y - hunterY));
    const distance = dx + dy;
    return distance <= 8 ? Math.max(1, Math.round((9 - distance) * 5 * (0.6 + pulse))) : 1;
  }
  const base = state.config.environment.hazard === "toxin" ? 36 : state.config.environment.hazard === "heat" ? 29 : state.config.environment.hazard === "drought" ? 24 : 18;
  return Math.max(1, Math.round(base * (0.45 + pulse)));
}

export function stepSimulation(state: SimulationState): SimulationState {
  if (state.outcome === "extinct" || state.generation >= DEFAULT_GENERATIONS) return state;
  const next: SimulationState = {
    ...state, generation: state.generation + 1,
    occupied: new Uint8Array(GRID_CELLS), energy: new Float32Array(GRID_CELLS), age: new Uint16Array(GRID_CELLS), organismGeneration: new Uint16Array(GRID_CELLS), lineage: new Uint32Array(GRID_CELLS), traits: new Uint8Array(GRID_CELLS * TRAIT_COUNT),
    resources: state.resources.slice(), hazards: new Uint8Array(GRID_CELLS), stats: { ...state.stats }, outcome: "running",
  };
  let rng = state.rngState;
  const cap = resourceCapacity(state.config);
  const baseRegrowth = state.config.environment.abundance === "scarce" ? 1 : state.config.environment.abundance === "rich" ? 4 : 2;
  for (let i = 0; i < GRID_CELLS; i += 1) {
    const volatility = volatilityAt(state.config, next.generation, i, state.seed);
    const seasonal = state.config.environment.distribution === "seasonal" ? 0.25 + 0.75 * ((Math.sin(next.generation / 11 + i % GRID_SIZE / 8) + 1) / 2) : 1;
    const drought = state.config.environment.hazard === "drought" ? 0.45 : 1;
    next.resources[i] = Math.min(cap, next.resources[i] + Math.max(1, Math.round(baseRegrowth * seasonal * drought * (0.65 + volatility * 0.35))));
    next.hazards[i] = environmentHazard(state, i);
  }
  let deaths = 0; let births = 0; let maxGeneration = state.stats.maxGeneration;
  for (let i = 0; i < GRID_CELLS; i += 1) {
    if (!state.occupied[i]) continue;
    copyOrganism(state, next, i, i);
    next.age[i] = Math.min(65535, state.age[i] + 1);
    const local = neighbors(i); const occupiedNeighbors = local.filter((n) => state.occupied[n]).length;
    const efficiency = state.traits[i * TRAIT_COUNT] / 255;
    const resilience = state.traits[i * TRAIT_COUNT + 3] / 255;
    const consumed = Math.min(next.resources[i], Math.round(7 + efficiency * 10));
    next.resources[i] -= consumed;
    const fit = state.config.fitness;
    const cooperationBonus = occupiedNeighbors * (0.25 + fit.cooperate * 1.5);
    const hazard = next.hazards[i] / 16;
    let hazardCost = hazard * (1.25 - resilience * 0.45 - fit.adapt * 0.45);
    if (state.config.environment.hazard === "crowding") hazardCost += occupiedNeighbors * (1.1 - fit.cooperate * 0.7);
    if (state.config.environment.hazard === "predator") hazardCost += Math.max(0, 4 - occupiedNeighbors) * (1.55 - fit.cooperate);
    if (state.config.environment.hazard === "toxin") hazardCost += consumed * 0.12;
    if (state.config.environment.hazard === "heat") hazardCost += 1.4;
    const metabolism = 4.5 - fit.survive * 1.8 + (state.traits[i * TRAIT_COUNT + 1] / 255) * 0.8;
    next.energy[i] = state.energy[i] + consumed * (0.75 + efficiency * 0.45) + cooperationBonus - metabolism - hazardCost;
    if (next.energy[i] <= 0 || next.age[i] > 150 + Math.round(fit.survive * 90)) {
      next.occupied[i] = 0; next.energy[i] = 0; deaths += 1; continue;
    }
    const empty = local.filter((n) => !state.occupied[n] && !next.occupied[n]);
    const reproductionThreshold = 145 - fit.replicate * 70 - (state.traits[i * TRAIT_COUNT + 1] / 255) * 18;
    if (empty.length && next.energy[i] >= reproductionThreshold) {
      let roll: number; [roll, rng] = random(rng); const target = empty[Math.floor(roll * empty.length) % empty.length];
      const childEnergy = next.energy[i] * (0.38 + fit.replicate * 0.12); next.energy[i] -= childEnergy;
      next.occupied[target] = 1; next.energy[target] = childEnergy; next.age[target] = 0;
      next.organismGeneration[target] = Math.min(65535, state.organismGeneration[i] + 1); next.lineage[target] = state.lineage[i];
      maxGeneration = Math.max(maxGeneration, next.organismGeneration[target]);
      for (let t = 0; t < TRAIT_COUNT; t += 1) {
        let mutationRoll: number; [mutationRoll, rng] = random(rng);
        const mutation = mutationRoll < 0.08 + fit.adapt * 0.12 ? (mutationRoll < 0.1 ? -1 : 1) : 0;
        next.traits[target * TRAIT_COUNT + t] = Math.max(0, Math.min(255, state.traits[i * TRAIT_COUNT + t] + mutation));
      }
      births += 1;
    } else if (empty.length && fit.explore > 0.45 && next.energy[i] > 28) {
      let roll: number; [roll, rng] = random(rng);
      if (roll < fit.explore * 0.12) {
        const target = empty[Math.floor(roll * empty.length * 17) % empty.length]; copyOrganism(next, next, i, target);
        next.occupied[i] = 0; next.energy[i] = 0;
      }
    }
  }
  next.rngState = rng; next.stats.births += births; next.stats.deaths += deaths;
  next.stats.population = next.occupied.reduce((sum, value) => sum + value, 0); next.stats.maxGeneration = maxGeneration;
  const lineageIds = new Set<number>(); for (let i = 0; i < GRID_CELLS; i += 1) if (next.occupied[i]) lineageIds.add(next.lineage[i]);
  next.stats.lineages = lineageIds.size;
  if (!next.stats.population) next.outcome = "extinct";
  else if (next.generation >= DEFAULT_GENERATIONS) next.outcome = next.stats.population >= 90 || next.stats.births >= 180 ? "thriving" : "surviving";
  return next;
}

export function runSimulation(initial: SimulationState, generations = DEFAULT_GENERATIONS): SimulationState {
  let state = initial;
  const target = Math.min(DEFAULT_GENERATIONS, state.generation + Math.max(0, Math.floor(generations)));
  while (state.generation < target && state.outcome === "running") state = stepSimulation(state);
  if (state.outcome === "running") state = { ...state, outcome: state.stats.population >= 90 || state.stats.births >= 180 ? "thriving" : "surviving" };
  return state;
}

export function snapshotSimulation(state: SimulationState) {
  return { engineVersion: ENGINE_VERSION, seed: state.seed, rngState: state.rngState, generation: state.generation, outcome: state.outcome, stats: state.stats,
    occupied: Array.from(state.occupied), energy: Array.from(state.energy), age: Array.from(state.age), organismGeneration: Array.from(state.organismGeneration), lineage: Array.from(state.lineage), traits: Array.from(state.traits), resources: Array.from(state.resources), hazards: Array.from(state.hazards) };
}
