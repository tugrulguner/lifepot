import type { Page } from "@playwright/test";
import { canonicalAnswers, deterministicSetup, hashSetupRequest } from "../src/game/setup";
import { GRID_SIZE, createSimulation, stepSimulation, type LifeConfig, type SimulationState } from "../src/game/world";

// The same answers the "Explore deterministic preset" button seeds.
const PRESET = canonicalAnswers({
  world: "Rich mineral pools with abundant prey",
  threat: "Predator packs hunt through pulsing droughts",
  reward: "Diversify while prey and predators coexist",
});

function seedFromHash(hash: string) {
  let seed = 2166136261;
  for (const character of hash) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619);
  return seed >>> 0;
}

/**
 * Rebuilds the preset world the page seeds, so a browser test can pick an organism by what the
 * engine will do to it instead of assuming which organism happens to be listed first.
 */
export function presetWorld(edit: (config: LifeConfig) => void = () => {}): SimulationState {
  const config = deterministicSetup(PRESET);
  edit(config);
  return createSimulation({ seed: seedFromHash(hashSetupRequest(PRESET)), config });
}

/** Cell of the first founder (optionally of one guild: 1 forager, 2 predator). */
export function founderCell(state: SimulationState, guild?: 1 | 2) {
  const cell = state.guild.findIndex((value) => (guild ? value === guild : value > 0));
  if (cell < 0) throw new Error("No founder of the requested guild");
  return cell;
}

/** Cell of a founder that is alive at generation zero and gone within `generations` steps. */
export function founderLostWithin(initial: SimulationState, generations: number) {
  let state = initial;
  for (let step = 0; step < generations && state.outcome === "running"; step++) state = stepSimulation(state);
  const living = new Set<number>();
  for (let cell = 0; cell < state.guild.length; cell++) if (state.guild[cell]) living.add(state.organismId[cell]);
  const cell = initial.guild.findIndex((value, index) => value > 0 && !living.has(initial.organismId[index]));
  if (cell < 0) throw new Error(`No founder is lost within ${generations} generations`);
  return cell;
}

/** Clicks a world cell on the board at the neutral (unzoomed) camera. */
export async function clickCell(page: Page, cell: number) {
  const board = page.locator("canvas.life-canvas");
  const bounds = (await board.boundingBox())!;
  await board.click({
    position: {
      x: 18 + ((cell % GRID_SIZE) + 0.5) * ((bounds.width - 36) / GRID_SIZE),
      y: 18 + (Math.floor(cell / GRID_SIZE) + 0.5) * ((bounds.height - 36) / GRID_SIZE),
    },
  });
}
