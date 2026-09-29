export function isSurvivingNewborn(generation: number, age: number, descendantGeneration: number, occupied: number): boolean {
  return generation > 0 && occupied > 0 && age === 0 && descendantGeneration > 0;
}

export function relationshipLabel(pair: string, mode: string): string {
  const [a, b] = pair.split(":");
  if (mode === "a_consumes_b") return `Species ${a} consumes species ${b}`;
  if (mode === "b_consumes_a") return `Species ${b} consumes species ${a}`;
  return mode.replaceAll("_", " ");
}

export function triggerLabel(trigger: string): string {
  const labels: Record<string, string> = {
    speciation: "Heritable variant increase",
    prey_crash: "Other-role population decline",
    predator_crash: "Hunter / omnivore population decline",
  };
  return labels[trigger] ?? trigger.replaceAll("_", " ");
}

export const DEATH_FADE_MS = 420;

export type DeathTrace = {
  index: number;
  lineage: number;
  startedAt: number;
};

export function deathProgress(ageMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return 1;
  return Math.max(0, Math.min(1, ageMs / DEATH_FADE_MS));
}

export function retainDeathTraces(
  traces: readonly DeathTrace[],
  now: number,
  reducedMotion: boolean,
): DeathTrace[] {
  if (reducedMotion) return [];
  return traces.filter((trace) => now - trace.startedAt < DEATH_FADE_MS);
}
