import type { PredatorStrategy, PreyStrategy } from "./decisions";
import type { RulePatch } from "./rules";

type Strategy = PreyStrategy | PredatorStrategy;

const STRATEGY_MEANINGS: Record<Strategy, string> = {
  efficient_grazing: "Can take in more resource energy per feeding than other strategies, depending on feeding traits and available food.",
  early_brood: "Can reproduce at a lower energy threshold; each birth still transfers energy from the parent to the offspring.",
  armored: "Pays extra upkeep to reduce hazard damage; attackers also spend extra energy attacking it.",
  swarming: "Defense maintenance stays fixed at 1 energy; nearby same-species neighbors reduce hazard damage, while attackers pay an additional attack cost that grows with the defender's neighbor count.",
  dispersal: "May move to an adjacent empty cell on a turn when it does not reproduce.",
  ambush: "Searches only nearby cells for edible prey and skips empty-cell movement on alternating turns when no prey is found.",
  pursuit: "Searches farther for edible prey than the basic sensing range.",
  pack_hunting: "Searches farther than ambush, but transfers a smaller share of captured prey energy to the hunter.",
  efficient_kill: "Transfers a larger share of captured prey energy to the hunter; this does not guarantee a catch.",
  brood_hunting: "When edible prey is nearby, prioritizes prey from the oldest lineage generation; can reproduce at a lower energy threshold.",
};

const STRATEGY_SUMMARIES: Record<Strategy, string> = {
  efficient_grazing: "more resource energy per feeding",
  early_brood: "lower reproduction threshold",
  armored: "reduced hazard damage; higher maintenance",
  swarming: "neighbor-based hazard protection",
  dispersal: "may move to an empty adjacent cell",
  ambush: "nearby prey search; alternating stationary turns",
  pursuit: "wider prey search",
  pack_hunting: "wider prey search; smaller energy share",
  efficient_kill: "larger prey-energy share on a catch",
  brood_hunting: "targets older-lineage prey; lower reproduction threshold",
};

export function strategyMeaning(strategy: Strategy): string {
  return STRATEGY_MEANINGS[strategy];
}

export function strategySummary(strategy: Strategy): string {
  return STRATEGY_SUMMARIES[strategy];
}

const SELF_MEANINGS: Record<string, string> = {
  cooperative: "nearby same-species organisms can reduce upkeep",
  territorial: "nearby same-species organisms add to upkeep",
  cannibalistic: "organisms may feed on members of their own species",
  neutral: "there is no same-species interaction effect",
};
const PAIR_MEANINGS: Record<string, string> = {
  a_consumes_b: "species A can feed on species B",
  b_consumes_a: "species B can feed on species A",
  competition: "the two species compete and incur an upkeep cost near one another",
  mutualism: "nearby members of the two species can reduce upkeep",
  avoidance: "nearby members of the two species incur a small upkeep cost",
  neutral: "the pair has no feeding link or interaction effect",
};
const ENVIRONMENT_MEANINGS: Record<string, Record<string, string>> = {
  regeneration: { steady: "Resources regrow at a steady rate.", pulsed: "Resource regrowth varies in waves.", depletion_feedback: "Resources regrow faster where less resource remains." },
  pressure: { stability: "Hazard pressure is reduced.", drought: "Resource regrowth is reduced.", toxin_wave: "Hazard pressure rises in recurring patches.", heat_wave: "Hazard pressure rises across the world.", fragmentation: "Resource regrowth is reduced in recurring strips.", nutrient_bloom: "Resource regrowth is increased." },
  volatility: { stable: "Environmental variation stays steady.", pulsing: "Environmental variation rises and falls in waves.", chaotic: "Environmental variation changes irregularly." },
  intensity: { low: "The environmental pressure has low intensity.", medium: "The environmental pressure has medium intensity.", high: "The environmental pressure has high intensity." },
  duration: { short: "The environmental pressure lasts for a short period.", medium: "The environmental pressure lasts for a medium period.", long: "The environmental pressure lasts for a longer period.", persistent: "The environmental pressure has no scheduled end." },
};

export function rulePatchMeaning(patch: RulePatch): string {
  if (patch.kind === "self") return `Species ${patch.species} self-interaction change: ${SELF_MEANINGS[patch.value]}.`;
  if (patch.kind === "pair") {
    const [a, b] = patch.pair.split(":");
    const meaning = patch.mode === "a_consumes_b" ? `species ${a} can feed on species ${b}`
      : patch.mode === "b_consumes_a" ? `species ${b} can feed on species ${a}`
        : PAIR_MEANINGS[patch.mode];
    return `Species ${patch.pair} relationship change: ${meaning}.`;
  }
  const meaning = ENVIRONMENT_MEANINGS[patch.field][patch.value];
  return `Environment ${patch.field} change: ${meaning.charAt(0).toLowerCase()}${meaning.slice(1)}`;
}
